import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

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
