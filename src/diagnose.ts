import { readFileSync, existsSync, statSync, accessSync, constants } from 'fs';
import { join, resolve, dirname, isAbsolute } from 'path';
import os from 'os';
import { loadConfig, setQuiet } from './rules';
import { DEFAULT_CONFIG } from './defaults';
import { wardenEvalWithConfig } from './core';

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
  inspectError?: string;
}

// Extract a plain `.version` field from a parsed JSON object.
function extractVersionField(obj: unknown): string | undefined {
  if (obj && typeof obj === 'object') {
    return (obj as Record<string, unknown>).version as string | undefined;
  }
  return undefined;
}

// Extract `.plugins.find(p => p.name === 'warden').version` from a parsed marketplace JSON.
function extractMarketplaceWardenVersion(obj: unknown): string | undefined {
  if (obj && typeof obj === 'object') {
    const plugins = (obj as Record<string, unknown>).plugins as unknown[] | undefined;
    if (Array.isArray(plugins)) {
      const warden = plugins.find(
        (p: unknown) => p && typeof p === 'object' && (p as Record<string, unknown>).name === 'warden'
      );
      if (warden) {
        return (warden as Record<string, unknown>).version as string | undefined;
      }
    }
  }
  return undefined;
}

// Read a JSON stamp file relative to root; push the extracted value into stamps
// or push relPath into unparseable when the file exists but cannot be parsed.
function readStamp(
  root: string,
  relPath: string,
  extract: (obj: unknown) => string | undefined,
  stamps: { label: string; value: string }[],
  unparseable: string[]
): void {
  const fullPath = join(root, relPath);
  if (!existsSync(fullPath)) return;
  try {
    const raw = readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const value = extract(parsed);
    if (value !== undefined) {
      stamps.push({ label: relPath, value });
    }
  } catch {
    // Present but unparseable — a load-bearing stamp we could not inspect.
    // Record it so the check fails loud (unknown) rather than silently
    // dropping it, which could otherwise produce a false 'pass'.
    unparseable.push(relPath);
  }
}

// Collect all Bash/Bash(...) entries from an array into { path, entry } pairs.
function collectBashEntries(entries: unknown[], path: string): { path: string; entry: string }[] {
  const results: { path: string; entry: string }[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string' && isBashEntry(entry)) {
      results.push({ path, entry });
    }
  }
  return results;
}

// Scan a single settings file for Bash entries in deny/ask/allow buckets.
// Returns 'ok' when the file was read and parsed, or 'unparseable' on error.
function scanSettingsFile(
  path: string,
  denyBash: { path: string; entry: string }[],
  askBash: { path: string; entry: string }[],
  allowBash: { path: string; entry: string }[]
): 'ok' | 'unparseable' {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return 'ok';
    const obj = parsed as Record<string, unknown>;
    const perms = obj.permissions as Record<string, unknown> | undefined;
    if (typeof perms !== 'object' || perms === null) return 'ok';
    denyBash.push(...collectBashEntries(Array.isArray(perms.deny) ? perms.deny : [], path));
    askBash.push(...collectBashEntries(Array.isArray(perms.ask) ? perms.ask : [], path));
    allowBash.push(...collectBashEntries(Array.isArray(perms.allow) ? perms.allow : [], path));
    return 'ok';
  } catch {
    return 'unparseable';
  }
}

// Read and parse hooks.json, returning [data, null] on success or [null, errorPath] on failure.
function readHooksJson(root: string): [unknown, null] | [null, string] {
  const hooksJsonPath = join(root, 'hooks', 'hooks.json');
  try {
    const raw = readFileSync(hooksJsonPath, 'utf-8');
    return [JSON.parse(raw), null];
  } catch {
    return [null, hooksJsonPath];
  }
}

