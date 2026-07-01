import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';

/**
 * WARDEN_UNATTENDED: in an unattended run (e.g. the autopilot loop) there is no
 * human to answer an interactive permission prompt, so an `ask` decision blocks
 * the run forever. (Observed 2026-06-30: a subagent's `chmod +x` sat on the
 * prompt 1h51m before being denied, stranding the whole loop.) When
 * WARDEN_UNATTENDED is set, the hook converts `ask` -> `deny` so the run fails
 * fast instead of hanging. `allow` and `deny` are unchanged, so warden's catch
 * (and its allowlist escape hatch) are preserved.
 *
 * These spawn the built hook (dist/index.cjs) end-to-end with a sandboxed HOME
 * so the developer's real warden.yaml / audit log cannot skew the result.
 */
const HOOK_BIN = resolve(__dirname, '../../dist/index.cjs');

let sandboxHome: string;

beforeEach(() => {
  sandboxHome = mkdtempSync(join(tmpdir(), 'warden-unattended-'));
});

afterEach(() => {
  rmSync(sandboxHome, { recursive: true, force: true });
});

function runHook(
  command: string,
  extraEnv: Record<string, string>,
): { decision: string | undefined; exitCode: number } {
  const input = JSON.stringify({
    session_id: 'test-unattended',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    cwd: sandboxHome,
    permission_mode: 'default',
  });
  const env = {
    ...process.env,
    HOME: sandboxHome,
    USERPROFILE: sandboxHome,
    WARDEN_YOLO: '', // never let an ambient yolo skew the test
    ...extraEnv,
  };
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = execFileSync(process.execPath, [HOOK_BIN], {
      input,
      env,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    stdout = err.stdout ?? '';
    exitCode = err.status ?? 1;
  }
  let decision: string | undefined;
  try {
    decision = JSON.parse(stdout)?.hookSpecificOutput?.permissionDecision;
  } catch {
    decision = undefined;
  }
  return { decision, exitCode };
}

describe('WARDEN_UNATTENDED ask->deny gate', () => {
  // chmod +x is the exact command that deadlocked the autopilot loop.
  const ASK_CMD = 'chmod +x /tmp/example-script.sh';

  it('precondition: chmod +x asks when attended', () => {
    const { decision, exitCode } = runHook(ASK_CMD, {});
    expect(decision).toBe('ask');
    expect(exitCode).toBe(0);
  });

  it('converts ask -> deny when WARDEN_UNATTENDED=1', () => {
    const { decision, exitCode } = runHook(ASK_CMD, { WARDEN_UNATTENDED: '1' });
    expect(decision).toBe('deny');
    expect(exitCode).toBe(2);
  });

  it('accepts WARDEN_UNATTENDED=true as well', () => {
    const { decision, exitCode } = runHook(ASK_CMD, { WARDEN_UNATTENDED: 'true' });
    expect(decision).toBe('deny');
    expect(exitCode).toBe(2);
  });

  it('leaves allow untouched under WARDEN_UNATTENDED', () => {
    const { decision, exitCode } = runHook('ls -la', { WARDEN_UNATTENDED: '1' });
    expect(decision).toBe('allow');
    expect(exitCode).toBe(0);
  });

  it('leaves deny untouched under WARDEN_UNATTENDED', () => {
    const { decision, exitCode } = runHook('shutdown -h now', { WARDEN_UNATTENDED: '1' });
    expect(decision).toBe('deny');
    expect(exitCode).toBe(2);
  });
});
