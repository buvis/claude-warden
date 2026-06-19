import { homedir } from 'os';
import type {
  ParseResult, WardenConfig, EvalResult,
  CommandEvalDetail, ParsedCommand, CommandRule, ChainAssignment,
} from './types';
import { parseCommand } from './parser';
import { pathGlobToRegex } from './glob';
import { evaluateTargetPolicies } from './targets';
import { warn } from './rules';
import { tryRemoteExec } from './remote-exec';
import { trySubcommandRunner } from './subcommand-runner';
import { tryScriptEval } from './script-eval';

/** Safely test a regex pattern, returning false on invalid patterns. */
function safeRegexTest(pattern: string, input: string): boolean {
  try {
    return new RegExp(pattern).test(input);
  } catch {
    warn(`[warden] Warning: invalid regex pattern: ${pattern}\n`);
    return false;
  }
}

/** Expand leading ~/ to the user's home directory. */
function expandTilde(path: string): string {
  return path.startsWith('~/') ? homedir() + path.slice(1) : path;
}

/**
 * Match a config entry name against a parsed command.
 * If the name contains '/' (full path), match against originalCommand (with ~ expansion).
 * Glob patterns (* and **) are supported in path-based names.
 * Otherwise, match against the basename (current behavior).
 */
function commandMatchesName(cmd: ParsedCommand, name: string): boolean {
  if (name.includes('*')) {
    const expanded = expandTilde(name);
    const regexStr = pathGlobToRegex(expanded);
    try {
      const re = new RegExp(`^${regexStr}$`);
      // Path-based globs match originalCommand, basename globs match command
      const target = name.includes('/') ? expandTilde(cmd.originalCommand) : cmd.command;
      return re.test(target);
    } catch {
      return false;
    }
  }
  if (name.startsWith('/')) {
    return expandTilde(cmd.originalCommand) === name;
  }
  if (name.startsWith('~/')) {
    return expandTilde(cmd.originalCommand) === homedir() + name.slice(1);
  }
  return cmd.command === name;
}

const MAX_RECURSION_DEPTH = 10;

export function evaluate(parsed: ParseResult, config: WardenConfig, depth: number = 0, cwd?: string): EvalResult {
  if (depth > MAX_RECURSION_DEPTH) {
    return { decision: 'ask', reason: 'too many nested commands', details: [] };
  }

  if (parsed.parseError) {
    return { decision: 'ask', reason: 'unparseable command', details: [] };
  }

  if (parsed.incomplete) {
    const types = parsed.incompleteNodeTypes;
    const reason = types && types.length
      ? `unrecognized shell construct: ${types.join(', ')}`
      : 'unrecognized shell construct';
    return { decision: 'ask', reason, details: [] };
  }

  if (parsed.commands.length === 0) {
    return { decision: 'allow', reason: 'Empty command', details: [] };
  }

  // Recursively evaluate extracted subshell commands
  if (parsed.hasSubshell && parsed.subshellCommands.length > 0) {
    for (const subCmd of parsed.subshellCommands) {
      const subParsed = parseCommand(subCmd);
      const subResult = evaluate(subParsed, config, depth + 1, cwd);
      if (subResult.decision === 'deny') {
        return { decision: 'deny', reason: `Subshell command: ${subResult.reason}`, details: subResult.details };
      }
      if (subResult.decision === 'ask') {
        return { decision: 'ask', reason: `Subshell command: ${subResult.reason}`, details: subResult.details };
      }
    }
  } else if (parsed.hasSubshell && parsed.subshellCommands.length === 0 && config.askOnSubshell) {
    // Unparseable subshell (heredocs, complex constructs) - fall back to ask
    return { decision: 'ask', reason: 'contains subshell', details: [] };
  }

  const details: CommandEvalDetail[] = [];
  for (const cmd of parsed.commands) {
    details.push(evaluateCommand(cmd, config, depth, parsed.chainAssignments, cwd));
  }

  // Combine: deny > ask > allow
  const decisions = details.map(d => d.decision);

  if (decisions.includes('deny')) {
    const denied = details.filter(d => d.decision === 'deny');
    return {
      decision: 'deny',
      reason: denied.map(d => `${d.command}: ${d.reason}`).join('; '),
      details,
    };
  }

  if (decisions.includes('ask')) {
    const asked = details.filter(d => d.decision === 'ask');
    return {
      decision: 'ask',
      reason: asked.map(d => `${d.command}: ${d.reason}`).join('; '),
      details,
    };
  }

  return { decision: 'allow', reason: 'ok', details };
}