// Return true if hooks.json data contains a PreToolUse Bash matcher whose
// command includes 'dist/index.cjs'.
function hasBashHookForDist(hooksData: unknown): boolean {
  if (!hooksData || typeof hooksData !== 'object') return false;
  const obj = hooksData as Record<string, unknown>;
  const hooksObj = obj.hooks as Record<string, unknown> | undefined;
  const preToolUse = hooksObj?.PreToolUse as unknown[] | undefined;
  if (!Array.isArray(preToolUse)) return false;
  for (const entry of preToolUse) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (e.matcher !== 'Bash') continue;
    const hooks = e.hooks as unknown[] | undefined;
    if (!Array.isArray(hooks)) continue;
    for (const h of hooks) {
      if (!h || typeof h !== 'object') continue;
      const cmd = (h as Record<string, unknown>).command as string | undefined;
      if (typeof cmd === 'string' && cmd.includes('dist/index.cjs')) return true;
    }
  }
  return false;
}

// Lookup warden's install path from installed_plugins.json.
// Returns an 'installed' PluginRoot when a warden entry resolves to a real installPath,
// or a 'not-found' PluginRoot carrying inspectError when the file exists but cannot be
// read/parsed (so callers report unknown instead of a false pass).
// Returns null when the file is absent OR present-but-valid with no usable warden entry —
// in both cases the caller falls through to the dev-checkout branch.
function lookupInstalledPlugin(pluginsJsonPath: string, repoRoot: string): PluginRoot | null {
  if (!existsSync(pluginsJsonPath)) return null;
  try {
    const raw = readFileSync(pluginsJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const plugins = parsed.plugins as Record<string, unknown> | undefined;
      if (plugins && typeof plugins === 'object') {
        for (const key of Object.keys(plugins)) {
          if (key.split('@')[0] === 'warden') {
            const entries = plugins[key] as unknown[] | undefined;
            if (Array.isArray(entries) && entries.length > 0) {
              const first = entries[0] as Record<string, unknown>;
              const installPath = first.installPath as string | undefined;
              if (installPath && existsSync(installPath)) {
                return { mode: 'installed', root: installPath, installPath };
              }
            }
            // Warden key present but stale: entries not a non-empty array, or installPath
            // missing / nonexistent on disk -> uninspectable, report unknown (not a silent
            // dev-checkout fall-through that would produce a false pass).
            return {
              mode: 'not-found',
              root: repoRoot,
              inspectError: `installed_plugins.json has a warden entry but its installPath is missing or does not exist (${pluginsJsonPath})`,
            };
          }
        }
      }
    }
  } catch (e: unknown) {
    // File exists but could not be read or parsed — surface as inspectError so
    // callers can distinguish this from "file absent" and report unknown instead
    // of silently falling through to the dev-checkout branch (false pass).
    const msg = e instanceof Error ? e.message : String(e);
    return { mode: 'not-found', root: repoRoot, inspectError: `could not inspect ${pluginsJsonPath}: ${msg}` };
  }
  return null;
}

