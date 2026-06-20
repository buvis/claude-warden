import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';

const HOOK_BIN = resolve(__dirname, '../../dist/index.cjs');

function runHook(input: object, home: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [HOOK_BIN], {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', exitCode: err.status ?? 1 };
  }
}

describe('SessionStart config-health note', () => {
  it('appends config note to guidance when config has unknown keys', () => {
    const home = mkdtempSync(join(tmpdir(), 'warden-sshome-'));
    const ws = mkdtempSync(join(tmpdir(), 'warden-ssws-'));
    try {
      mkdirSync(join(ws, '.claude'), { recursive: true });
      writeFileSync(join(ws, '.claude', 'warden.yaml'), 'alwaysAlow:\n  - foo\n');

      const { stdout } = runHook(
        { hook_event_name: 'SessionStart', session_id: 's1', cwd: ws, source: 'startup' },
        home,
      );

      const output = JSON.parse(stdout);
      const ctx: string = output.hookSpecificOutput.additionalContext;

      expect(ctx).toContain('Claude Warden is active.');
      expect(ctx).toContain('[warden] config:');
      expect(ctx).toContain('warden validate');
      expect(ctx).toContain('alwaysAlow');
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it('does not append config note when config is clean', () => {
    const home = mkdtempSync(join(tmpdir(), 'warden-sshome-'));
    const ws = mkdtempSync(join(tmpdir(), 'warden-ssws-'));
    try {
      mkdirSync(join(ws, '.claude'), { recursive: true });
      writeFileSync(join(ws, '.claude', 'warden.yaml'), 'rules:\n  - command: git\n    default: allow\n');

      const { stdout } = runHook(
        { hook_event_name: 'SessionStart', session_id: 's1', cwd: ws, source: 'startup' },
        home,
      );

      const output = JSON.parse(stdout);
      const ctx: string = output.hookSpecificOutput.additionalContext;

      expect(ctx).toContain('Claude Warden is active.');
      expect(ctx).not.toContain('[warden] config:');
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it('injects nothing at all when sessionGuidance is false, even with config warnings', () => {
    const home = mkdtempSync(join(tmpdir(), 'warden-sshome-'));
    const ws = mkdtempSync(join(tmpdir(), 'warden-ssws-'));
    try {
      mkdirSync(join(ws, '.claude'), { recursive: true });
      writeFileSync(
        join(ws, '.claude', 'warden.yaml'),
        'sessionGuidance: false\nalwaysAlow:\n  - foo\n',
      );

      const { stdout, exitCode } = runHook(
        { hook_event_name: 'SessionStart', session_id: 's1', cwd: ws, source: 'startup' },
        home,
      );

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('');
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it('never carries the config note on the PreToolUse path', () => {
    const home = mkdtempSync(join(tmpdir(), 'warden-sshome-'));
    const ws = mkdtempSync(join(tmpdir(), 'warden-ssws-'));
    try {
      mkdirSync(join(ws, '.claude'), { recursive: true });
      writeFileSync(join(ws, '.claude', 'warden.yaml'), 'alwaysAlow:\n  - foo\n');

      const { stdout } = runHook(
        {
          hook_event_name: 'PreToolUse',
          session_id: 's1',
          tool_name: 'Bash',
          tool_input: { command: 'ls -la' },
          cwd: ws,
          permission_mode: 'default',
        },
        home,
      );

      const output = JSON.parse(stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('allow');
      expect(stdout).not.toContain('[warden] config:');
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
