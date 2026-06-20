import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readAuditLog, aggregateAsks, parseDurationMs } from '../audit-analyze';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AuditEntry } from '../audit-analyze';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const tmpDir = join(tmpdir(), 'warden-audit-analyze-test-' + Date.now());
const auditPath = join(tmpDir, 'warden-audit.jsonl');
const rotatedPath = auditPath + '.1';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    ts: new Date().toISOString(),
    sid: 'session-abc1',
    cmd: 'git status',
    decision: 'ask',
    reason: 'needs review',
    details: [],
    yolo: false,
    elapsed_ms: 10,
    ...overrides,
  };
}

function toJsonl(entries: Partial<AuditEntry>[]): string {
  return entries.map((e) => JSON.stringify(makeEntry(e))).join('\n') + '\n';
}

function tsAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// readAuditLog
// ---------------------------------------------------------------------------

describe('readAuditLog', () => {
  it('returns [] when both files are missing', () => {
    const result = readAuditLog(auditPath);
    expect(result).toEqual([]);
  });

  it('returns entries from live file when .1 is missing', () => {
    writeFileSync(auditPath, toJsonl([{ cmd: 'ls', decision: 'allow' }]));
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('ls');
  });

  it('returns entries from .1 when live file is missing', () => {
    writeFileSync(rotatedPath, toJsonl([{ cmd: 'rm foo', decision: 'deny' }]));
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('rm foo');
  });

  it('places .1 entries before live-file entries', () => {
    writeFileSync(rotatedPath, toJsonl([{ cmd: 'old-cmd', decision: 'ask' }]));
    writeFileSync(auditPath, toJsonl([{ cmd: 'new-cmd', decision: 'ask' }]));
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(2);
    expect(result[0].cmd).toBe('old-cmd');
    expect(result[1].cmd).toBe('new-cmd');
  });

  it('skips malformed lines and returns valid entries', () => {
    const content =
      'this is not json\n' +
      JSON.stringify(makeEntry({ cmd: 'valid-cmd', decision: 'allow' })) +
      '\n' +
      '{"partial": true}\n' +
      JSON.stringify(makeEntry({ cmd: 'another-cmd', decision: 'deny' })) +
      '\n';
    writeFileSync(auditPath, content);
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.cmd)).toEqual(['valid-cmd', 'another-cmd']);
  });

  it('skips lines missing required ts field', () => {
    const bad = JSON.stringify({ sid: 'x', decision: 'allow' });
    const good = JSON.stringify(makeEntry({ cmd: 'good', decision: 'allow' }));
    writeFileSync(auditPath, bad + '\n' + good + '\n');
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('good');
  });

  it('skips lines with invalid decision value', () => {
    const bad = JSON.stringify({ ...makeEntry(), decision: 'unknown-value' });
    const good = JSON.stringify(makeEntry({ cmd: 'good', decision: 'ask' }));
    writeFileSync(auditPath, bad + '\n' + good + '\n');
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('good');
  });

  it('defaults missing details field to []', () => {
    const entry = makeEntry({ cmd: 'no-details', decision: 'ask' });
    const raw = JSON.parse(JSON.stringify(entry));
    delete raw.details;
    writeFileSync(auditPath, JSON.stringify(raw) + '\n');
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
    expect(result[0].details).toEqual([]);
  });

  it('sinceMs keeps only recent entries and drops old ones', () => {
    const recentTs = tsAgo(60_000);   // 1 minute ago
    const oldTs = tsAgo(7_200_000);   // 2 hours ago
    writeFileSync(
      auditPath,
      JSON.stringify(makeEntry({ cmd: 'old', ts: oldTs, decision: 'ask' })) +
        '\n' +
        JSON.stringify(makeEntry({ cmd: 'recent', ts: recentTs, decision: 'ask' })) +
        '\n',
    );
    const result = readAuditLog(auditPath, { sinceMs: 3_600_000 }); // last hour
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('recent');
  });

  it('sinceMs filter spans both files', () => {
    const recentTs = tsAgo(30_000);
    const oldTs = tsAgo(7_200_000);
    writeFileSync(
      rotatedPath,
      JSON.stringify(makeEntry({ cmd: 'old-in-rotated', ts: oldTs, decision: 'ask' })) + '\n',
    );
    writeFileSync(
      auditPath,
      JSON.stringify(makeEntry({ cmd: 'recent-in-live', ts: recentTs, decision: 'ask' })) + '\n',
    );
    const result = readAuditLog(auditPath, { sinceMs: 3_600_000 });
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('recent-in-live');
  });

  it('omitting sinceMs applies no time filter', () => {
    const oldTs = tsAgo(30 * 24 * 3_600_000); // 30 days ago
    writeFileSync(
      auditPath,
      JSON.stringify(makeEntry({ cmd: 'ancient', ts: oldTs, decision: 'ask' })) + '\n',
    );
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
  });

  it('coerces a non-string cmd to an empty string at the read boundary', () => {
    const raw = JSON.parse(JSON.stringify(makeEntry({ decision: 'ask' })));
    raw.cmd = 42;
    writeFileSync(auditPath, JSON.stringify(raw) + '\n');
    const result = readAuditLog(auditPath);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('');
  });
});

