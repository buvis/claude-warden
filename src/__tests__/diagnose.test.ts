import { describe, it, expect, afterEach } from 'vitest';
import { checkNativePermissions, runDiagnostics } from '../diagnose';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DiagnoseEnv } from '../diagnose';

function makeEnv(root: string): DiagnoseEnv {
  return { home: root, cwd: root, repoRoot: root };
}

function writeSettings(dir: string, filename: string, content: object): void {
  const dotClaude = join(dir, '.claude');
  mkdirSync(dotClaude, { recursive: true });
  writeFileSync(join(dotClaude, filename), JSON.stringify(content));
}

const dirs: string[] = [];

function tmpRoot(): string {
  const d = mkdtempSync(join(tmpdir(), 'warden-diagnose-'));
  dirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe('checkNativePermissions', () => {
  it('returns id native-permissions', () => {
    const root = tmpRoot();
    const result = checkNativePermissions(makeEnv(root));
    expect(result.id).toBe('native-permissions');
  });

  it('passes when all settings files are absent', () => {
    const root = tmpRoot();
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('passes when settings files exist but contain no Bash entries', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { deny: ['git'], allow: ['ls'] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('fails when bare Bash string is in deny', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { deny: ['Bash'], allow: [] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('settings.json');
    expect(result.detail).toContain('Bash');
    expect(result.fix).toBeTruthy();
  });

  it('fails when Bash(rm:*) is in deny — names the file and entry', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { deny: ['Bash(rm:*)'], allow: [] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain(join(root, '.claude', 'settings.json'));
    expect(result.detail).toContain('Bash(rm:*)');
    expect(result.fix).toBeTruthy();
  });

  it('fails when Bash(*) is in ask', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { ask: ['Bash(*)'], deny: [] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('Bash(*)');
    expect(result.fix).toBeTruthy();
  });

  it('returns info for Bash(*) in allow only', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { allow: ['Bash(*)'] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('info');
    expect(result.detail).toContain('Bash(*)');
  });

  it('returns info for narrow Bash(rm:*) in allow only', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { allow: ['Bash(rm:*)'] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('info');
    expect(result.detail).toContain('Bash(rm:*)');
  });

  it('returns unknown when a settings file has unparseable JSON — not pass', () => {
    const root = tmpRoot();
    const dotClaude = join(root, '.claude');
    mkdirSync(dotClaude, { recursive: true });
    writeFileSync(join(dotClaude, 'settings.json'), '{not valid json{{');
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('unknown');
    expect(result.fix).toBeTruthy();
  });

  it('returns unknown (not fail) when one file is unparseable and another has deny', () => {
    // A naive impl that ignores parse errors and returns 'fail' is caught here
    // because the contract says an unparseable file flips the whole check to 'unknown'.
    // A naive impl that ignores parse errors and returns 'pass' also fails.
    const homeDir = tmpRoot();
    const projectDir = tmpRoot();
    const homeDotClaude = join(homeDir, '.claude');
    mkdirSync(homeDotClaude, { recursive: true });
    writeFileSync(join(homeDotClaude, 'settings.json'), 'INVALID');
    writeSettings(projectDir, 'settings.json', { permissions: { deny: ['Bash(rm:*)'] } });
    const env: DiagnoseEnv = { home: homeDir, cwd: projectDir, repoRoot: projectDir };
    const result = checkNativePermissions(env);
    expect(result.status).toBe('unknown');
    expect(result.fix).toBeTruthy();
  });

  it('reads project-local settings.local.json in addition to settings.json', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { allow: ['ls'] } });
    writeSettings(root, 'settings.local.json', { permissions: { deny: ['Bash(git:*)'] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('settings.local.json');
    expect(result.detail).toContain('Bash(git:*)');
  });

  it('names all offending files when multiple files have deny entries', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { deny: ['Bash(rm:*)'] } });
    writeSettings(root, 'settings.local.json', { permissions: { deny: ['Bash(*)'] } });
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('settings.json');
    expect(result.detail).toContain('settings.local.json');
  });
});

describe('runDiagnostics', () => {
  it('includes a native-permissions entry', () => {
    const root = tmpRoot();
    const results = runDiagnostics(makeEnv(root));
    const entry = results.find((r) => r.id === 'native-permissions');
    expect(entry).toBeDefined();
  });

  it('is deterministic — same fixture produces deep-equal results on two calls', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { deny: ['Bash(rm:*)'] } });
    const env = makeEnv(root);
    const first = runDiagnostics(env);
    const second = runDiagnostics(env);
    expect(first).toEqual(second);
  });

  it('returns an array with at least one CheckResult', () => {
    const root = tmpRoot();
    const results = runDiagnostics(makeEnv(root));
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('each CheckResult has id, status, and detail fields', () => {
    const root = tmpRoot();
    const results = runDiagnostics(makeEnv(root));
    for (const r of results) {
      expect(typeof r.id).toBe('string');
      expect(r.id.length).toBeGreaterThan(0);
      expect(['pass', 'fail', 'warn', 'info', 'skip', 'unknown']).toContain(r.status);
      expect(typeof r.detail).toBe('string');
    }
  });

  it('fail and warn and unknown results carry a non-empty fix field', () => {
    const root = tmpRoot();
    writeSettings(root, 'settings.json', { permissions: { deny: ['Bash'] } });
    const results = runDiagnostics(makeEnv(root));
    for (const r of results) {
      if (r.status === 'fail' || r.status === 'warn' || r.status === 'unknown') {
        expect(typeof r.fix).toBe('string');
        expect((r.fix as string).length).toBeGreaterThan(0);
      }
    }
  });
});
