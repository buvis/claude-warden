import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const COPILOT_BIN = resolve(__dirname, '../../dist/copilot.cjs');

function copilot(toolName: string, command: string): { stdout: string; exitCode: number } {
  const input = JSON.stringify({
    timestamp: Date.now(),
    cwd: process.cwd(),
    toolName,
    toolArgs: JSON.stringify({ command }),
  });
  try {
    const stdout = execFileSync(process.execPath, [COPILOT_BIN], {
      input,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', exitCode: err.status ?? 1 };
  }
}

function parseCopilotOutput(stdout: string) {
  return JSON.parse(stdout) as {
    permissionDecision: string;
    permissionDecisionReason: string;
  };
}

describe('Copilot CLI adapter', () => {
  it('allows safe bash commands', () => {
    const { stdout, exitCode } = copilot('bash', 'ls -la');
    expect(exitCode).toBe(0);
    const output = parseCopilotOutput(stdout);
    expect(output.permissionDecision).toBe('allow');
    expect(output.permissionDecisionReason).toContain('[warden]');
  });

  it('denies dangerous bash commands', () => {
    const { stdout, exitCode } = copilot('bash', 'shutdown -h now');
    expect(exitCode).toBe(0);
    const output = parseCopilotOutput(stdout);
    expect(output.permissionDecision).toBe('deny');
  });

  it('handles pipelines', () => {
    const { stdout } = copilot('bash', 'cat file | grep pattern | wc -l');
    const output = parseCopilotOutput(stdout);
    expect(output.permissionDecision).toBe('allow');
  });

  it('ignores non-bash tools', () => {
    const { stdout, exitCode } = copilot('edit', 'anything');
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  it('outputs flat JSON (not nested like Claude Code)', () => {
    const { stdout } = copilot('bash', 'ls');
    const output = JSON.parse(stdout);
    // Should NOT have hookSpecificOutput wrapper
    expect(output.hookSpecificOutput).toBeUndefined();
    expect(output.permissionDecision).toBeDefined();
    expect(output.permissionDecisionReason).toBeDefined();
  });
});
