import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logDecision } from '../audit';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { WardenConfig, HookInput, EvalResult } from '../types';
import { DEFAULT_CONFIG } from '../defaults';

const tmpDir = join(tmpdir(), 'warden-audit-test-' + Date.now());
const logPath = join(tmpDir, 'warden-audit.jsonl');

function makeConfig(overrides: Partial<WardenConfig> = {}): WardenConfig {
  return { ...structuredClone(DEFAULT_CONFIG), auditPath: logPath, ...overrides };
}

function makeInput(cmd: string = 'ls -la'): HookInput {
  return {
    session_id: 'session-abc1234567890xyz',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: cmd },
    cwd: '/tmp',
    permission_mode: 'default',
  };
}

function makeResult(decision: 'allow' | 'deny' | 'ask' = 'allow', reason: string = 'ok'): EvalResult {
  return {
    decision,
    reason,
    details: decision !== 'allow' ? [{ command: 'test', args: [], decision, reason, matchedRule: 'test:rule' }] : [],
  };
}

function readLog(): string[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
}

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('logDecision', () => {
  it('writes a valid JSONL entry', () => {
    logDecision(makeConfig(), makeInput(), makeResult('ask', 'needs review'), 12, false);
    const lines = readLog();
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.sid).toBe('session-abc1');
    expect(entry.cmd).toBe('ls -la');
    expect(entry.decision).toBe('ask');
    expect(entry.reason).toBe('needs review');
    expect(entry.yolo).toBe(false);
    expect(entry.elapsed_ms).toBe(12);
  });

  it('truncates sid to 12 chars', () => {
    logDecision(makeConfig(), makeInput(), makeResult('ask'), 5, false);
    const entry = JSON.parse(readLog()[0]);
    expect(entry.sid).toHaveLength(12);
  });

  it('truncates cmd to 500 chars', () => {
    const longCmd = 'x'.repeat(600);
    logDecision(makeConfig(), makeInput(longCmd), makeResult('ask'), 5, false);
    const entry = JSON.parse(readLog()[0]);
    expect(entry.cmd).toHaveLength(500);
  });

  it('includes details for ask decisions', () => {
    logDecision(makeConfig(), makeInput(), makeResult('ask', 'blocked'), 5, false);
    const entry = JSON.parse(readLog()[0]);
    expect(entry.details).toHaveLength(1);
    expect(entry.details[0].command).toBe('test');
  });

  it('includes details for deny decisions', () => {
    logDecision(makeConfig(), makeInput(), makeResult('deny', 'blocked'), 5, false);
    const entry = JSON.parse(readLog()[0]);
    expect(entry.details).toHaveLength(1);
  });

  it('has empty details for allow decisions', () => {
    logDecision(makeConfig({ auditAllowDecisions: true }), makeInput(), makeResult('allow'), 5, false);
    const entry = JSON.parse(readLog()[0]);
    expect(entry.details).toEqual([]);
  });

  it('records yolo flag', () => {
    logDecision(makeConfig(), makeInput(), makeResult('ask'), 5, true);
    const entry = JSON.parse(readLog()[0]);
    expect(entry.yolo).toBe(true);
  });
});

describe('config control', () => {
  it('does not log when audit is false', () => {
    logDecision(makeConfig({ audit: false }), makeInput(), makeResult('ask'), 5, false);
    expect(existsSync(logPath)).toBe(false);
  });

  it('does not log allow decisions when auditAllowDecisions is false', () => {
    logDecision(makeConfig({ auditAllowDecisions: false }), makeInput(), makeResult('allow'), 5, false);
    expect(existsSync(logPath)).toBe(false);
  });

  it('logs allow decisions when auditAllowDecisions is true', () => {
    logDecision(makeConfig({ auditAllowDecisions: true }), makeInput(), makeResult('allow'), 5, false);
    const lines = readLog();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).decision).toBe('allow');
  });

  it('always logs ask decisions regardless of auditAllowDecisions', () => {
    logDecision(makeConfig({ auditAllowDecisions: false }), makeInput(), makeResult('ask'), 5, false);
    expect(readLog()).toHaveLength(1);
  });

  it('always logs deny decisions regardless of auditAllowDecisions', () => {
    logDecision(makeConfig({ auditAllowDecisions: false }), makeInput(), makeResult('deny'), 5, false);
    expect(readLog()).toHaveLength(1);
  });
});

describe('rotation', () => {
  it('does not rotate when file is under 5MB', () => {
    writeFileSync(logPath, 'x'.repeat(1000));
    logDecision(makeConfig(), makeInput(), makeResult('ask'), 5, false);
    expect(existsSync(logPath + '.1')).toBe(false);
    const content = readFileSync(logPath, 'utf-8');
    expect(content.startsWith('x'.repeat(1000))).toBe(true);
  });

  it('rotates when file is at 5MB', () => {
    writeFileSync(logPath, 'x'.repeat(5 * 1024 * 1024));
    logDecision(makeConfig(), makeInput(), makeResult('ask'), 5, false);
    expect(existsSync(logPath + '.1')).toBe(true);
    const rotated = readFileSync(logPath + '.1', 'utf-8');
    expect(rotated).toHaveLength(5 * 1024 * 1024);
    const current = readFileSync(logPath, 'utf-8');
    expect(current.length).toBeLessThan(1000);
  });

  it('overwrites existing .1 file on rotation', () => {
    writeFileSync(logPath + '.1', 'old backup');
    writeFileSync(logPath, 'x'.repeat(5 * 1024 * 1024));
    logDecision(makeConfig(), makeInput(), makeResult('ask'), 5, false);
    const rotated = readFileSync(logPath + '.1', 'utf-8');
    expect(rotated).not.toBe('old backup');
  });
});

describe('error handling', () => {
  it('does not crash on invalid path', () => {
    const config = makeConfig({ auditPath: '/nonexistent/deeply/nested/path/audit.jsonl' });
    expect(() => logDecision(config, makeInput(), makeResult('ask'), 5, false)).not.toThrow();
  });
});
