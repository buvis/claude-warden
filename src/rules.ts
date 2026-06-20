import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { homedir } from 'os';
import { join } from 'path';
import type {
  WardenConfig, ConfigLayer, ConfigWarning, TrustedTarget,
  TrustedRemote, RemoteContext, TargetPolicy, PathPolicy, DatabasePolicy, EndpointPolicy,
} from './types';
import { DEFAULT_CONFIG } from './defaults';
import {
  KNOWN_COMMAND_RULE_KEYS, KNOWN_ARG_PATTERN_KEYS,
  KNOWN_MATCH_CONDITION_KEYS, KNOWN_LAYER_KEYS,
  KNOWN_TRUSTED_REMOTE_KEYS, KNOWN_TRUSTED_TARGET_KEYS,
  KNOWN_PATH_POLICY_KEYS, KNOWN_DATABASE_POLICY_KEYS,
  KNOWN_ENDPOINT_POLICY_KEYS, KNOWN_TOP_LEVEL_KEYS,
  nearestKey,
} from './config-schema';

const VALID_DECISIONS = new Set(['allow', 'deny', 'ask']);
function isValidDecision(value: string): value is 'allow' | 'deny' | 'ask' {
  return VALID_DECISIONS.has(value);
}

// Default to quiet: when running as a PreToolUse hook, any stderr
// output is surfaced by Claude Code as "hook error" — even with exit
// code 0. Silent-by-default means any new hook entry point is safe
// without extra wiring. CLI entry points (cli.ts, codex-export.ts)
// explicitly call setQuiet(false) to restore full verbosity.
let quiet = true;
export function setQuiet(value: boolean): void {
  quiet = value;
}
export function warn(message: string): void {
  if (quiet) return;
  process.stderr.write(message);
}

let warningSink: ConfigWarning[] | null = null;
let currentFile = '';

function report(path: string, message: string, suggestion?: string): void {
  if (warningSink) {
    warningSink.push({ file: currentFile, path, message, ...(suggestion !== undefined && { suggestion }) });
  }
  warn(`[warden] Warning: ${message}\n`);
}

// Report each key of `obj` not in `known`. pathPrefix '' -> path is the bare key;
// non-empty -> `${pathPrefix}.${key}`.
function scanKeys(
  obj: Record<string, unknown>,
  known: ReadonlySet<string>,
  pathPrefix: string,
): void {
  for (const key of Object.keys(obj)) {
    if (known.has(key)) continue;
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    report(path, `unknown key "${key}"`, nearestKey(key, known));
  }
}

const USER_CONFIG_PATHS = [
  join(homedir(), '.claude', 'warden.yaml'),
  join(homedir(), '.claude', 'warden.json'),
];

const PROJECT_CONFIG_NAMES = [
  '.claude/warden.yaml',
  '.claude/warden.json',
];

export function loadConfig(cwd?: string): WardenConfig {
  const warnings: ConfigWarning[] = [];
  warningSink = warnings;
  try {
    const config = structuredClone(DEFAULT_CONFIG);
    const defaultLayer = config.layers[0];

    let userLayer: ConfigLayer | null = null;
    let userRaw: Record<string, unknown> | null = null;
    let userConfigPath = '';
    for (const configPath of USER_CONFIG_PATHS) {
      currentFile = configPath;
      const result = tryLoadFile(configPath);
      if (result) {
        userConfigPath = configPath;
        userLayer = extractLayer(result);
        userRaw = result;
        break;
      }
    }

    let workspaceLayer: ConfigLayer | null = null;
    let workspaceRaw: Record<string, unknown> | null = null;
    let workspaceConfigPath = '';
    if (cwd) {
      for (const name of PROJECT_CONFIG_NAMES) {
        currentFile = join(cwd, name);
        const result = tryLoadFile(join(cwd, name));
        if (result) {
          workspaceConfigPath = join(cwd, name);
          workspaceLayer = extractLayer(result);
          workspaceRaw = result;
          break;
        }
      }
    }

    // Build layers: workspace > user > default
    config.layers = [
      ...(workspaceLayer ? [workspaceLayer] : []),
      ...(userLayer ? [userLayer] : []),
      defaultLayer,
    ];

    // Merge non-layer fields from user config, then workspace config (workspace wins)
    if (userRaw) {
      currentFile = userConfigPath;
      scanKeys(userRaw, KNOWN_TOP_LEVEL_KEYS, '');
      mergeNonLayerFields(config, userRaw);
    }
    if (workspaceRaw) {
      currentFile = workspaceConfigPath;
      scanKeys(workspaceRaw, KNOWN_TOP_LEVEL_KEYS, '');
      mergeNonLayerFields(config, workspaceRaw);
    }

    config.warnings = warnings;
    return config;
  } finally {
    warningSink = null;
  }
}

function tryLoadFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = filePath.endsWith('.yaml') || filePath.endsWith('.yml')
      ? parseYaml(raw)
      : JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch (err) {
    report(filePath, `failed to parse config ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

function extractLayer(
  raw: Record<string, unknown>,
  pathPrefix?: string,
): ConfigLayer {
  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule && typeof rule === 'object') {
      const rulePath = pathPrefix ? `${pathPrefix}.rules[${i}]` : `rules[${i}]`;
      scanKeys(rule as Record<string, unknown>, KNOWN_COMMAND_RULE_KEYS, rulePath);
      if (rule.default && !isValidDecision(rule.default)) {
        report(`${rulePath}.default`, `invalid rule default "${rule.default}" for "${rule.command}", using "ask"`);
        rule.default = 'ask';
      }
      if (Array.isArray(rule.argPatterns)) {
        for (let j = 0; j < rule.argPatterns.length; j++) {
          const pattern = rule.argPatterns[j];
          if (pattern && typeof pattern === 'object') {
            const patPath = `${rulePath}.argPatterns[${j}]`;
            scanKeys(pattern as Record<string, unknown>, KNOWN_ARG_PATTERN_KEYS, patPath);
            if (pattern.decision && !isValidDecision(pattern.decision)) {
              report(`${patPath}.decision`, `invalid pattern decision "${pattern.decision}" for "${rule.command}", using "ask"`);
              pattern.decision = 'ask';
            }
            if (pattern.match && typeof pattern.match === 'object') {
              scanKeys(pattern.match as Record<string, unknown>, KNOWN_MATCH_CONDITION_KEYS, `${patPath}.match`);
            }
          }
        }
      }
    }
  }
  if (pathPrefix) {
    scanKeys(raw, KNOWN_LAYER_KEYS, pathPrefix);
  }
  return {
    alwaysAllow: Array.isArray(raw.alwaysAllow) ? raw.alwaysAllow : [],
    alwaysDeny: Array.isArray(raw.alwaysDeny) ? raw.alwaysDeny : [],
    rules,
  };
}

export function parseTrustedList(
  raw: unknown[],
  pathPrefix: string = '',
): TrustedTarget[] {
  return raw.map((entry, i) => {
    if (typeof entry === 'string') return { name: entry };
    if (entry && typeof entry === 'object' && 'name' in entry) {
      const obj = entry as Record<string, unknown>;
      const entryPath = pathPrefix ? `${pathPrefix}[${i}]` : `[${i}]`;
      scanKeys(obj, KNOWN_TRUSTED_TARGET_KEYS, entryPath);
      const target: TrustedTarget = { name: String(obj.name) };
      if (obj.allowAll === true) target.allowAll = true;
      if (obj.overrides && typeof obj.overrides === 'object') {
        target.overrides = extractLayer(obj.overrides as Record<string, unknown>, `${entryPath}.overrides`);
      }
      return target;
    }
    return null;
  }).filter((t): t is TrustedTarget => t !== null);
}

const VALID_REMOTE_CONTEXTS = new Set<RemoteContext>(['ssh', 'docker', 'kubectl', 'sprite', 'fly']);

function parseTrustedRemotes(
  raw: unknown[],
  pathPrefix: string = 'trustedRemotes',
): TrustedRemote[] {
  const results: TrustedRemote[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const entryPath = `${pathPrefix}[${i}]`;
    scanKeys(obj, KNOWN_TRUSTED_REMOTE_KEYS, entryPath);
    const context = String(obj.context || '');
    if (!VALID_REMOTE_CONTEXTS.has(context as RemoteContext)) {
      report(`${entryPath}.context`, `unknown remote context "${context}", skipping`);
      continue;
    }
    const name = String(obj.name || '');
    if (!name) continue;
    const remote: TrustedRemote = { name, context: context as RemoteContext };
    if (obj.allowAll === true) remote.allowAll = true;
    if (obj.overrides && typeof obj.overrides === 'object') {
      remote.overrides = extractLayer(obj.overrides as Record<string, unknown>, `${entryPath}.overrides`);
    }
    results.push(remote);
  }
  return results;
}

export function parseTargetPolicies(
  raw: unknown[],
  pathPrefix: string = 'targetPolicies',
): TargetPolicy[] {
  const results: TargetPolicy[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object' || !('type' in entry)) {
      report(`targetPolicies[${i}]`, `targetPolicies entry missing "type" field, skipping`);
      continue;
    }
    const obj = entry as Record<string, unknown>;
    const entryPath = `${pathPrefix}[${i}]`;
    const policyType = String(obj.type);
    if (!['path', 'database', 'endpoint'].includes(policyType)) {
      report(entryPath, `unknown targetPolicy type "${policyType}", skipping`);
      continue;
    }
    if (typeof obj.decision !== 'string' || !isValidDecision(obj.decision)) {
      report(entryPath, `targetPolicies entry missing or invalid "decision", skipping`);
      continue;
    }
    const typeKey = policyType as 'path' | 'database' | 'endpoint';
    const typeTable = typeKey === 'path' ? KNOWN_PATH_POLICY_KEYS
      : typeKey === 'database' ? KNOWN_DATABASE_POLICY_KEYS
      : KNOWN_ENDPOINT_POLICY_KEYS;
    scanKeys(obj, typeTable, entryPath);
    const base = {
      decision: obj.decision,
      ...(typeof obj.reason === 'string' && { reason: obj.reason }),
      ...(Array.isArray(obj.commands) && { commands: obj.commands as string[] }),
      ...(obj.allowAll === true && { allowAll: true }),
    };
    switch (typeKey) {
      case 'path': {
        if (typeof obj.path !== 'string') {
          report(`targetPolicies[${i}]`, `path targetPolicy missing "path" field, skipping`);
          continue;
        }
        const policy: PathPolicy = { ...base, type: 'path', path: obj.path, recursive: typeof obj.recursive === 'boolean' ? obj.recursive : true };
        results.push(policy);
        break;
      }
      case 'database': {
        if (typeof obj.host !== 'string') {
          report(`targetPolicies[${i}]`, `database targetPolicy missing "host" field, skipping`);
          continue;
        }
        const policy: DatabasePolicy = {
          ...base,
          type: 'database',
          host: obj.host,
          ...(typeof obj.port === 'number' && { port: obj.port }),
          ...(typeof obj.database === 'string' && { database: obj.database }),
        };
        results.push(policy);
        break;
      }
      case 'endpoint': {
        if (typeof obj.pattern !== 'string') {
          report(`targetPolicies[${i}]`, `endpoint targetPolicy missing "pattern" field, skipping`);
          continue;
        }
        const policy: EndpointPolicy = { ...base, type: 'endpoint', pattern: obj.pattern };
        results.push(policy);
        break;
      }
      default:
        report(`targetPolicies[${i}]`, `unknown targetPolicy type "${String(obj.type)}", skipping`);
    }
  }
  return results;
}

const LEGACY_REMOTE_MAP: Record<string, RemoteContext> = {
  trustedSSHHosts: 'ssh',
  trustedDockerContainers: 'docker',
  trustedKubectlContexts: 'kubectl',
  trustedSprites: 'sprite',
  trustedFlyApps: 'fly',
};


function mergeNonLayerFields(config: WardenConfig, raw: Record<string, unknown>): void {
  // Unified trustedRemotes
  if (Array.isArray(raw.trustedRemotes)) {
    config.trustedRemotes = [...config.trustedRemotes, ...parseTrustedRemotes(raw.trustedRemotes)];
  }
  // Legacy keys → convert to trustedRemotes with context
  for (const [key, context] of Object.entries(LEGACY_REMOTE_MAP)) {
    if (Array.isArray(raw[key])) {
      report(key, `${key} is deprecated, use trustedRemotes with context: "${context}" instead`);
      const targets = parseTrustedList(raw[key] as unknown[], key);
      config.trustedRemotes = [...config.trustedRemotes, ...targets.map(t => ({ ...t, context }))];
    }
  }
  if (Array.isArray(raw.targetPolicies)) {
    config.targetPolicies = [...config.targetPolicies, ...parseTargetPolicies(raw.targetPolicies, 'targetPolicies')];
  }
  if (typeof raw.defaultDecision === 'string') {
    if (isValidDecision(raw.defaultDecision)) {
      config.defaultDecision = raw.defaultDecision;
    } else {
      report('defaultDecision', `invalid defaultDecision "${raw.defaultDecision}", ignoring`);
    }
  }
  if (typeof raw.askOnSubshell === 'boolean') {
    config.askOnSubshell = raw.askOnSubshell;
  }
  if (typeof raw.notifyOnAsk === 'boolean') {
    config.notifyOnAsk = raw.notifyOnAsk;
  }
  if (typeof raw.notifyOnDeny === 'boolean') {
    config.notifyOnDeny = raw.notifyOnDeny;
  }
  if (typeof raw.sessionGuidance === 'string' || raw.sessionGuidance === false) {
    config.sessionGuidance = raw.sessionGuidance;
  } else if (raw.sessionGuidance !== undefined) {
    report('sessionGuidance', `invalid sessionGuidance (expected string or false), ignoring`);
  }
  if (typeof raw.tempScriptDir === 'string' && raw.tempScriptDir.length > 0) {
    config.tempScriptDir = raw.tempScriptDir;
  } else if (raw.tempScriptDir !== undefined) {
    report('tempScriptDir', `invalid tempScriptDir (expected non-empty string), ignoring`);
  }
  if (typeof raw.audit === 'boolean') {
    config.audit = raw.audit;
  }
  if (typeof raw.auditPath === 'string') {
    config.auditPath = raw.auditPath;
  }
  if (typeof raw.auditAllowDecisions === 'boolean') {
    config.auditAllowDecisions = raw.auditAllowDecisions;
  }
  if (raw.trustedContextOverrides && typeof raw.trustedContextOverrides === 'object') {
    const overrides = raw.trustedContextOverrides as Record<string, unknown>;
    const layer = extractLayer(overrides, 'trustedContextOverrides');
    // Merge with existing overrides (later config wins by prepending)
    if (config.trustedContextOverrides) {
      config.trustedContextOverrides = {
        alwaysAllow: [...layer.alwaysAllow, ...config.trustedContextOverrides.alwaysAllow],
        alwaysDeny: [...layer.alwaysDeny, ...config.trustedContextOverrides.alwaysDeny],
        rules: [...layer.rules, ...config.trustedContextOverrides.rules],
      };
    } else {
      config.trustedContextOverrides = layer;
    }
  }
}
