import type {
  CommandRule, ArgPattern, MatchCondition, ConfigLayer,
  TrustedRemote, TrustedTarget, TargetPolicyBase, PathPolicy,
  DatabasePolicy, EndpointPolicy, WardenConfig,
} from './types';

// ── Levenshtein edit distance (iterative two-row) ──────────────────────────

export function editDistance(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  let curr = new Array(lb + 1);
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

export function nearestKey(
  key: string,
  known: Iterable<string>,
  maxDistance: number = 2,
): string | undefined {
  let best = '';
  let bestDist = Infinity;
  for (const candidate of known) {
    const d = editDistance(key, candidate);
    if (d <= maxDistance && d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return bestDist < Infinity ? best : undefined;
}

const COMMAND_RULE_SPEC: Record<keyof CommandRule, true> = {
  command: true, default: true, argPatterns: true, override: true,
};
export const KNOWN_COMMAND_RULE_KEYS: ReadonlySet<string> =
  new Set(Object.keys(COMMAND_RULE_SPEC));

const ARG_PATTERN_SPEC: Record<keyof ArgPattern, true> = {
  description: true, decision: true, reason: true, match: true,
};
export const KNOWN_ARG_PATTERN_KEYS: ReadonlySet<string> =
  new Set(Object.keys(ARG_PATTERN_SPEC));

const MATCH_CONDITION_SPEC: Record<keyof MatchCondition, true> = {
  argsMatch: true, anyArgMatches: true, noArgs: true,
  argCount: true, not: true,
};
export const KNOWN_MATCH_CONDITION_KEYS: ReadonlySet<string> =
  new Set(Object.keys(MATCH_CONDITION_SPEC));

const LAYER_SPEC: Record<keyof ConfigLayer, true> = {
  alwaysAllow: true, alwaysDeny: true, rules: true,
};
export const KNOWN_LAYER_KEYS: ReadonlySet<string> =
  new Set(Object.keys(LAYER_SPEC));

const TRUSTED_REMOTE_SPEC: Record<keyof TrustedRemote, true> = {
  name: true, context: true, allowAll: true, overrides: true,
};
export const KNOWN_TRUSTED_REMOTE_KEYS: ReadonlySet<string> =
  new Set(Object.keys(TRUSTED_REMOTE_SPEC));

const TRUSTED_TARGET_SPEC: Record<keyof TrustedTarget, true> = {
  name: true, allowAll: true, overrides: true,
};
export const KNOWN_TRUSTED_TARGET_KEYS: ReadonlySet<string> =
  new Set(Object.keys(TRUSTED_TARGET_SPEC));

const TARGET_POLICY_BASE_SPEC: Record<keyof TargetPolicyBase | 'type', true> = {
  type: true, decision: true, reason: true, commands: true, allowAll: true,
};
export const KNOWN_TARGET_POLICY_BASE_KEYS: ReadonlySet<string> =
  new Set(Object.keys(TARGET_POLICY_BASE_SPEC));

const PATH_POLICY_SPEC: Record<keyof PathPolicy, true> = {
  type: true, path: true, recursive: true,
  decision: true, reason: true, commands: true, allowAll: true,
};
export const KNOWN_PATH_POLICY_KEYS: ReadonlySet<string> =
  new Set(Object.keys(PATH_POLICY_SPEC));

const DATABASE_POLICY_SPEC: Record<keyof DatabasePolicy, true> = {
  type: true, host: true, port: true, database: true,
  decision: true, reason: true, commands: true, allowAll: true,
};
export const KNOWN_DATABASE_POLICY_KEYS: ReadonlySet<string> =
  new Set(Object.keys(DATABASE_POLICY_SPEC));

const ENDPOINT_POLICY_SPEC: Record<keyof EndpointPolicy, true> = {
  type: true, pattern: true,
  decision: true, reason: true, commands: true, allowAll: true,
};
export const KNOWN_ENDPOINT_POLICY_KEYS: ReadonlySet<string> =
  new Set(Object.keys(ENDPOINT_POLICY_SPEC));

export const LEGACY_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  'trustedSSHHosts',
  'trustedDockerContainers',
  'trustedKubectlContexts',
  'trustedSprites',
  'trustedFlyApps',
]);

export const WARDEN_CONFIG_FIELD_ORIGIN: Record<keyof WardenConfig, 'raw' | 'layer' | 'runtime'> = {
  layers: 'layer',
  warnings: 'runtime',
  trustedRemotes: 'raw',
  targetPolicies: 'raw',
  trustedContextOverrides: 'raw',
  defaultDecision: 'raw',
  askOnSubshell: 'raw',
  notifyOnAsk: 'raw',
  notifyOnDeny: 'raw',
  audit: 'raw',
  auditPath: 'raw',
  auditAllowDecisions: 'raw',
  sessionGuidance: 'raw',
  tempScriptDir: 'raw',
};

const RAW_KEYS = new Set(
  Object.entries(WARDEN_CONFIG_FIELD_ORIGIN)
    .filter(([, origin]) => origin === 'raw')
    .map(([key]) => key),
);

export const KNOWN_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  ...KNOWN_LAYER_KEYS,
  ...RAW_KEYS,
  ...LEGACY_TOP_LEVEL_KEYS,
]);
