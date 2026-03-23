import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { homedir } from 'os';
import { join } from 'path';
import type { WardenConfig, ConfigLayer, CommandRule, TrustedTarget, TrustedRemote, RemoteContext, TargetPolicy, PathPolicy, DatabasePolicy, EndpointPolicy } from './types';
import { DEFAULT_CONFIG } from './defaults';

const VALID_DECISIONS = new Set(['allow', 'deny', 'ask']);
function isValidDecision(value: string): value is 'allow' | 'deny' | 'ask' {
  return VALID_DECISIONS.has(value);
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
  const config = structuredClone(DEFAULT_CONFIG);
  const defaultLayer = config.layers[0];

  let userLayer: ConfigLayer | null = null;
  let userRaw: Record<string, unknown> | null = null;
  for (const configPath of USER_CONFIG_PATHS) {
    const result = tryLoadFile(configPath);
    if (result) {
      userLayer = extractLayer(result);
      userRaw = result;
      break;
    }
  }

  let workspaceLayer: ConfigLayer | null = null;
  let workspaceRaw: Record<string, unknown> | null = null;
  if (cwd) {
    for (const name of PROJECT_CONFIG_NAMES) {
      const result = tryLoadFile(join(cwd, name));
      if (result) {
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
  if (userRaw) mergeNonLayerFields(config, userRaw);
  if (workspaceRaw) mergeNonLayerFields(config, workspaceRaw);

  return config;
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
    process.stderr.write(`[warden] Warning: failed to parse config ${filePath}: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  return null;
}

/** Known command names from default config (used for misconfiguration detection) */
const KNOWN_COMMANDS = new Set([
  ...DEFAULT_CONFIG.layers[0].alwaysAllow,
  ...DEFAULT_CONFIG.layers[0].alwaysDeny,
  ...DEFAULT_CONFIG.layers[0].rules.map(r => r.command),
]);

/**
 * Detect likely misconfiguration where argPatterns on one command
 * seem to reference another command name (e.g. argPatterns on "bash"
 * matching "python"). This is a common user mistake — rules must
 * target the actual command being invoked.
 */
function warnArgPatternCommandMismatch(rule: CommandRule): void {
  if (!Array.isArray(rule.argPatterns)) return;

  for (const pattern of rule.argPatterns) {
    const matchers = [
      ...(pattern.match?.anyArgMatches || []),
      ...(pattern.match?.argsMatch || []),
    ];
    for (const m of matchers) {
      // Extract literal command names from simple patterns like 'python', '^python$', '^(python|node)$'
      const literals = extractLiteralsFromPattern(m);
      for (const lit of literals) {
        if (lit !== rule.command && KNOWN_COMMANDS.has(lit)) {
          process.stderr.write(
            `[warden] Warning: rule for "${rule.command}" has argPattern matching "${lit}" — ` +
            `this won't work as expected. Rules are matched by the command being run, not its arguments. ` +
            `If you want to control "${lit}", add a separate rule with command: "${lit}".\n`
          );
        }
      }
    }
  }
}

function extractLiteralsFromPattern(pattern: string): string[] {
  // Strip common regex anchors/grouping
  let cleaned = pattern.replace(/^\^?\(?(.*?)\)?\$?$/, '$1');
  // Split on | for alternation groups
  return cleaned.split('|').map(s => s.trim()).filter(s => /^[a-z][a-z0-9_-]*$/i.test(s));
}

function extractLayer(raw: Record<string, unknown>): ConfigLayer {
  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  for (const rule of rules) {
    if (rule && typeof rule === 'object') {
      if (rule.default && !isValidDecision(rule.default)) {
        process.stderr.write(`[warden] Warning: invalid rule default "${rule.default}" for "${rule.command}", using "ask"\n`);
        rule.default = 'ask';
      }
      if (Array.isArray(rule.argPatterns)) {
        for (const pattern of rule.argPatterns) {
          if (pattern?.decision && !isValidDecision(pattern.decision)) {
            process.stderr.write(`[warden] Warning: invalid pattern decision "${pattern.decision}" for "${rule.command}", using "ask"\n`);
            pattern.decision = 'ask';
          }
        }
      }
      warnArgPatternCommandMismatch(rule);
    }
  }
  return {
    alwaysAllow: Array.isArray(raw.alwaysAllow) ? raw.alwaysAllow : [],
    alwaysDeny: Array.isArray(raw.alwaysDeny) ? raw.alwaysDeny : [],
    rules,
  };
}

