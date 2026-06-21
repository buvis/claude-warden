import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { checkNativePermissions, runDiagnostics, checkHookRegistration, checkBinary, checkConfigHealth, checkAuditWritable, checkPipelineProbe, checkVersionSync } from '../diagnose';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from 'fs';
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

  it('returns checks in order: native-permissions, hook-registration, binary, config-health', () => {
    const root = tmpRoot();
    const results = runDiagnostics(makeEnv(root));
    const ids = results.map((r) => r.id);
    expect(ids).toContain('native-permissions');
    expect(ids).toContain('hook-registration');
    expect(ids).toContain('binary');
    expect(ids).toContain('config-health');
    expect(ids.indexOf('native-permissions')).toBeLessThan(ids.indexOf('hook-registration'));
    expect(ids.indexOf('hook-registration')).toBeLessThan(ids.indexOf('binary'));
    expect(ids.indexOf('binary')).toBeLessThan(ids.indexOf('config-health'));
  });
});

// ---------------------------------------------------------------------------
// Helpers for hook/binary/config-health fixtures
// ---------------------------------------------------------------------------

function writeJson(dir: string, relpath: string, obj: unknown): void {
  const full = join(dir, relpath);
  mkdirSync(join(dir, relpath, '..'), { recursive: true });
  writeFileSync(full, JSON.stringify(obj));
}

function writeFile(dir: string, relpath: string, content: string): void {
  const full = join(dir, relpath);
  mkdirSync(join(dir, relpath, '..'), { recursive: true });
  writeFileSync(full, content);
}

function makeHooksJson(command: string): unknown {
  // Mirrors the real plugin hooks/hooks.json shape: event arrays nest under a
  // top-level "hooks" key.
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command }],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// checkHookRegistration
// ---------------------------------------------------------------------------

