import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { checkConfigHealth, checkAuditWritable, checkPipelineProbe, checkVersionSync } from '../diagnose';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DiagnoseEnv } from '../diagnose';

function makeEnv(root: string): DiagnoseEnv {
  return { home: root, cwd: root, repoRoot: root };
}

function writeFile(dir: string, relpath: string, content: string): void {
  const full = join(dir, relpath);
  mkdirSync(join(dir, relpath, '..'), { recursive: true });
  writeFileSync(full, content);
}

function writeJson(dir: string, relpath: string, obj: unknown): void {
  const full = join(dir, relpath);
  mkdirSync(join(dir, relpath, '..'), { recursive: true });
  writeFileSync(full, JSON.stringify(obj));
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

// ---------------------------------------------------------------------------
// checkConfigHealth
// ---------------------------------------------------------------------------

let originalHome: string | undefined;

describe('checkConfigHealth', () => {
  beforeEach(() => {
    originalHome = process.env.HOME;
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
  });

  it('returns id config-health', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const result = checkConfigHealth(makeEnv(root));
    expect(result.id).toBe('config-health');
  });

  it('passes when no config files are present', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const result = checkConfigHealth(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('passes when a fully valid project config is present', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    writeFile(root, join('.claude', 'warden.yaml'), 'defaultDecision: ask\n');
    const result = checkConfigHealth(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('fails when project config has a parse error (malformed YAML)', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    // malformed YAML triggers a parse error
    writeFile(root, join('.claude', 'warden.yaml'), ':\n  - [unclosed');
    const result = checkConfigHealth(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('parse-error prefix "failed to parse config " is load-bearing — detail must reference it', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    writeFile(root, join('.claude', 'warden.yaml'), 'key: : :');
    const result = checkConfigHealth(makeEnv(root));
    expect(result.status).toBe('fail');
    // The detail must mention the literal prefix that couples tests to the config loader contract
    expect(result.detail).toContain('failed to parse config ');
  });

  it('warns (not fails) for unknown top-level keys in an otherwise-valid YAML', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    writeFile(root, join('.claude', 'warden.yaml'), 'bogusKey: true\n');
    const result = checkConfigHealth(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.fix).toBeTruthy();
  });

  it('a naive impl returning warn for parse errors fails this test — status must be fail not warn', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    writeFile(root, join('.claude', 'warden.yaml'), ':\n  - [unclosed');
    const result = checkConfigHealth(makeEnv(root));
    // explicitly assert fail, not warn — catches the naive impl
    expect(result.status).toBe('fail');
    expect(result.status).not.toBe('warn');
  });

  // NOTE: the USER-config HOME seam (a parse error / warning in <HOME>/.claude/warden.yaml)
  // is not unit-testable in-process. rules.ts computes USER_CONFIG_PATHS as a module-level const
  // (`join(homedir(), '.claude', 'warden.yaml')`) evaluated once at import, so reassigning
  // process.env.HOME at runtime does not change which user config loadConfig reads — and the
  // design forbids modifying rules.ts. The project-config parse-error / unknown-key tests above
  // cover config-health's warning-partitioning logic in-process; the user-config/HOME seam is
  // validated across the subprocess boundary by the diagnose CLI integration tests (cli.test.ts),
  // which set HOME before spawning the built CLI.

  it('warn detail names the file and message', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    writeFile(root, join('.claude', 'warden.yaml'), 'bogusKey: true\n');
    const result = checkConfigHealth(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.detail).toBeTruthy();
    expect(result.detail.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// checkAuditWritable
// ---------------------------------------------------------------------------

let savedHome: string | undefined;

describe('checkAuditWritable', () => {
  beforeEach(() => {
    savedHome = process.env.HOME;
  });

  afterEach(() => {
    if (savedHome !== undefined) {
      process.env.HOME = savedHome;
    } else {
      delete process.env.HOME;
    }
  });

  it('returns id audit-writable', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const result = checkAuditWritable(makeEnv(root));
    expect(result.id).toBe('audit-writable');
  });

  it('passes when the configured audit directory exists and is writable', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const auditDir = join(root, 'audit');
    mkdirSync(auditDir, { recursive: true });
    writeFile(root, join('.claude', 'warden.yaml'), `auditPath: ${join(auditDir, 'warden-audit.jsonl')}\n`);
    const result = checkAuditWritable(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.status).not.toBe('warn');
    expect(result.status).not.toBe('fail');
  });

  it('fails when the configured audit directory exists but is not writable', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const auditDir = join(root, 'audit-ro');
    mkdirSync(auditDir, { recursive: true });
    writeFile(root, join('.claude', 'warden.yaml'), `auditPath: ${join(auditDir, 'warden-audit.jsonl')}\n`);
    chmodSync(auditDir, 0o555);
    let result;
    try {
      result = checkAuditWritable(makeEnv(root));
    } finally {
      chmodSync(auditDir, 0o755);
    }
    expect(result!.status).toBe('fail');
    expect(result!.status).not.toBe('pass');
    expect(result!.fix).toBeTruthy();
  });

  it('warns when the configured audit directory does not exist', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const missingDir = join(root, 'nonexistent', 'subdir');
    writeFile(root, join('.claude', 'warden.yaml'), `auditPath: ${join(missingDir, 'warden-audit.jsonl')}\n`);
    const result = checkAuditWritable(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.status).not.toBe('pass');
    expect(result.status).not.toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('a naive impl returning pass for a missing dir fails this test', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    const missingDir = join(root, 'definitely-absent');
    writeFile(root, join('.claude', 'warden.yaml'), `auditPath: ${join(missingDir, 'warden-audit.jsonl')}\n`);
    const result = checkAuditWritable(makeEnv(root));
    expect(result.status).not.toBe('pass');
  });

  it('warns (not pass) when the audit directory path is a regular file, not a directory', () => {
    const root = tmpRoot();
    process.env.HOME = root;
    // Create a regular FILE where the "audit dir" should be
    const auditParent = join(root, 'audit-parent');
    mkdirSync(auditParent, { recursive: true });
    const auditDirAsFile = join(auditParent, 'audit-dir-is-file');
    writeFileSync(auditDirAsFile, 'not a directory');
    // Point auditPath so that dirname(auditPath) == auditDirAsFile (a regular file)
    writeFile(root, join('.claude', 'warden.yaml'), `auditPath: ${join(auditDirAsFile, 'warden-audit.jsonl')}\n`);
    const result = checkAuditWritable(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// checkPipelineProbe
// ---------------------------------------------------------------------------

describe('checkPipelineProbe', () => {
  it('returns id pipeline-probe', () => {
    const root = tmpRoot();
    const result = checkPipelineProbe(makeEnv(root));
    expect(result.id).toBe('pipeline-probe');
  });

  it('passes when the in-process pipeline allows a benign echo command against default config', () => {
    const root = tmpRoot();
    const result = checkPipelineProbe(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.status).not.toBe('fail');
  });

  it('detail is a non-empty string', () => {
    const root = tmpRoot();
    const result = checkPipelineProbe(makeEnv(root));
    expect(typeof result.detail).toBe('string');
    expect(result.detail.length).toBeGreaterThan(0);
  });

  it('is not affected by missing fixture files — exercises in-process wiring only', () => {
    // A fresh tmpdir with no config files at all should still pass
    const root = tmpRoot();
    const result = checkPipelineProbe(makeEnv(root));
    expect(result.status).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// checkVersionSync
// ---------------------------------------------------------------------------

describe('checkVersionSync', () => {
  it('returns id version-sync', () => {
    const root = tmpRoot();
    const result = checkVersionSync(makeEnv(root));
    expect(result.id).toBe('version-sync');
  });

  it('skips when no package.json is present (not a warden tree)', () => {
    const root = tmpRoot();
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('skip');
    expect(result.status).not.toBe('pass');
    expect(result.status).not.toBe('fail');
  });

  it('passes when only package.json stamp is present and has a valid version', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '1.2.3' });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.status).not.toBe('skip');
    expect(result.detail).toContain('1.2.3');
  });

  it('passes when package.json and plugin.json agree', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '2.0.0' });
    writeJson(root, join('.claude-plugin', 'plugin.json'), { version: '2.0.0' });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('passes when all three stamps agree', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '3.1.0' });
    writeJson(root, join('.claude-plugin', 'plugin.json'), { version: '3.1.0' });
    writeJson(root, join('.claude-plugin', 'marketplace.json'), { plugins: [{ name: 'warden', version: '3.1.0' }] });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('warns when package.json and plugin.json disagree', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '1.0.0' });
    writeJson(root, join('.claude-plugin', 'plugin.json'), { version: '2.0.0' });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
  });

  it('warn detail names each stamp and value when versions differ', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '1.0.0' });
    writeJson(root, join('.claude-plugin', 'plugin.json'), { version: '2.0.0' });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('1.0.0');
    expect(result.detail).toContain('2.0.0');
  });

  it('warns when marketplace.json disagrees with package.json', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '1.0.0' });
    writeJson(root, join('.claude-plugin', 'marketplace.json'), { plugins: [{ name: 'warden', version: '9.9.9' }] });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('warn');
    expect(result.fix).toBeTruthy();
    expect(result.detail).toContain('9.9.9');
  });

  it('absent stamp files are silently omitted and do not fail the check', () => {
    // Only package.json present — no plugin.json, no marketplace.json
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '4.0.0' });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.status).not.toBe('skip');
    expect(result.status).not.toBe('fail');
  });

  it('pass detail lists each present stamp and its value', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '5.0.0' });
    writeJson(root, join('.claude-plugin', 'plugin.json'), { version: '5.0.0' });
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('5.0.0');
  });

  it('returns unknown (never a false pass) when a present stamp file is unparseable', () => {
    // A valid package.json + plugin.json that agree, plus a CORRUPT marketplace.json,
    // must NOT report pass — the corrupt stamp could not be inspected (fail-loud).
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden', version: '1.0.0' });
    writeJson(root, join('.claude-plugin', 'plugin.json'), { version: '1.0.0' });
    writeFile(root, join('.claude-plugin', 'marketplace.json'), '{ not valid json');
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
    expect(result.detail).toContain('marketplace.json');
  });

  it('returns unknown (not skip) when package.json itself is present but unparseable', () => {
    const root = tmpRoot();
    writeFile(root, 'package.json', '{ corrupt');
    const result = checkVersionSync(makeEnv(root));
    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('skip');
    expect(result.fix).toBeTruthy();
  });
});