/** Everything a decision layer needs. Built once per command in evaluateCommand. */
interface EvalContext {
  cmd: ParsedCommand;
  config: WardenConfig;
  depth: number;
  chain?: Map<string, ChainAssignment>;
  cwd?: string;
}

/** A rung in the decision hierarchy: returns a decision, or null to defer to the next. */
type DecisionLayer = (ctx: EvalContext) => CommandEvalDetail | null;

// Explicit user policy: alwaysDeny wins over alwaysAllow, higher layers over lower.
const scopedAlwaysPolicy: DecisionLayer = ({ cmd, config }) => {
  for (const layer of config.layers) {
    if (layer.alwaysDeny.some(pattern => commandMatchesName(cmd, pattern))) {
      return { command: cmd.command, args: cmd.args, decision: 'deny', reason: 'blocked by policy', matchedRule: 'alwaysDeny' };
    }
    if (layer.alwaysAllow.some(pattern => commandMatchesName(cmd, pattern))) {
      return { command: cmd.command, args: cmd.args, decision: 'allow', reason: 'safe', matchedRule: 'alwaysAllow' };
    }
  }
  return null;
};

// Target-aware policies (path/database/endpoint). Ordered before any auto-allow so a
// user-configured target deny can't be bypassed by chain variable resolution.
const targetPolicyLayer: DecisionLayer = ({ cmd, config, cwd }) =>
  cwd && config.targetPolicies?.length ? evaluateTargetPolicies(cmd, cwd, config) : null;

// Auto-allow: command resolved from a static chain-local variable ($VAR → binary),
// allowed only when no matching rule exists (rules may carry dangerous-arg patterns).
const chainResolvedBinary: DecisionLayer = ({ cmd, config, chain }) => {
  if (!cmd.resolvedFrom || !chain) return null;
  const varMatch = cmd.resolvedFrom.match(/^\$\{?(\w+)\}?$/);
  if (!varMatch) return null;
  const assignment = chain.get(varMatch[1]);
  if (!assignment || assignment.isDynamic || assignment.value === null) return null;
  if (collectMergedRule(cmd, config)) return null;
  return { command: cmd.command, args: cmd.args, decision: 'allow', reason: `chain-local binary (${assignment.value})`, matchedRule: 'chainResolved' };
};

// Auto-allow: relative-path commands (target/debug/foo, ./build/bar) are project-local
// builds, not system commands — allowed when no user rule exists for the basename.
const localBinary: DecisionLayer = ({ cmd, config }) => {
  if (!cmd.originalPath || cmd.originalPath.startsWith('/') || cmd.originalPath.startsWith('~/')) return null;
  if (collectMergedRule(cmd, config)) return null;
  return { command: cmd.command, args: cmd.args, decision: 'allow', reason: `local binary (${cmd.originalPath})`, matchedRule: 'localBinary' };
};

// Auto-allow: rm -rf inside a temp dir reached via chain `cd`.
const tempDirRmLayer: DecisionLayer = ({ cmd, config }) =>
  cmd.command === 'rm' && cmd.effectiveCwd ? evaluateRmTempDir(cmd, config) : null;

// Auto-allow: rm -rf $VAR where VAR is chain-assigned (upgrades ask→allow only).
const chainLocalRmLayer: DecisionLayer = ({ cmd, config, chain, cwd }) =>
  cmd.command === 'rm' && chain?.size ? evaluateRmChainLocal(cmd, chain, config, cwd) : null;

// Specialized evaluators: trusted remote contexts, subcommand runners (uv/xargs/find/npx),
// and script-safety scanning (python/node/perl/ruby/php). Real evaluations, not defaults.
const specializedLayer: DecisionLayer = ({ cmd, config, depth, cwd }) =>
  tryRemoteExec(cmd, config, depth) ??
  trySubcommandRunner(cmd, config, depth, cwd) ??
  tryScriptEval(cmd, config, cwd);

// User command rules merged across config layers.
const commandRulesLayer: DecisionLayer = ({ cmd, config }) => {
  const merged = collectMergedRule(cmd, config);
  return merged ? evaluateRule(cmd, merged) : null;
};

