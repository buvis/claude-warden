import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import os from 'os';
import { loadConfig, setQuiet } from './rules';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'info' | 'skip' | 'unknown';

export interface CheckResult {
  id: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

export interface DiagnoseEnv {
  home: string;
  cwd: string;
  repoRoot: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type PluginRootMode = 'installed' | 'dev' | 'not-found';
interface PluginRoot {
  mode: PluginRootMode;
  root: string;
  installPath?: string;
}

function resolvePluginRoot(env: DiagnoseEnv): PluginRoot {
  // 1. Check installed_plugins.json
  const pluginsJsonPath = join(env.home, '.claude', 'plugins', 'installed_plugins.json');
  try {
    if (existsSync(pluginsJsonPath)) {
      const raw = readFileSync(pluginsJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const plugins = (parsed as Record<string, unknown>).plugins as Record<string, unknown> | undefined;
        if (plugins && typeof plugins === 'object') {
          for (const key of Object.keys(plugins)) {
            const namePart = key.split('@')[0];
            if (namePart === 'warden') {
              const entries = plugins[key] as unknown[] | undefined;
              if (Array.isArray(entries) && entries.length > 0) {
                const first = entries[0] as Record<string, unknown>;
                const installPath = first.installPath as string | undefined;
                if (installPath && existsSync(installPath)) {
                  return { mode: 'installed', root: installPath, installPath };
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Tolerate missing/unparseable installed_plugins.json
  }

  // 2. Check dev checkout
  const pkgPath = join(env.repoRoot, 'package.json');
  try {
    if (existsSync(pkgPath)) {
      const raw = readFileSync(pkgPath, 'utf-8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name === '@buvis/claude-warden') {
        return { mode: 'dev', root: env.repoRoot };
      }
    }
  } catch {
    // ignore
  }

  // 3. Not found
  return { mode: 'not-found', root: env.repoRoot };
}

const SETTINGS_FILES = [
  (env: DiagnoseEnv) => join(env.home, '.claude', 'settings.json'),
  (env: DiagnoseEnv) => join(env.cwd, '.claude', 'settings.json'),
  (env: DiagnoseEnv) => join(env.cwd, '.claude', 'settings.local.json'),
];

function isBashEntry(entry: string): boolean {
  return entry === 'Bash' || entry.startsWith('Bash(');
}

export function checkNativePermissions(env: DiagnoseEnv): CheckResult {
  const paths = [...new Set(SETTINGS_FILES.map(fn => fn(env)))];

  let unknown = false;
  let unknownPath = '';
  const denyBash: { path: string; entry: string }[] = [];
  const askBash: { path: string; entry: string }[] = [];
  const allowBash: { path: string; entry: string }[] = [];

  for (const path of paths) {
    if (!existsSync(path)) continue;

    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) continue;
      const obj = parsed as Record<string, unknown>;
      const perms = obj.permissions as Record<string, unknown> | undefined;
      if (typeof perms !== 'object' || perms === null) continue;

      const deny = Array.isArray(perms.deny) ? perms.deny : [];
      const ask = Array.isArray(perms.ask) ? perms.ask : [];
      const allow = Array.isArray(perms.allow) ? perms.allow : [];

      for (const entry of deny) {
        if (typeof entry === 'string' && isBashEntry(entry)) {
          denyBash.push({ path, entry });
        }
      }
      for (const entry of ask) {
        if (typeof entry === 'string' && isBashEntry(entry)) {
          askBash.push({ path, entry });
        }
      }
      for (const entry of allow) {
        if (typeof entry === 'string' && isBashEntry(entry)) {
          allowBash.push({ path, entry });
        }
      }
    } catch {
      unknown = true;
      unknownPath = path;
    }
  }

  if (unknown) {
    return {
      id: 'native-permissions',
      status: 'unknown',
      detail: `Could not inspect ${unknownPath} — file could not be parsed as JSON.`,
      fix: `Fix or remove the malformed settings file at ${unknownPath}.`,
    };
  }

  if (denyBash.length > 0 || askBash.length > 0) {
    const findings = [...denyBash, ...askBash];
    const detail = findings.map(f => `${f.path}: ${f.entry}`).join('; ');
    return {
      id: 'native-permissions',
      status: 'fail',
      detail,
      fix: 'Remove these Bash entries from permissions.deny/ask — native CC permissions run before Warden\'s hook and shadow it; Warden is the single authority for Bash policy.',
    };
  }

  if (allowBash.length > 0) {
    const detail = allowBash.map(f => `${f.path}: ${f.entry}`).join('; ');
    return {
      id: 'native-permissions',
      status: 'info',
      detail,
    };
  }

  return {
    id: 'native-permissions',
    status: 'pass',
    detail: 'No Bash entries found in any settings file.',
  };
}

export function checkHookRegistration(env: DiagnoseEnv): CheckResult {
  const pr = resolvePluginRoot(env);

  if (pr.mode === 'not-found') {
    return {
      id: 'hook-registration',
      status: 'fail',
      detail: `Warden plugin not found: no installed entry in installed_plugins.json and ${pr.root} is not the warden source tree.`,
      fix: 'Install or reinstall the Warden plugin so its PreToolUse Bash hook is registered.',
    };
  }

  const hooksJsonPath = join(pr.root, 'hooks', 'hooks.json');
  let hooksData: unknown;
  try {
    const raw = readFileSync(hooksJsonPath, 'utf-8');
    hooksData = JSON.parse(raw);
  } catch {
    return {
      id: 'hook-registration',
      status: 'unknown',
      detail: `Could not inspect ${hooksJsonPath} — file could not be parsed as JSON.`,
      fix: 'Repair or reinstall the plugin so hooks/hooks.json is valid JSON.',
    };
  }

  if (hooksData && typeof hooksData === 'object') {
    const obj = hooksData as Record<string, unknown>;
    const preToolUse = obj.PreToolUse as unknown[] | undefined;
    if (Array.isArray(preToolUse)) {
      for (const entry of preToolUse) {
        if (entry && typeof entry === 'object') {
          const e = entry as Record<string, unknown>;
          if (e.matcher === 'Bash') {
            const hooks = e.hooks as unknown[] | undefined;
            if (Array.isArray(hooks)) {
              for (const h of hooks) {
                if (h && typeof h === 'object') {
                  const cmd = (h as Record<string, unknown>).command as string | undefined;
                  if (typeof cmd === 'string' && cmd.includes('dist/index.cjs')) {
                    const modeLabel = pr.mode === 'dev' ? 'dev checkout' : 'installed plugin';
                    const pathLabel = pr.mode === 'installed' && pr.installPath ? pr.installPath : pr.root;
                    return {
                      id: 'hook-registration',
                      status: 'pass',
                      detail: `${modeLabel} at ${pathLabel} — Bash hook registered with dist/index.cjs.`,
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const modeLabel = pr.mode === 'dev' ? 'dev checkout' : 'installed plugin';
  return {
    id: 'hook-registration',
    status: 'fail',
    detail: `${modeLabel} at ${pr.root}: hooks.json parsed but no Bash matcher with dist/index.cjs found.`,
    fix: 'Repair or reinstall the plugin so its PreToolUse Bash hook references dist/index.cjs.',
  };
}

export function checkBinary(env: DiagnoseEnv): CheckResult {
  const pr = resolvePluginRoot(env);

  if (pr.mode === 'not-found') {
    return {
      id: 'binary',
      status: 'fail',
      detail: `No plugin root found at ${pr.root} — cannot locate dist/index.cjs.`,
      fix: 'Install or reinstall the Warden plugin.',
    };
  }

  const binaryPath = join(pr.root, 'dist', 'index.cjs');
  try {
    const st = statSync(binaryPath);
    if (st.size > 0) {
      return {
        id: 'binary',
        status: 'pass',
        detail: `dist/index.cjs found at ${binaryPath} (${st.size} bytes).`,
      };
    }
    return {
      id: 'binary',
      status: 'fail',
      detail: `dist/index.cjs at ${binaryPath} is empty (0 bytes).`,
      fix: pr.mode === 'dev' ? 'Run "pnpm run build" to compile the plugin.' : 'Reinstall the plugin.',
    };
  } catch {
    return {
      id: 'binary',
      status: 'fail',
      detail: `dist/index.cjs not found at ${binaryPath}.`,
      fix: pr.mode === 'dev' ? 'Run "pnpm run build" to compile the plugin.' : 'Reinstall the plugin.',
    };
  }
}

export function checkConfigHealth(env: DiagnoseEnv): CheckResult {
  setQuiet(true);
  const config = loadConfig(env.cwd);
  const warnings = config.warnings ?? [];

  if (warnings.length === 0) {
    return {
      id: 'config-health',
      status: 'pass',
      detail: 'No config warnings found.',
    };
  }

  const parseErrors = warnings.filter(w => w.message.startsWith('failed to parse config '));

  if (parseErrors.length > 0) {
    const detail = parseErrors.map(w => `${w.file}: ${w.message}`).join('; ');
    return {
      id: 'config-health',
      status: 'fail',
      detail,
      fix: 'Fix the YAML/JSON syntax errors in the config files listed above.',
    };
  }

  // Remaining warnings (e.g. unknown keys)
  const detail = warnings.map(w => {
    let s = `${w.file}: ${w.path} — ${w.message}`;
    if (w.suggestion) s += ` (did you mean ${w.suggestion}?)`;
    return s;
  }).join('; ');
  return {
    id: 'config-health',
    status: 'warn',
    detail,
    fix: 'Review and correct the config warnings listed above.',
  };
}

export function runDiagnostics(env?: Partial<DiagnoseEnv>): CheckResult[] {
  const resolved: DiagnoseEnv = {
    home: env?.home ?? os.homedir(),
    cwd: env?.cwd ?? process.cwd(),
    repoRoot: env?.repoRoot ?? resolve(__dirname, '..'),
  };

  const checks = [
    () => checkNativePermissions(resolved),
    () => checkHookRegistration(resolved),
    () => checkBinary(resolved),
    () => checkConfigHealth(resolved),
  ];

  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      results.push(check());
    } catch (e) {
      const id = results.length === 0 ? 'native-permissions'
        : results.length === 1 ? 'hook-registration'
        : results.length === 2 ? 'binary'
        : 'config-health';
      results.push({
        id,
        status: 'unknown',
        detail: `Unexpected error running ${id}: ${e instanceof Error ? e.message : String(e)}`,
        fix: 'Check Warden diagnostics configuration.',
      });
    }
  }
  return results;
}