export function parseTrustedList(raw: unknown[]): TrustedTarget[] {
  return raw.map(entry => {
    if (typeof entry === 'string') return { name: entry };
    if (entry && typeof entry === 'object' && 'name' in entry) {
      const obj = entry as Record<string, unknown>;
      const target: TrustedTarget = { name: String(obj.name) };
      if (obj.allowAll === true) target.allowAll = true;
      if (obj.overrides && typeof obj.overrides === 'object') {
        target.overrides = extractLayer(obj.overrides as Record<string, unknown>);
      }
      return target;
    }
    return null;
  }).filter((t): t is TrustedTarget => t !== null);
}

export function parseTargetPolicies(raw: unknown[]): TargetPolicy[] {
  const results: TargetPolicy[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || !('type' in entry)) {
      process.stderr.write(`[warden] Warning: targetPolicies entry missing "type" field, skipping\n`);
      continue;
    }
    const obj = entry as Record<string, unknown>;
    if (typeof obj.decision !== 'string' || !isValidDecision(obj.decision)) {
      process.stderr.write(`[warden] Warning: targetPolicies entry missing or invalid "decision", skipping\n`);
      continue;
    }
    const base = {
      decision: obj.decision,
      ...(typeof obj.reason === 'string' && { reason: obj.reason }),
      ...(Array.isArray(obj.commands) && { commands: obj.commands as string[] }),
      ...(obj.allowAll === true && { allowAll: true }),
    };
    switch (obj.type) {
      case 'path': {
        if (typeof obj.path !== 'string') {
          process.stderr.write(`[warden] Warning: path targetPolicy missing "path" field, skipping\n`);
          continue;
        }
        const policy: PathPolicy = { ...base, type: 'path', path: obj.path, recursive: typeof obj.recursive === 'boolean' ? obj.recursive : true };
        results.push(policy);
        break;
      }
      case 'database': {
        if (typeof obj.host !== 'string') {
          process.stderr.write(`[warden] Warning: database targetPolicy missing "host" field, skipping\n`);
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
          process.stderr.write(`[warden] Warning: endpoint targetPolicy missing "pattern" field, skipping\n`);
          continue;
        }
        const policy: EndpointPolicy = { ...base, type: 'endpoint', pattern: obj.pattern };
        results.push(policy);
        break;
      }
      default:
        process.stderr.write(`[warden] Warning: unknown targetPolicy type "${String(obj.type)}", skipping\n`);
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

function parseTrustedRemotes(raw: unknown[]): TrustedRemote[] {
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && 'context' in entry && 'name' in entry)
    .map(entry => {
      const remote: TrustedRemote = {
        name: String(entry.name),
        context: String(entry.context) as RemoteContext,
      };
      if (entry.allowAll === true) remote.allowAll = true;
      if (entry.overrides && typeof entry.overrides === 'object') {
        remote.overrides = extractLayer(entry.overrides as Record<string, unknown>);
      }
      return remote;
    });
}

function mergeNonLayerFields(config: WardenConfig, raw: Record<string, unknown>): void {
  // Unified trustedRemotes
  if (Array.isArray(raw.trustedRemotes)) {
    config.trustedRemotes = [...config.trustedRemotes, ...parseTrustedRemotes(raw.trustedRemotes)];
  }
  // Legacy keys → convert to trustedRemotes with context
  for (const [key, context] of Object.entries(LEGACY_REMOTE_MAP)) {
    if (Array.isArray(raw[key])) {
      process.stderr.write(`[warden] Warning: ${key} is deprecated, use trustedRemotes with context: "${context}" instead\n`);
      const targets = parseTrustedList(raw[key] as unknown[]);
      config.trustedRemotes = [...config.trustedRemotes, ...targets.map(t => ({ ...t, context }))];
    }
  }
  if (Array.isArray(raw.targetPolicies)) {
    config.targetPolicies = [...config.targetPolicies, ...parseTargetPolicies(raw.targetPolicies)];
  }
  if (typeof raw.defaultDecision === 'string') {
    if (isValidDecision(raw.defaultDecision)) {
      config.defaultDecision = raw.defaultDecision;
    } else {
      process.stderr.write(`[warden] Warning: invalid defaultDecision "${raw.defaultDecision}", ignoring\n`);
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
    const layer = extractLayer(overrides);
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