// Explicit user policy is always evaluated first.
const PRE_LAYERS: DecisionLayer[] = [scopedAlwaysPolicy, targetPolicyLayer];

// Safety invariant lives here: auto-allow layers only upgrade the default "ask" for
// unknown commands — they never downgrade an explicit deny. Under defaultDecision
// 'deny' this whole group is skipped (see evaluateCommand), so no auto-allow can fire.
const AUTO_ALLOW_LAYERS: DecisionLayer[] = [chainResolvedBinary, localBinary, tempDirRmLayer, chainLocalRmLayer];

// Real evaluations that run regardless of defaultDecision.
const RESOLVE_LAYERS: DecisionLayer[] = [specializedLayer, commandRulesLayer];

export function evaluateCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0, chainAssignments?: Map<string, ChainAssignment>, cwd?: string): CommandEvalDetail {
  const ctx: EvalContext = { cmd, config, depth, chain: chainAssignments, cwd };

  // Explicit policy first → auto-allow (skipped entirely under defaultDecision 'deny')
  // → real evaluation → the configured default. First non-null decision wins.
  const autoAllow = config.defaultDecision === 'deny' ? [] : AUTO_ALLOW_LAYERS;
  for (const layer of [...PRE_LAYERS, ...autoAllow, ...RESOLVE_LAYERS]) {
    const result = layer(ctx);
    // Preserve chain-resolved provenance ($VAR → binary) on every decision for the audit log.
    if (result) return cmd.resolvedFrom ? { ...result, resolvedFrom: cmd.resolvedFrom } : result;
  }

  return {
    command: cmd.command,
    args: cmd.args,
    decision: config.defaultDecision,
    reason: 'unknown command',
    matchedRule: 'default',
    ...(cmd.resolvedFrom ? { resolvedFrom: cmd.resolvedFrom } : {}),
  };
}

function isTempDir(path: string): boolean {
  if (path === '/tmp' || path.startsWith('/tmp/')) return true;
  if (path === '/var/tmp' || path.startsWith('/var/tmp/')) return true;
  const envTmpdir = process.env.TMPDIR;
  if (envTmpdir) {
    const normalized = envTmpdir.endsWith('/') ? envTmpdir : envTmpdir + '/';
    if (path === envTmpdir || path.startsWith(normalized)) return true;
  }
  return false;
}

// Reached only via tempDirRmLayer, which the AUTO_ALLOW group skips under defaultDecision
// 'deny' — so no internal deny guard is needed here.
function evaluateRmTempDir(cmd: ParsedCommand, config: WardenConfig): CommandEvalDetail | null {
  const { command, args } = cmd;
  const hasRecursive = args.some(a => /^-[a-zA-Z]*r[a-zA-Z]*$/.test(a));
  if (!hasRecursive) return null;
  if (!cmd.effectiveCwd || !isTempDir(cmd.effectiveCwd)) return null;

  const targets = args.filter(a => !a.startsWith('-'));
  if (targets.length === 0) return null;

  // All targets must be relative and without traversal
  for (const t of targets) {
    if (t.startsWith('/')) return null;
    if (t.includes('..')) return null;
  }

  // Respect user rules: if any layer has rm rule with default deny or
  // argPattern-based deny, don't auto-allow.
  for (const layer of config.layers) {
    const rule = layer.rules.find(r => commandMatchesName(cmd, r.command));
    if (rule) {
      if (rule.default === 'deny') return null;
      const ruleResult = evaluateRule(cmd, rule);
      if (ruleResult.decision === 'deny') return null;
      break;
    }
  }

  return { command, args, decision: 'allow', reason: `temp directory cleanup (${cmd.effectiveCwd})`, matchedRule: 'tempDirRm' };
}

/** Match $VAR, ${VAR}, "$VAR", "${VAR}" - with optional surrounding quotes. */
const VAR_REF_REGEX = /^"?\$\{?(\w+)\}?"?$/;

function extractVarName(text: string): string | null {
  const m = text.match(VAR_REF_REGEX);
  return m ? m[1] : null;
}

