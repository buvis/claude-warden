import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';

const CLI_BIN = resolve(__dirname, '../../dist/cli.cjs');

function cli(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI_BIN, ...args], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

describe('CLI: warden eval', () => {
  it('allows safe commands (exit 0)', () => {
    const { stdout, exitCode } = cli('eval', 'ls -la');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('allow');
  });

  it('denies dangerous commands (exit 2)', () => {
    const { exitCode, stdout } = cli('eval', 'shutdown -h now');
    expect(exitCode).toBe(2);
    expect(stdout).toContain('deny');
  });

  it('returns ask for unknown commands (exit 1)', () => {
    const { exitCode, stdout } = cli('eval', 'some-unknown-command --dangerous');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('ask');
  });

  it('supports --json flag', () => {
    const { stdout, exitCode } = cli('eval', '--json', 'ls -la');
    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.decision).toBe('allow');
    expect(output.reason).toBeDefined();
    expect(output.details).toBeInstanceOf(Array);
  });

  it('supports --cwd flag', () => {
    const { stdout, exitCode } = cli('eval', '--cwd', '/tmp', 'ls');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('allow');
  });

  it('shows help with --help', () => {
    const { stdout, exitCode } = cli('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage');
    expect(stdout).toContain('warden eval');
  });

  it('errors on missing command', () => {
    const { stderr, exitCode } = cli('eval');
    expect(exitCode).toBe(1);
    expect(stderr).toContain('no command provided');
  });

  it('errors on unknown subcommand', () => {
    const { stderr, exitCode } = cli('unknown');
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown subcommand');
  });
});

// --- helpers for warden suggest tests ---

function makeAuditEntry(ts: string, cmd: string, command: string, args: string[], decision: 'ask' | 'deny'): string {
  return JSON.stringify({
    ts,
    sid: 's1',
    cmd,
    decision,
    reason: 'unknown command',
    details: [{ command, args, decision, reason: 'unknown command', matchedRule: 'default' }],
    yolo: false,
    elapsed_ms: 1,
  });
}

describe('CLI: warden suggest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'warden-suggest-'));
    mkdirSync(join(tmpDir, '.claude'), { recursive: true });
    const auditPath = join(tmpDir, 'audit.jsonl');
    writeFileSync(
      join(tmpDir, '.claude', 'warden.yaml'),
      `auditPath: ${auditPath}\n`,
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 0 on an empty audit log', () => {
    writeFileSync(join(tmpDir, 'audit.jsonl'), '');
    const { exitCode, stdout } = cli('suggest', '--cwd', tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('No recurring ask/deny entries found.');
  });

  it('exits 0 when the audit log file is absent', () => {
    // auditPath is configured but the file does not exist
    const { exitCode, stdout } = cli('suggest', '--cwd', tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('No recurring ask/deny entries found.');
  });

  it('prints a human report with recurring asks and a snippet section', () => {
    const lines = [
      makeAuditEntry('2026-06-01T10:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
      makeAuditEntry('2026-06-01T11:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
      makeAuditEntry('2026-06-01T12:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
    ];
    writeFileSync(join(tmpDir, 'audit.jsonl'), lines.join('\n') + '\n');
    const { exitCode, stdout } = cli('suggest', '--cwd', tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Top repeated asks:');
    expect(stdout).toContain('mkdocs');
    expect(stdout).toContain('build');
    expect(stdout).toContain('3');
    expect(stdout).toContain('Suggested warden.yaml additions:');
  });

  it('emits JSON with the stable report shape under --json', () => {
    const lines = [
      makeAuditEntry('2026-06-01T10:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
      makeAuditEntry('2026-06-01T11:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
    ];
    writeFileSync(join(tmpDir, 'audit.jsonl'), lines.join('\n') + '\n');
    const { exitCode, stdout } = cli('suggest', '--json', '--cwd', tmpDir);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    // stable required shape
    expect(result).toHaveProperty('period');
    expect(result.period).toHaveProperty('from');
    expect(result.period).toHaveProperty('to');
    expect(result).toHaveProperty('totalAskDeny');
    expect(result).toHaveProperty('distinctGroups');
    expect(result).toHaveProperty('top');
    expect(result).toHaveProperty('snippet');
    expect(Array.isArray(result.top)).toBe(true);
    // non-empty log: snippet should be a non-empty string
    expect(typeof result.snippet).toBe('string');
    expect(result.snippet.length).toBeGreaterThan(0);
    // count must reflect the fixture
    expect(result.totalAskDeny).toBeGreaterThanOrEqual(2);
  });

  it('--top N limits the number of entries in the top list', () => {
    // 3 distinct command groups, each asked once
    const lines = [
      makeAuditEntry('2026-06-01T10:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
      makeAuditEntry('2026-06-01T11:00:00Z', 'poetry install', 'poetry', ['install'], 'ask'),
      makeAuditEntry('2026-06-01T12:00:00Z', 'pre-commit run', 'pre-commit', ['run'], 'ask'),
    ];
    writeFileSync(join(tmpDir, 'audit.jsonl'), lines.join('\n') + '\n');
    const { exitCode, stdout } = cli('suggest', '--json', '--top', '2', '--cwd', tmpDir);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.top.length).toBeLessThanOrEqual(2);
  });

  it('--since filters out entries older than the duration', () => {
    // Timestamps are now-relative so the test binds to the filter intent
    // (a 7d window) rather than to fixed calendar dates that rot over time.
    const HOUR = 3_600_000;
    const DAY = 86_400_000;
    const tsAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
    const lines = [
      makeAuditEntry(tsAgo(365 * DAY), 'mkdocs build', 'mkdocs', ['build'], 'ask'), // ~1y ago, outside 7d
      makeAuditEntry(tsAgo(2 * HOUR), 'mkdocs build', 'mkdocs', ['build'], 'ask'), // recent
      makeAuditEntry(tsAgo(1 * HOUR), 'mkdocs build', 'mkdocs', ['build'], 'ask'), // recent
    ];
    writeFileSync(join(tmpDir, 'audit.jsonl'), lines.join('\n') + '\n');
    const { exitCode, stdout } = cli('suggest', '--json', '--since', '7d', '--cwd', tmpDir);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    // only the 2 recent entries should be counted (the ~1y-old one is excluded)
    expect(result.totalAskDeny).toBe(2);
    const group = result.top.find((g: any) => g.command === 'mkdocs');
    expect(group).toBeDefined();
    expect(group.count).toBe(2);
  });

  it('exits 1 with a stderr error on an invalid --since value', () => {
    const { exitCode, stderr } = cli('suggest', '--since', '7day', '--cwd', tmpDir);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error: invalid --since value');
  });

  it('exits 1 with a stderr error on a non-numeric --top value', () => {
    const { exitCode, stderr } = cli('suggest', '--top', 'abc', '--cwd', tmpDir);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error: invalid --top value');
  });

  it('exits 1 with a stderr error on --top 0 (non-positive)', () => {
    const { exitCode, stderr } = cli('suggest', '--top', '0', '--cwd', tmpDir);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error: invalid --top value');
  });

  it('produces byte-identical output on repeated runs (determinism)', () => {
    const lines = [
      makeAuditEntry('2026-06-01T10:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
      makeAuditEntry('2026-06-01T11:00:00Z', 'mkdocs build', 'mkdocs', ['build'], 'ask'),
    ];
    writeFileSync(join(tmpDir, 'audit.jsonl'), lines.join('\n') + '\n');
    const first = cli('suggest', '--json', '--cwd', tmpDir);
    const second = cli('suggest', '--json', '--cwd', tmpDir);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
