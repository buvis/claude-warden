import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import os from 'os';

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

export function runDiagnostics(env?: Partial<DiagnoseEnv>): CheckResult[] {
  const resolved: DiagnoseEnv = {
    home: env?.home ?? os.homedir(),
    cwd: env?.cwd ?? process.cwd(),
    repoRoot: env?.repoRoot ?? resolve(__dirname, '..'),
  };

  try {
    return [checkNativePermissions(resolved)];
  } catch (e) {
    return [{
      id: 'native-permissions',
      status: 'unknown',
      detail: `Unexpected error running diagnostics: ${e instanceof Error ? e.message : String(e)}`,
      fix: 'Check Warden diagnostics configuration.',
    }];
  }
}