function isWardenSourceTree(repoRoot: string): boolean {
  const pkgPath = join(repoRoot, 'package.json');
  try {
    if (existsSync(pkgPath)) {
      const raw = readFileSync(pkgPath, 'utf-8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name === '@buvis/claude-warden') {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function resolvePluginRoot(env: DiagnoseEnv): PluginRoot {
  const pluginsJsonPath = join(env.home, '.claude', 'plugins', 'installed_plugins.json');
  const installed = lookupInstalledPlugin(pluginsJsonPath, env.repoRoot);
  // 1. Registry could not be inspected (corrupt/unreadable) OR a warden entry is
  //    present-but-stale -> unknown, regardless of any dev checkout.
  if (installed && installed.inspectError) return installed;
  // 2. The executing Warden: if repoRoot is the warden source tree, that is the
  //    install actually running -- prefer it over an unrelated installed cache.
  if (isWardenSourceTree(env.repoRoot)) return { mode: 'dev', root: env.repoRoot };
  // 3. A valid installed entry located via the registry.
  if (installed) return installed;
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
  const denyBash: { path: string; entry: string }[] = [];
  const askBash: { path: string; entry: string }[] = [];
  const allowBash: { path: string; entry: string }[] = [];
  const unparseablePaths: string[] = [];

  for (const path of paths) {
    if (!existsSync(path)) continue;
    if (scanSettingsFile(path, denyBash, askBash, allowBash) === 'unparseable') {
      unparseablePaths.push(path);
    }
  }

  if (unparseablePaths.length > 0) {
    const shadowing = [...denyBash, ...askBash];
    const parts: string[] = [];
    if (shadowing.length > 0) {
      parts.push(shadowing.map(f => `${f.path}: ${f.entry}`).join('; '));
    }
    parts.push(`could not parse: ${unparseablePaths.join(', ')}`);
    return {
      id: 'native-permissions',
      status: 'unknown',
      detail: parts.join('; '),
      fix: `Fix or remove the malformed settings file(s): ${unparseablePaths.join(', ')}.`,
    };
  }

  if (denyBash.length > 0 || askBash.length > 0) {
    const findings = [...denyBash, ...askBash];
    const detail = findings.map(f => `${f.path}: ${f.entry}`).join('; ');
    return {
      id: 'native-permissions',
      status: 'fail',
      detail,
      fix: 'Remove these Bash entries from permissions.deny/ask - native CC permissions run before Warden\'s hook and shadow it; Warden is the single authority for Bash policy.',
    };
  }

  if (allowBash.length > 0) {
    const detail = allowBash.map(f => `${f.path}: ${f.entry}`).join('; ');
    return { id: 'native-permissions', status: 'info', detail };
  }

  return { id: 'native-permissions', status: 'pass', detail: 'No Bash entries found in any settings file.' };
}

export function checkHookRegistration(env: DiagnoseEnv): CheckResult {
  const pr = resolvePluginRoot(env);

  if (pr.inspectError) {
    return {
      id: 'hook-registration',
      status: 'unknown',
      detail: pr.inspectError,
      fix: 'Fix or restore ~/.claude/plugins/installed_plugins.json so the installed Warden plugin can be located.',
    };
  }

  if (pr.mode === 'not-found') {
    return {
      id: 'hook-registration',
      status: 'fail',
      detail: `Warden plugin not found: no installed entry in installed_plugins.json and ${pr.root} is not the warden source tree.`,
      fix: 'Install or reinstall the Warden plugin so its PreToolUse Bash hook is registered.',
    };
  }

  const [hooksData, errPath] = readHooksJson(pr.root);
  if (errPath !== null) {
    return {
      id: 'hook-registration',
      status: 'unknown',
      detail: `Could not inspect ${errPath} - file could not be parsed as JSON.`,
      fix: 'Repair or reinstall the plugin so hooks/hooks.json is valid JSON.',
    };
  }

  const modeLabel = pr.mode === 'dev' ? 'dev checkout' : 'installed plugin';
  if (hasBashHookForDist(hooksData)) {
    const pathLabel = pr.mode === 'installed' && pr.installPath ? pr.installPath : pr.root;
    return { id: 'hook-registration', status: 'pass', detail: `${modeLabel} at ${pathLabel} - Bash hook registered with dist/index.cjs.` };
  }

  return {
    id: 'hook-registration',
    status: 'fail',
    detail: `${modeLabel} at ${pr.root}: hooks.json parsed but no Bash matcher with dist/index.cjs found.`,
    fix: 'Repair or reinstall the plugin so its PreToolUse Bash hook references dist/index.cjs.',
  };
}

// Classify a successful statSync result for dist/index.cjs into a CheckResult.
function classifyBinaryStat(binaryPath: string, rebuildFix: string): CheckResult {
  const st = statSync(binaryPath);
  if (!st.isFile()) {
    return { id: 'binary', status: 'fail', detail: `${binaryPath} exists but is not a regular file.`, fix: rebuildFix };
  }
  if (st.size > 0) {
    return { id: 'binary', status: 'pass', detail: `dist/index.cjs found at ${binaryPath} (${st.size} bytes).` };
  }
  return { id: 'binary', status: 'fail', detail: `dist/index.cjs at ${binaryPath} is empty (0 bytes).`, fix: rebuildFix };
}

// Map a statSync error for dist/index.cjs into a CheckResult.
function classifyBinaryError(err: unknown, binaryPath: string, rebuildFix: string, permFix: string): CheckResult {
  const code = (err as { code?: string } | undefined)?.code;
  if (code === 'ENOENT') {
    return { id: 'binary', status: 'fail', detail: `dist/index.cjs not found at ${binaryPath}.`, fix: rebuildFix };
  }
  return {
    id: 'binary',
    status: 'unknown',
    detail: `Could not inspect ${binaryPath}: ${err instanceof Error ? err.message : String(err)}`,
    fix: permFix,
  };
}

export function checkBinary(env: DiagnoseEnv): CheckResult {
  const pr = resolvePluginRoot(env);

  if (pr.inspectError) {
    return {
      id: 'binary',
      status: 'unknown',
      detail: pr.inspectError,
      fix: 'Fix or restore ~/.claude/plugins/installed_plugins.json so the installed Warden binary can be located.',
    };
  }

  if (pr.mode === 'not-found') {
    return {
      id: 'binary',
      status: 'fail',
      detail: `No plugin root found at ${pr.root} - cannot locate dist/index.cjs.`,
      fix: 'Install or reinstall the Warden plugin.',
    };
  }

  const binaryPath = join(pr.root, 'dist', 'index.cjs');
  const rebuildFix = pr.mode === 'dev' ? 'Run "pnpm run build" to compile the plugin.' : 'Reinstall the plugin.';
  const permFix = pr.mode === 'dev'
    ? 'Check permissions on dist/index.cjs, then run "pnpm run build".'
    : 'Check permissions on the installed plugin binary or reinstall the plugin.';
  try {
    return classifyBinaryStat(binaryPath, rebuildFix);
  } catch (err: unknown) {
    return classifyBinaryError(err, binaryPath, rebuildFix, permFix);
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
    let s = `${w.file}: ${w.path} - ${w.message}`;
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

export function checkAuditWritable(env: DiagnoseEnv): CheckResult {
  setQuiet(true);
  const rawAuditPath = loadConfig(env.cwd).auditPath;
  const auditPath = isAbsolute(rawAuditPath) ? rawAuditPath : resolve(env.cwd, rawAuditPath);
  const auditDir = dirname(auditPath);

  if (!existsSync(auditDir)) {
    return {
      id: 'audit-writable',
      status: 'fail',
      detail: `Audit directory ${auditDir} does not exist — Warden will silently drop audit entries.`,
      fix: `Create the directory (mkdir -p ${auditDir}) or fix auditPath in your config.`,
    };
  }

  if (!statSync(auditDir).isDirectory()) {
    return {
      id: 'audit-writable',
      status: 'fail',
      detail: `Audit path's parent ${auditDir} is not a directory — Warden will drop audit entries.`,
      fix: `Remove ${auditDir} and create it as a directory, or fix auditPath in your config.`,
    };
  }

  try {
    accessSync(auditDir, constants.W_OK);
  } catch (err: unknown) {
    const code = (err as { code?: string } | undefined)?.code;
    if (code === 'EACCES') {
      return {
        id: 'audit-writable',
        status: 'fail',
        detail: `Audit directory ${auditDir} is not writable — Warden silently drops audit entries it cannot write.`,
        fix: `Make ${auditDir} writable (e.g. chmod u+w ${auditDir}).`,
      };
    }
    return {
      id: 'audit-writable',
      status: 'unknown',
      detail: `Could not inspect writability of ${auditDir}: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Check permissions or filesystem state for the audit directory.',
    };
  }

  // Target file exists — validate it is a regular file and is writable.
  if (existsSync(auditPath)) {
    if (!statSync(auditPath).isFile()) {
      return {
        id: 'audit-writable',
        status: 'fail',
        detail: `Audit path ${auditPath} is not a regular file — Warden requires a file for audit entries.`,
        fix: `Remove ${auditPath} and ensure it is a regular file, or fix auditPath in your config.`,
      };
    }
    try {
      accessSync(auditPath, constants.W_OK);
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'EACCES') {
        return {
          id: 'audit-writable',
          status: 'fail',
          detail: `Audit file ${auditPath} is not writable — Warden silently drops audit entries it cannot write.`,
          fix: `Make ${auditPath} writable (e.g. chmod u+w ${auditPath}).`,
        };
      }
      return {
        id: 'audit-writable',
        status: 'unknown',
        detail: `Could not inspect writability of ${auditPath}: ${err instanceof Error ? err.message : String(err)}`,
        fix: 'Check permissions or filesystem state for the audit file.',
      };
    }
  }

  return {
    id: 'audit-writable',
    status: 'pass',
    detail: `Audit path ${auditPath} is writable.`,
  };
}

export function checkPipelineProbe(env: DiagnoseEnv): CheckResult {
  try {
    const r = wardenEvalWithConfig('echo warden-diagnose-probe', DEFAULT_CONFIG);
    if (r.decision === 'allow') {
      return {
        id: 'pipeline-probe',
        status: 'pass',
        detail: 'In-process probe against default config returned allow.',
      };
    }
    return {
      id: 'pipeline-probe',
      status: 'fail',
      detail: `Pipeline probe returned decision "${r.decision}" (reason: ${r.reason ?? 'none'}). Expected allow.`,
      fix: 'The parser+evaluator pipeline is misconfigured — check Warden evaluation rules.',
    };
  } catch (e: unknown) {
    return {
      id: 'pipeline-probe',
      status: 'fail',
      detail: `Pipeline probe threw: ${e instanceof Error ? e.message : String(e)}`,
      fix: 'The parser+evaluator pipeline is broken — check Warden evaluation rules.',
    };
  }
}

export function checkVersionSync(env: DiagnoseEnv): CheckResult {
  const pr = resolvePluginRoot(env);
  const root = pr.root;

  const stamps: { label: string; value: string }[] = [];
  const unparseable: string[] = [];

  readStamp(root, 'package.json', extractVersionField, stamps, unparseable);
  readStamp(root, '.claude-plugin/plugin.json', extractVersionField, stamps, unparseable);
  readStamp(root, '.claude-plugin/marketplace.json', extractMarketplaceWardenVersion, stamps, unparseable);
  readStamp(root, '../claude-plugins/.claude-plugin/marketplace.json', extractMarketplaceWardenVersion, stamps, unparseable);

  // A present-but-unparseable stamp could not be inspected: fail loud (unknown)
  // before any pass/skip verdict, so a corrupt stamp never reads as green.
  if (unparseable.length > 0) {
    return {
      id: 'version-sync',
      status: 'unknown',
      detail: `Could not parse version stamp(s): ${unparseable.join(', ')} (at ${root}).`,
      fix: 'Fix the JSON syntax in the listed version stamp file(s).',
    };
  }

  // If no package.json stamp found, skip
  const pkgStamp = stamps.find(s => s.label === 'package.json');
  if (!pkgStamp) {
    return {
      id: 'version-sync',
      status: 'skip',
      detail: 'version-sync only runs against the warden source/plugin tree.',
    };
  }

  // All reachable stamps agree -> pass
  const allSame = stamps.every(s => s.value === pkgStamp.value);
  const detail = stamps.map(s => `${s.label}=${s.value}`).join('; ');
  if (allSame) {
    return { id: 'version-sync', status: 'pass', detail };
  }

  // Any stamp differs -> warn
  return {
    id: 'version-sync',
    status: 'warn',
    detail,
    fix: 'Resync the version stamps (the release script dev/bin/release resyncs them).',
  };
}

export function runDiagnostics(env?: Partial<DiagnoseEnv>): CheckResult[] {
  const resolved: DiagnoseEnv = {
    home: env?.home ?? os.homedir(),
    cwd: env?.cwd ?? process.cwd(),
    repoRoot: env?.repoRoot ?? resolve(__dirname, '..'),
  };

  const checks: { id: string; fn: () => CheckResult }[] = [
    { id: 'native-permissions', fn: () => checkNativePermissions(resolved) },
    { id: 'hook-registration', fn: () => checkHookRegistration(resolved) },
    { id: 'binary', fn: () => checkBinary(resolved) },
    { id: 'config-health', fn: () => checkConfigHealth(resolved) },
    { id: 'audit-writable', fn: () => checkAuditWritable(resolved) },
    { id: 'pipeline-probe', fn: () => checkPipelineProbe(resolved) },
    { id: 'version-sync', fn: () => checkVersionSync(resolved) },
  ];

  const results: CheckResult[] = [];
  for (const { id, fn } of checks) {
    try {
      results.push(fn());
    } catch (e) {
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