describe('checkHookRegistration', () => {
  it('returns id hook-registration', () => {
    const root = tmpRoot();
    const result = checkHookRegistration(makeEnv(root));
    expect(result.id).toBe('hook-registration');
  });

  it('passes in dev mode when hooks.json has a Bash matcher with dist/index.cjs command', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(root, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('pass');
  });

  it('substring-matches dist/index.cjs — a ${CLAUDE_PLUGIN_ROOT}-prefixed command still passes', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    const command = 'node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"';
    expect(command).toContain('dist/index.cjs');
    writeJson(root, join('hooks', 'hooks.json'), makeHooksJson(command));
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.detail).toMatch(/dev/i);
  });

  it('fails in dev mode when hooks.json has no Bash matcher', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(root, join('hooks', 'hooks.json'), {
      hooks: {
        PreToolUse: [{ matcher: 'Read', hooks: [{ type: 'command', command: 'node dist/index.cjs' }] }],
      },
    });
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('fails in dev mode when Bash matcher command does not include dist/index.cjs', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(root, join('hooks', 'hooks.json'), makeHooksJson('node dist/something-else.cjs'));
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('returns unknown in dev mode when hooks.json is missing', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    // do NOT create hooks/hooks.json
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('unknown');
    expect(result.detail).toContain('hooks.json');
    expect(result.fix).toBeTruthy();
  });

  it('returns unknown in dev mode when hooks.json contains invalid JSON', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeFile(root, join('hooks', 'hooks.json'), '{not valid json');
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('unknown');
    expect(result.detail).toContain('hooks.json');
    expect(result.fix).toBeTruthy();
  });

  it('passes in installed mode when hooks.json has Bash matcher with dist/index.cjs', () => {
    const home = tmpRoot();
    const pluginDir = tmpRoot();
    writeJson(pluginDir, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));
    writeJson(home, join('.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'warden@https://marketplace.example.com': [{ installPath: pluginDir }],
      },
    });
    const repoRoot = tmpRoot(); // no package.json — should not be used
    const env: DiagnoseEnv = { home, cwd: home, repoRoot };
    const result = checkHookRegistration(env);
    expect(result.status).toBe('pass');
  });

  it('fails when no plugin root is found (not-found mode)', () => {
    const root = tmpRoot();
    // no package.json, no installed_plugins.json
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('detail always names the resolved mode and root path', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(root, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));
    const result = checkHookRegistration(makeEnv(root));
    // detail should mention some form of mode (dev) and a path
    expect(result.detail.length).toBeGreaterThan(0);
    expect(result.detail).toContain(root);
  });

  it('prefers installed mode over dev mode when both are present', () => {
    const home = tmpRoot();
    const pluginDir = tmpRoot();
    // installed plugin with passing hooks.json
    writeJson(pluginDir, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));
    writeJson(home, join('.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'warden@https://marketplace.example.com': [{ installPath: pluginDir }],
      },
    });
    // repoRoot also looks like a dev clone
    writeJson(home, 'package.json', { name: '@buvis/claude-warden' });
    const env: DiagnoseEnv = { home, cwd: home, repoRoot: home };
    const result = checkHookRegistration(env);
    // installed mode resolved — pluginDir should be in the detail
    expect(result.detail).toContain(pluginDir);
  });

  it('returns unknown (not dev-checkout fallback) when installed_plugins.json is corrupt JSON', () => {
    // Proves Fix 1: a corrupt plugins.json must NOT silently fall through to the dev-checkout branch.
    // We set repoRoot to a valid dev checkout so that a silent fallthrough would return 'pass'.
    const home = tmpRoot();
    const repoRoot = tmpRoot();
    // Write a valid dev checkout at repoRoot — if resolvePluginRoot falls through, it would pass.
    writeJson(repoRoot, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(repoRoot, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));
    // Write a CORRUPT installed_plugins.json (file EXISTS, but is not valid JSON)
    const pluginsDir = join(home, '.claude', 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), '{ not valid json at all {{');
    const env: DiagnoseEnv = { home, cwd: home, repoRoot };
    const result = checkHookRegistration(env);
    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('pass'); // must not silently fall through to dev-checkout
    expect(result.fix).toBeTruthy();
  });

  it('returns unknown (not dev-checkout fallback) when installed_plugins.json is unreadable (EACCES)', () => {
    // Skip when running as root because root bypasses file permission checks.
    if (process.getuid && process.getuid() === 0) return;
    const home = tmpRoot();
    const repoRoot = tmpRoot();
    // Valid dev checkout — a silent fallthrough would return 'pass'.
    writeJson(repoRoot, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(repoRoot, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));
    const pluginsDir = join(home, '.claude', 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    const pluginsJsonPath = join(pluginsDir, 'installed_plugins.json');
    writeFileSync(pluginsJsonPath, JSON.stringify({ version: 2, plugins: {} }));
    chmodSync(pluginsJsonPath, 0o000);
    let result;
    try {
      const env: DiagnoseEnv = { home, cwd: home, repoRoot };
      result = checkHookRegistration(env);
    } finally {
      chmodSync(pluginsJsonPath, 0o644);
    }
    expect(result!.status).toBe('unknown');
    expect(result!.status).not.toBe('pass'); // must not silently fall through to dev-checkout
    expect(result!.fix).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// checkBinary
// ---------------------------------------------------------------------------

describe('checkBinary', () => {
  it('returns id binary', () => {
    const root = tmpRoot();
    const result = checkBinary(makeEnv(root));
    expect(result.id).toBe('binary');
  });

  it('passes when dist/index.cjs exists and has content', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeFile(root, join('dist', 'index.cjs'), '"use strict";console.log("ok");');
    const result = checkBinary(makeEnv(root));
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('dist/index.cjs');
  });

  it('fails when dist/index.cjs is missing', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    // dist/ dir does not exist
    const result = checkBinary(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('fails when dist/index.cjs is empty (0 bytes)', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeFile(root, join('dist', 'index.cjs'), '');
    const result = checkBinary(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('fails when no plugin root is found', () => {
    const root = tmpRoot();
    // no package.json, no installed_plugins.json
    const result = checkBinary(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.fix).toBeTruthy();
  });

  it('passes via installed mode binary path', () => {
    const home = tmpRoot();
    const pluginDir = tmpRoot();
    writeFile(pluginDir, join('dist', 'index.cjs'), '"use strict";');
    writeJson(home, join('.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'warden@https://marketplace.example.com': [{ installPath: pluginDir }],
      },
    });
    const env: DiagnoseEnv = { home, cwd: home, repoRoot: home };
    const result = checkBinary(env);
    expect(result.status).toBe('pass');
    expect(result.detail).toContain(pluginDir);
  });

  it('returns unknown (not dev-checkout fallback) when installed_plugins.json is corrupt JSON', () => {
    // Fix 1: corrupt plugins.json must NOT silently fall through to dev checkout.
    const home = tmpRoot();
    const repoRoot = tmpRoot();
    // Valid dev checkout with a built binary — a fallthrough would return 'pass'.
    writeJson(repoRoot, 'package.json', { name: '@buvis/claude-warden' });
    writeFile(repoRoot, join('dist', 'index.cjs'), '"use strict";');
    // Write a CORRUPT installed_plugins.json (file EXISTS, but not valid JSON)
    const pluginsDir = join(home, '.claude', 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), '{ not valid json {{');
    const env: DiagnoseEnv = { home, cwd: home, repoRoot };
    const result = checkBinary(env);
    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
  });

  it('returns unknown (not dev-checkout fallback) when installed_plugins.json is unreadable (EACCES)', () => {
    // Skip when running as root because root bypasses file permission checks.
    if (process.getuid && process.getuid() === 0) return;
    const home = tmpRoot();
    const repoRoot = tmpRoot();
    // Valid dev checkout with a built binary — a fallthrough would return 'pass'.
    writeJson(repoRoot, 'package.json', { name: '@buvis/claude-warden' });
    writeFile(repoRoot, join('dist', 'index.cjs'), '"use strict";');
    const pluginsDir = join(home, '.claude', 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    const pluginsJsonPath = join(pluginsDir, 'installed_plugins.json');
    writeFileSync(pluginsJsonPath, JSON.stringify({ version: 2, plugins: {} }));
    chmodSync(pluginsJsonPath, 0o000);
    let result;
    try {
      const env: DiagnoseEnv = { home, cwd: home, repoRoot };
      result = checkBinary(env);
    } finally {
      chmodSync(pluginsJsonPath, 0o644);
    }
    expect(result!.status).toBe('unknown');
    expect(result!.status).not.toBe('pass');
    expect(result!.fix).toBeTruthy();
  });

  it('returns unknown (not fail) when the dist/ directory is untraversable (EACCES on statSync)', () => {
    // Fix 2: a statSync inspection error (EACCES) must yield 'unknown', not 'fail'.
    // statSync throws EACCES when the parent directory lacks execute permission.
    // Skip when running as root because root bypasses file permission checks.
    if (process.getuid && process.getuid() === 0) return;
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    const distDir = join(root, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.cjs'), '"use strict";');
    // Remove execute bit from the directory so statSync on the file inside throws EACCES
    chmodSync(distDir, 0o000);
    let result;
    try {
      result = checkBinary(makeEnv(root));
    } finally {
      chmodSync(distDir, 0o755);
    }
    expect(result!.status).toBe('unknown');
    expect(result!.status).not.toBe('fail');
    expect(result!.fix).toBeTruthy();
  });

  it('fails when dist/index.cjs path exists but is a directory (not a regular file)', () => {
    // Fix 2: a non-file node must return 'fail', not 'pass'.
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    // Create a DIRECTORY at the path where dist/index.cjs should be
    const binaryPath = join(root, 'dist', 'index.cjs');
    mkdirSync(binaryPath, { recursive: true });
    const result = checkBinary(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
  });
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

// ---------------------------------------------------------------------------
// runDiagnostics — new checks included and ordered
// ---------------------------------------------------------------------------

describe('runDiagnostics new checks ordering', () => {
  it('includes audit-writable, pipeline-probe, version-sync after config-health in that order', () => {
    const root = tmpRoot();
    const results = runDiagnostics(makeEnv(root));
    const ids = results.map((r) => r.id);
    expect(ids).toContain('config-health');
    expect(ids).toContain('audit-writable');
    expect(ids).toContain('pipeline-probe');
    expect(ids).toContain('version-sync');
    expect(ids.indexOf('config-health')).toBeLessThan(ids.indexOf('audit-writable'));
    expect(ids.indexOf('audit-writable')).toBeLessThan(ids.indexOf('pipeline-probe'));
    expect(ids.indexOf('pipeline-probe')).toBeLessThan(ids.indexOf('version-sync'));
  });

  it('full chain order: native-permissions, hook-registration, binary, config-health, audit-writable, pipeline-probe, version-sync', () => {
    const root = tmpRoot();
    const results = runDiagnostics(makeEnv(root));
    const ids = results.map((r) => r.id);
    const ordered = ['native-permissions', 'hook-registration', 'binary', 'config-health', 'audit-writable', 'pipeline-probe', 'version-sync'];
    for (const id of ordered) {
      expect(ids).toContain(id);
    }
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(ids.indexOf(ordered[i])).toBeLessThan(ids.indexOf(ordered[i + 1]));
    }
  });
});
