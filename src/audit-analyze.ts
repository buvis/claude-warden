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
        cmd: (rec.cmd as string) ?? '',
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

export function aggregateAsks(entries: AuditEntry[]): AskGroup[] {
  interface Contribution {
    ts: string;
    decision: Decision;
    matchedRule: string | undefined;
    reason: string;
  }

  const groups = new Map<string, { contributions: Contribution[] }>();

  for (const entry of entries) {
    if (entry.decision === 'allow') continue;
    for (const detail of entry.details) {
      if (detail.decision === 'allow') continue;
      const key = `${detail.command}\x00${argShape(detail.args)}`;
      const contrib: Contribution = {
        ts: entry.ts,
        decision: detail.decision,
        matchedRule: detail.matchedRule,
        reason: detail.reason,
      };
      if (!groups.has(key)) {
        groups.set(key, { contributions: [] });
      }
      groups.get(key)!.contributions.push(contrib);
    }
  }

  const result: AskGroup[] = [];
  for (const [key, val] of groups) {
    const [command, argShapeStr] = key.split('\x00');
    const contribs = val.contributions;
    let count = contribs.length;
    let firstSeen = contribs[0].ts;
    let lastSeen = contribs[0].ts;
    for (const c of contribs) {
      if (Date.parse(c.ts) < Date.parse(firstSeen)) firstSeen = c.ts;
      if (Date.parse(c.ts) > Date.parse(lastSeen)) lastSeen = c.ts;
    }
    const decisionSample = contribs.some((c) => c.decision === 'deny') ? 'deny' : 'ask';

    let matchedRuleSample: string | undefined = undefined;
    let sampleReason = contribs[0].reason;
    let bestRank = restrictivenessRank(undefined);

    for (const c of contribs) {
      const rank = restrictivenessRank(c.matchedRule);
      if (rank > bestRank) {
        bestRank = rank;
        matchedRuleSample = c.matchedRule;
        sampleReason = c.reason;
      } else if (rank === bestRank && rank > 0) {
        if (c.matchedRule !== undefined && (matchedRuleSample === undefined || c.matchedRule < matchedRuleSample)) {
          matchedRuleSample = c.matchedRule;
          sampleReason = c.reason;
        }
      }
    }

    result.push({
      command,
      argShape: argShapeStr,
      count,
      firstSeen,
      lastSeen,
      decisionSample,
      matchedRuleSample,
      sampleReason,
    });
  }

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