// ---------------------------------------------------------------------------
// parseDurationMs
// ---------------------------------------------------------------------------

describe('parseDurationMs', () => {
  it("'45s' -> 45000", () => {
    expect(parseDurationMs('45s')).toBe(45_000);
  });

  it("'30m' -> 1800000", () => {
    expect(parseDurationMs('30m')).toBe(1_800_000);
  });

  it("'24h' -> 86400000", () => {
    expect(parseDurationMs('24h')).toBe(86_400_000);
  });

  it("'7d' -> 604800000", () => {
    expect(parseDurationMs('7d')).toBe(604_800_000);
  });

  it("'2w' -> 1209600000", () => {
    expect(parseDurationMs('2w')).toBe(1_209_600_000);
  });

  it("'x' -> null (no number)", () => {
    expect(parseDurationMs('x')).toBeNull();
  });

  it("'7' -> null (no unit)", () => {
    expect(parseDurationMs('7')).toBeNull();
  });

  it("'7y' -> null (unknown unit)", () => {
    expect(parseDurationMs('7y')).toBeNull();
  });

  it("'' -> null (empty string)", () => {
    expect(parseDurationMs('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// aggregateAsks
// ---------------------------------------------------------------------------

describe('aggregateAsks', () => {
  it('ignores allow entries', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'allow',
        details: [{ command: 'ls', args: [], decision: 'allow', reason: 'ok' }],
      }),
    ];
    expect(aggregateAsks(entries)).toEqual([]);
  });

  it('groups by command + subcommand argShape', () => {
    const detail = (cmd: string, args: string[], decision: 'ask' | 'deny' = 'ask') => ({
      command: cmd,
      args,
      decision,
      reason: 'test',
    });
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'ask', details: [detail('git', ['push'])] }),
      makeEntry({ decision: 'ask', details: [detail('git', ['push'])] }),
      makeEntry({ decision: 'ask', details: [detail('git', ['pull'])] }),
    ];
    const groups = aggregateAsks(entries);
    // Two distinct groups: git+push and git+pull
    expect(groups).toHaveLength(2);
    const pushGroup = groups.find((g) => g.argShape === 'push');
    const pullGroup = groups.find((g) => g.argShape === 'pull');
    expect(pushGroup).toBeDefined();
    expect(pushGroup!.count).toBe(2);
    expect(pullGroup!.count).toBe(1);
  });

  it('argShape treats leading-flag args as empty string', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [{ command: 'ls', args: ['-la'], decision: 'ask', reason: 'r' }],
      }),
      makeEntry({
        decision: 'ask',
        details: [{ command: 'ls', args: ['-al'], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].argShape).toBe('');
    expect(groups[0].count).toBe(2);
  });

  it('argShape treats empty args as empty string', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [{ command: 'git', args: [], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].argShape).toBe('');
  });

  it('ranks by count descending, then lastSeen descending', () => {
    const old = tsAgo(60_000);
    const recent = tsAgo(5_000);
    const entries: AuditEntry[] = [
      // git push x1 (older)
      makeEntry({
        ts: old,
        decision: 'ask',
        details: [{ command: 'git', args: ['push'], decision: 'ask', reason: 'r' }],
      }),
      // poetry install x2 (more recent)
      makeEntry({
        ts: old,
        decision: 'ask',
        details: [{ command: 'poetry', args: ['install'], decision: 'ask', reason: 'r' }],
      }),
      makeEntry({
        ts: recent,
        decision: 'ask',
        details: [{ command: 'poetry', args: ['install'], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].command).toBe('poetry');
    expect(groups[0].argShape).toBe('install');
    expect(groups[1].command).toBe('git');
  });

  it('decisionSample is deny when any contribution in the group denied', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [{ command: 'rm', args: ['-rf'], decision: 'ask', reason: 'risky' }],
      }),
      makeEntry({
        decision: 'deny',
        details: [{ command: 'rm', args: ['-rf'], decision: 'deny', reason: 'blocked' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].decisionSample).toBe('deny');
  });

  it('decisionSample is ask when no contribution denied', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [{ command: 'node', args: ['script.js'], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].decisionSample).toBe('ask');
  });

  it('matchedRuleSample picks most-restrictive: alwaysDeny > argPattern > other > default > undefined', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [
          {
            command: 'git',
            args: ['push'],
            decision: 'ask',
            reason: 'default reason',
            matchedRule: 'git:default',
          },
        ],
      }),
      makeEntry({
        decision: 'ask',
        details: [
          {
            command: 'git',
            args: ['push'],
            decision: 'ask',
            reason: 'argPattern reason',
            matchedRule: 'git:argPattern',
          },
        ],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups).toHaveLength(1);
    // git:argPattern is more restrictive than git:default
    expect(groups[0].matchedRuleSample).toBe('git:argPattern');
    expect(groups[0].sampleReason).toBe('argPattern reason');
  });

  it('matchedRuleSample: alwaysDeny beats argPattern', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'deny',
        details: [
          {
            command: 'sudo',
            args: [],
            decision: 'deny',
            reason: 'always denied',
            matchedRule: 'alwaysDeny',
          },
        ],
      }),
      makeEntry({
        decision: 'ask',
        details: [
          {
            command: 'sudo',
            args: [],
            decision: 'ask',
            reason: 'arg pattern',
            matchedRule: 'sudo:argPattern',
          },
        ],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].matchedRuleSample).toBe('alwaysDeny');
    expect(groups[0].sampleReason).toBe('always denied');
  });

  it('firstSeen and lastSeen track earliest and latest ts in group', () => {
    const old = tsAgo(120_000);
    const recent = tsAgo(10_000);
    const entries: AuditEntry[] = [
      makeEntry({
        ts: old,
        decision: 'ask',
        details: [{ command: 'docker', args: ['run'], decision: 'ask', reason: 'r' }],
      }),
      makeEntry({
        ts: recent,
        decision: 'ask',
        details: [{ command: 'docker', args: ['run'], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].firstSeen).toBe(old);
    expect(groups[0].lastSeen).toBe(recent);
  });

  it('allow details within an ask/deny entry are not aggregated', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [
          { command: 'safe-cmd', args: [], decision: 'allow', reason: 'fine' },
          { command: 'risky-cmd', args: ['--force'], decision: 'ask', reason: 'check' },
        ],
      }),
    ];
    const groups = aggregateAsks(entries);
    // Only risky-cmd contributed; safe-cmd (allow detail) must not appear
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('risky-cmd');
  });

  it('returns empty array when all entries are allow', () => {
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'allow', details: [] }),
      makeEntry({ decision: 'allow', details: [] }),
    ];
    expect(aggregateAsks(entries)).toEqual([]);
  });

  it('count reflects total entry contributions, not unique commands', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        details: [{ command: 'npm', args: ['install'], decision: 'ask', reason: 'r' }],
      }),
      makeEntry({
        decision: 'ask',
        details: [{ command: 'npm', args: ['install'], decision: 'ask', reason: 'r' }],
      }),
      makeEntry({
        decision: 'ask',
        details: [{ command: 'npm', args: ['install'], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].count).toBe(3);
  });

  // --- Synthetic fallback: ask/deny entries with no usable non-allow detail ---

  it('synthesizes a group from entry.cmd when an ask entry has no details', () => {
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'ask', cmd: 'mkdocs build', reason: 'no rule', details: [] }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('mkdocs');
    expect(groups[0].argShape).toBe('build');
    expect(groups[0].count).toBe(1);
    expect(groups[0].decisionSample).toBe('ask');
    expect(groups[0].matchedRuleSample).toBeUndefined();
    expect(groups[0].sampleReason).toBe('no rule');
  });

  it('synthetic fallback applies the flag rule to the second token', () => {
    const entries: AuditEntry[] = [makeEntry({ decision: 'ask', cmd: 'ls -la', details: [] })];
    const groups = aggregateAsks(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('ls');
    expect(groups[0].argShape).toBe('');
  });

  it('synthetic fallback carries the deny decision for a deny entry', () => {
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'deny', cmd: 'shutdown now', reason: 'blocked', details: [] }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups[0].decisionSample).toBe('deny');
    expect(groups[0].command).toBe('shutdown');
  });

  it('skips the synthetic fallback for an env-prefixed command', () => {
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'ask', cmd: 'FOO=bar mytool run', details: [] }),
    ];
    expect(aggregateAsks(entries)).toEqual([]);
  });

  it('skips the synthetic fallback for a piped command', () => {
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'ask', cmd: 'cat secrets | grep token', details: [] }),
    ];
    expect(aggregateAsks(entries)).toEqual([]);
  });

  it('skips the synthetic fallback for chained commands (&& and ;)', () => {
    expect(
      aggregateAsks([makeEntry({ decision: 'ask', cmd: 'build && deploy', details: [] })]),
    ).toEqual([]);
    expect(
      aggregateAsks([makeEntry({ decision: 'ask', cmd: 'a ; b', details: [] })]),
    ).toEqual([]);
  });

  it('does NOT synthesize when a non-allow detail is present (detail wins)', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        cmd: 'wrapper inner',
        details: [{ command: 'realcmd', args: ['sub'], decision: 'ask', reason: 'r' }],
      }),
    ];
    const groups = aggregateAsks(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('realcmd');
    expect(groups[0].argShape).toBe('sub');
  });

  it('tolerates a non-array details value without throwing', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        cmd: 'tool sub',
        details: 'garbage' as unknown as AuditEntry['details'],
      }),
    ];
    let groups: ReturnType<typeof aggregateAsks> = [];
    expect(() => {
      groups = aggregateAsks(entries);
    }).not.toThrow();
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('tool');
    expect(groups[0].argShape).toBe('sub');
  });

  it('tolerates malformed detail elements without throwing', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        cmd: 'tool sub',
        details: [null, 42, { no: 'shape' }] as unknown as AuditEntry['details'],
      }),
    ];
    let groups: ReturnType<typeof aggregateAsks> = [];
    expect(() => {
      groups = aggregateAsks(entries);
    }).not.toThrow();
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('tool');
  });

  it('tolerates a non-string cmd without throwing (no synthetic group)', () => {
    const entries: AuditEntry[] = [
      makeEntry({ decision: 'ask', cmd: 42 as unknown as string, details: [] }),
    ];
    let groups: ReturnType<typeof aggregateAsks> = [];
    expect(() => {
      groups = aggregateAsks(entries);
    }).not.toThrow();
    expect(groups).toEqual([]);
  });

  it('skips a detail whose args contains a non-string element without throwing', () => {
    const entries: AuditEntry[] = [
      makeEntry({
        decision: 'ask',
        cmd: 'tool sub',
        details: [
          { command: 'x', args: [42], decision: 'ask', reason: 'r' },
        ] as unknown as AuditEntry['details'],
      }),
    ];
    let groups: ReturnType<typeof aggregateAsks> = [];
    expect(() => {
      groups = aggregateAsks(entries);
    }).not.toThrow();
    // malformed detail skipped; entry has no usable non-allow detail -> synthetic group from cmd
    expect(groups).toHaveLength(1);
    expect(groups[0].command).toBe('tool');
  });
});