// Reached only via chainLocalRmLayer, which the AUTO_ALLOW group skips under defaultDecision
// 'deny' — so no internal deny guard is needed here.
function evaluateRmChainLocal(cmd: ParsedCommand, chainAssignments: Map<string, ChainAssignment>, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  // Only handle recursive rm (the dangerous pattern)
  const hasRecursive = args.some(a => /^-[a-zA-Z]*r[a-zA-Z]*$/.test(a));
  if (!hasRecursive) return null;

  // Extract non-flag args (targets)
  const targets = args.filter(a => !a.startsWith('-'));
  if (targets.length === 0) return null;

  // Check if ALL targets are chain-local variables
  for (const target of targets) {
    const varName = extractVarName(target);
    if (!varName) return null;
    if (!chainAssignments.has(varName)) return null;
  }

  // Respect user rules: if any layer's rule default is deny, don't override.
  // Check layer rules directly - merged argPatterns from lower layers shouldn't
  // mask a higher-priority layer's intent to deny.
  for (const layer of config.layers) {
    const rule = layer.rules.find(r => commandMatchesName(cmd, r.command));
    if (rule) {
      if (rule.default === 'deny') return null;
      // Also check if any argPattern explicitly denies this specific invocation
      const ruleResult = evaluateRule(cmd, rule);
      if (ruleResult.decision === 'deny') return null;
      break; // highest-priority layer wins
    }
  }

  // Check target policies against resolved variable values
  if (cwd && config.targetPolicies?.length) {
    const resolvedArgs = args.map(arg => {
      const varName = extractVarName(arg);
      if (varName) {
        const assignment = chainAssignments.get(varName);
        if (assignment?.value) return assignment.value;
      }
      return arg;
    });
    const resolvedCmd: ParsedCommand = { ...cmd, args: resolvedArgs };
    const targetResult = evaluateTargetPolicies(resolvedCmd, cwd, config);
    if (targetResult && targetResult.decision === 'deny') {
      // Return deny to prevent fallthrough to normal rule evaluation
      return { command, args, decision: 'deny', reason: targetResult.reason, matchedRule: targetResult.matchedRule };
    }
  }

  return { command, args, decision: 'allow', reason: 'chain-local cleanup', matchedRule: 'chainLocalRm' };
}

/**
 * Collect matching rules across all layers and merge them.
 * Rules are merged by concatenating argPatterns in layer priority order.
 * The `default` decision comes from the highest-priority layer that defines a rule.
 * If any rule has `override: true`, stop collecting from lower layers.
 */
export function collectMergedRule(cmd: ParsedCommand, config: WardenConfig): CommandRule | null {
  const matchingRules: CommandRule[] = [];

  for (const layer of config.layers) {
    const rule = layer.rules.find(r => commandMatchesName(cmd, r.command));
    if (rule) {
      matchingRules.push(rule);
      if (rule.override) break;
    }
  }

  if (matchingRules.length === 0) return null;
  if (matchingRules.length === 1) return matchingRules[0];

  const mergedPatterns: CommandRule['argPatterns'] = [];
  for (const rule of matchingRules) {
    if (rule.argPatterns) {
      mergedPatterns.push(...rule.argPatterns);
    }
  }

  return {
    command: matchingRules[0].command,
    default: matchingRules[0].default,
    argPatterns: mergedPatterns,
  };
}

function evaluateRule(cmd: ParsedCommand, rule: CommandRule): CommandEvalDetail {
  const { command, args } = cmd;
  const argsJoined = args.join(' ');

  for (const pattern of rule.argPatterns || []) {
    const m = pattern.match;
    let matched = true;

    if (m.noArgs !== undefined) {
      matched = matched && (m.noArgs === (args.length === 0));
    }

    if (m.argsMatch && matched) {
      matched = m.argsMatch.some(re => safeRegexTest(re, argsJoined));
    }

    if (m.anyArgMatches && matched) {
      matched = args.some(arg => m.anyArgMatches!.some(re => safeRegexTest(re, arg)));
    }

    if (m.argCount && matched) {
      if (m.argCount.min !== undefined) matched = matched && args.length >= m.argCount.min;
      if (m.argCount.max !== undefined) matched = matched && args.length <= m.argCount.max;
    }

    if (m.not) matched = !matched;

    if (matched) {
      return {
        command, args,
        decision: pattern.decision,
        reason: pattern.reason || pattern.description || `Matched pattern for "${command}"`,
        matchedRule: `${command}:argPattern`,
      };
    }
  }

  // No pattern matched → use rule default
  return {
    command, args,
    decision: rule.default,
    reason: 'needs review',
    matchedRule: `${command}:default`,
  };
}
