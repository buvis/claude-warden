import { existsSync, readFileSync } from 'fs';
import type { Decision, CommandEvalDetail } from './types';

export interface AuditEntry {
  ts: string;
  sid: string;
  cmd: string;
  decision: Decision;
  reason: string;
  details: CommandEvalDetail[];
  yolo: boolean;
  elapsed_ms: number;
}

export interface ReadAuditOptions {
  sinceMs?: number;
}

export interface AskGroup {
  command: string;
  argShape: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleReason: string;
  decisionSample: Decision;
  matchedRuleSample?: string;
}

const VALID_DECISIONS = new Set<Decision>(['allow', 'deny', 'ask']);

export function readAuditLog(auditPath: string, opts?: ReadAuditOptions): AuditEntry[] {
  const entries: AuditEntry[] = [];

  const files = [auditPath + '.1', auditPath];
  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const raw = readFileSync(filePath, 'utf-8');
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue;
      let obj: unknown;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj === null || typeof obj !== 'object') continue;
      const rec = obj as Record<string, unknown>;
      if (typeof rec.ts !== 'string') continue;
      if (!VALID_DECISIONS.has(rec.decision as Decision)) continue;
      const entry: AuditEntry = {
        ts: rec.ts,
        sid: (rec.sid as string) ?? '',
        cmd: typeof rec.cmd === 'string' ? rec.cmd : '',
        decision: rec.decision as Decision,
        reason: (rec.reason as string) ?? '',
        details: Array.isArray(rec.details) ? rec.details : [],
        yolo: (rec.yolo as boolean) ?? false,
        elapsed_ms: (rec.elapsed_ms as number) ?? 0,
      };
      entries.push(entry);
    }
  }

  if (opts?.sinceMs !== undefined) {
    const cutoff = Date.now() - opts.sinceMs;
    return entries.filter((e) => Date.parse(e.ts) >= cutoff);
  }

  return entries;
}

function argShape(args: string[]): string {
  if (args.length === 0) return '';
  if (args[0].startsWith('-')) return '';
  return args[0];
}

const RESTRICTIVENESS: Record<string, number> = {
  alwaysDeny: 100,
};

function restrictivenessRank(matchedRule: string | undefined): number {
  if (matchedRule === undefined) return 0;
  if (matchedRule === 'default') return 1;
  if (matchedRule.endsWith(':default')) return 2;
  if (matchedRule in RESTRICTIVENESS) return RESTRICTIVENESS[matchedRule];
  if (matchedRule.endsWith(':argPattern')) return 4;
  return 3;
}

interface Contribution {
  ts: string;
  decision: Decision;
  matchedRule: string | undefined;
  reason: string;
}

// Tolerate a present-but-malformed details value: only an object carrying a
// string command, an args array, and a valid decision is usable; anything else
// is skipped rather than throwing during aggregation.
function isUsableDetail(d: unknown): d is CommandEvalDetail {
  if (d === null || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.command === 'string' &&
    Array.isArray(r.args) &&
    r.args.every((a) => typeof a === 'string') &&
    VALID_DECISIONS.has(r.decision as Decision)
  );
}

// An unescaped pipe/chain operator means entry.cmd is a pipeline/chain, not a
// single command, so a synthetic group from its first token would misattribute.
function hasUnescapedChain(cmd: string): boolean {
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '|' || ch === ';') return true;
    if (ch === '&' && cmd[i + 1] === '&') return true;
  }
  return false;
}

// Synthetic contribution from entry.cmd for an ask/deny entry whose details
// carry no usable non-allow detail (real evaluator paths emit details:[] for
// parse errors, subshell fallback, unrecognized constructs, recursion depth).
// Dropped for env-prefixed (first token has '=') or pipeline/chain commands.
function syntheticContribution(
  entry: AuditEntry,
): { key: string; contrib: Contribution } | null {
  if (typeof entry.cmd !== 'string') return null;
  const tokens = entry.cmd.trim().split(/\s+/).filter((t) => t !== '');
  if (tokens.length === 0) return null;
  if (tokens[0].includes('=')) return null;
  if (hasUnescapedChain(entry.cmd)) return null;
  return {
    key: `${tokens[0]}\x00${argShape(tokens.slice(1))}`,
    contrib: { ts: entry.ts, decision: entry.decision, matchedRule: undefined, reason: entry.reason },
  };
}

function collectContributions(entries: AuditEntry[]): Map<string, Contribution[]> {
  const groups = new Map<string, Contribution[]>();
  const push = (key: string, c: Contribution): void => {
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  };

  for (const entry of entries) {
    if (entry.decision === 'allow') continue;
    let contributed = false;
    if (Array.isArray(entry.details)) {
      for (const detail of entry.details) {
        if (!isUsableDetail(detail) || detail.decision === 'allow') continue;
        push(`${detail.command}\x00${argShape(detail.args)}`, {
          ts: entry.ts,
          decision: detail.decision,
          matchedRule: typeof detail.matchedRule === 'string' ? detail.matchedRule : undefined,
          reason: typeof detail.reason === 'string' ? detail.reason : '',
        });
        contributed = true;
      }
    }
    if (!contributed) {
      const synth = syntheticContribution(entry);
      if (synth) push(synth.key, synth.contrib);
    }
  }
  return groups;
}

function reduceGroup(key: string, contribs: Contribution[]): AskGroup {
  const [command, argShapeStr] = key.split('\x00');
  let firstSeen = contribs[0].ts;
  let lastSeen = contribs[0].ts;
  for (const c of contribs) {
    if (Date.parse(c.ts) < Date.parse(firstSeen)) firstSeen = c.ts;
    if (Date.parse(c.ts) > Date.parse(lastSeen)) lastSeen = c.ts;
  }
  const decisionSample: Decision = contribs.some((c) => c.decision === 'deny') ? 'deny' : 'ask';

  let matchedRuleSample: string | undefined = undefined;
  let sampleReason = contribs[0].reason;
  let bestRank = restrictivenessRank(undefined);
  for (const c of contribs) {
    const rank = restrictivenessRank(c.matchedRule);
    const tie =
      rank === bestRank &&
      rank > 0 &&
      c.matchedRule !== undefined &&
      (matchedRuleSample === undefined || c.matchedRule < matchedRuleSample);
    if (rank > bestRank || tie) {
      bestRank = rank;
      matchedRuleSample = c.matchedRule;
      sampleReason = c.reason;
    }
  }

  return {
    command,
    argShape: argShapeStr,
    count: contribs.length,
    firstSeen,
    lastSeen,
    decisionSample,
    matchedRuleSample,
    sampleReason,
  };
}

export function aggregateAsks(entries: AuditEntry[]): AskGroup[] {
  const groups = collectContributions(entries);
  const result: AskGroup[] = [];
  for (const [key, contribs] of groups) result.push(reduceGroup(key, contribs));

  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const lastSeenDiff = Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
    if (lastSeenDiff !== 0) return lastSeenDiff;
    if (a.command !== b.command) return a.command < b.command ? -1 : 1;
    return a.argShape < b.argShape ? -1 : 1;
  });

  return result;
}

export function parseDurationMs(spec: string): number | null {
  const m = spec.match(/^(\d+)([smhdw])$/);
  if (!m) return null;
  const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return Number(m[1]) * mult[m[2]];
}
