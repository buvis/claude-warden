import { describe, it, expect, afterEach } from 'vitest';
import { checkNativePermissions, runDiagnostics, checkHookRegistration, checkBinary } from '../diagnose';
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

  it('unknown detail includes both the shadowing deny entry and the unparseable file path', () => {
    // Criterion 1: a naive impl that drops shadowing entries from the unknown detail would pass
    // the status check alone. This test binds to both pieces of required information.
    const homeDir = tmpRoot();
    const projectDir = tmpRoot();
    const homeDotClaude = join(homeDir, '.claude');
    mkdirSync(homeDotClaude, { recursive: true });
    writeFileSync(join(homeDotClaude, 'settings.json'), 'INVALID');
    writeSettings(projectDir, 'settings.json', { permissions: { deny: ['Bash(rm:*)'] } });
    const env: DiagnoseEnv = { home: homeDir, cwd: projectDir, repoRoot: projectDir };
    const result = checkNativePermissions(env);
    expect(result.status).toBe('unknown');
    expect(result.detail).toContain('Bash(rm:*)');
    expect(result.detail).toContain(join(homeDotClaude, 'settings.json'));
    expect(result.fix).toBeTruthy();
  });

  it('names all unparseable files in detail when two different files have invalid JSON', () => {
    // Criterion 2: a naive impl that names only the last unparseable file fails here.
    const root = tmpRoot();
    const dotClaude = join(root, '.claude');
    mkdirSync(dotClaude, { recursive: true });
    writeFileSync(join(dotClaude, 'settings.json'), 'NOT JSON');
    writeFileSync(join(dotClaude, 'settings.local.json'), 'ALSO NOT JSON');
    const result = checkNativePermissions(makeEnv(root));
    expect(result.status).toBe('unknown');
    expect(result.detail).toContain(join(dotClaude, 'settings.json'));
    expect(result.detail).toContain(join(dotClaude, 'settings.local.json'));
    expect(result.fix).toBeTruthy();
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

  it('prefers the executing checkout over an unrelated installed cache', () => {
    // Finding 2: when repoRoot IS a Warden source checkout with a valid hooks.json,
    // the diagnostics must describe the EXECUTING checkout (repoRoot), not the
    // unrelated installed cache entry.
    const home = tmpRoot();
    const repoRoot = tmpRoot(); // separate from home so paths are distinguishable
    const pluginDir = tmpRoot(); // unrelated installed cache — different from repoRoot

    // Valid dev checkout at repoRoot with a passing hooks.json
    writeJson(repoRoot, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(repoRoot, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));

    // Registry entry pointing at a different, unrelated directory
    writeJson(home, join('.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'warden@https://marketplace.example.com': [{ installPath: pluginDir }],
      },
    });

    const env: DiagnoseEnv = { home, cwd: home, repoRoot };
    const result = checkHookRegistration(env);

    // Executing checkout wins: result describes repoRoot, not the unrelated pluginDir
    expect(result.status).toBe('pass');
    expect(result.detail).toContain(repoRoot);
    expect(result.detail).not.toContain(pluginDir);
  });

  it('returns unknown when registry has a stale warden entry (installPath does not exist)', () => {
    // Finding 4: a registry entry whose installPath is missing/nonexistent is stale.
    // The check must return unknown — even when repoRoot is a valid dev checkout
    // that would otherwise pass, to prevent a silent false-pass fallthrough.
    const home = tmpRoot();
    const repoRoot = tmpRoot();

    // Valid dev checkout at repoRoot — a silent fallthrough would return 'pass'
    writeJson(repoRoot, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(repoRoot, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"'));

    // Registry with a warden entry pointing at a nonexistent path (stale)
    const nonexistentPath = join(home, 'does-not-exist', 'warden-plugin');
    writeJson(home, join('.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'warden@https://marketplace.example.com': [{ installPath: nonexistentPath }],
      },
    });

    const env: DiagnoseEnv = { home, cwd: home, repoRoot };
    const result = checkHookRegistration(env);

    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('pass'); // must not silently fall through to dev-checkout
    expect(result.fix).toBeTruthy();
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

  it.skipIf(process.getuid?.() === 0)('returns unknown (not dev-checkout fallback) when installed_plugins.json is unreadable (EACCES)', () => {
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

  it('fails when the Bash hook type is not command even though command contains dist/index.cjs', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(root, join('hooks', 'hooks.json'), {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'notification', command: 'node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs"' }] },
        ],
      },
    });
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
  });

  it('fails when the hook command targets dist/index.cjs.bak instead of dist/index.cjs', () => {
    const root = tmpRoot();
    writeJson(root, 'package.json', { name: '@buvis/claude-warden' });
    writeJson(root, join('hooks', 'hooks.json'), makeHooksJson('node "${CLAUDE_PLUGIN_ROOT}/dist/index.cjs.bak"'));
    const result = checkHookRegistration(makeEnv(root));
    expect(result.status).toBe('fail');
    expect(result.status).not.toBe('pass');
    expect(result.fix).toBeTruthy();
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

  it.skipIf(process.getuid?.() === 0)('returns unknown (not dev-checkout fallback) when installed_plugins.json is unreadable (EACCES)', () => {
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

  it.skipIf(process.getuid?.() === 0)('returns unknown (not fail) when the dist/ directory is untraversable (EACCES on statSync)', () => {
    // Fix 2: a statSync inspection error (EACCES) must yield 'unknown', not 'fail'.
    // statSync throws EACCES when the parent directory lacks execute permission.
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
