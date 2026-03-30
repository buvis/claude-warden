import { homedir } from 'os';
import type {
  ParseResult, WardenConfig, EvalResult, Decision,
  CommandEvalDetail, ParsedCommand, CommandRule, TrustedTarget,
  TrustedRemote, ChainAssignment,
} from './types';
import { parseCommand } from './parser';
import { scanScriptCode, readScriptFile } from './script-scanner';
import { globToRegex, pathGlobToRegex } from './glob';
import { evaluateTargetPolicies } from './targets';

/** Safely test a regex pattern, returning false on invalid patterns. */
function safeRegexTest(pattern: string, input: string): boolean {
  try {
    return new RegExp(pattern).test(input);
  } catch {
    process.stderr.write(`[warden] Warning: invalid regex pattern: ${pattern}\n`);
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

function evaluateCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0, chainAssignments?: Map<string, ChainAssignment>, cwd?: string): CommandEvalDetail {
  const { command, args } = cmd;
  const detail = (d: CommandEvalDetail): CommandEvalDetail => {
    if (cmd.resolvedFrom) d.resolvedFrom = cmd.resolvedFrom;
    return d;
  };

  // 1. Scoped alwaysDeny → alwaysAllow per layer (workspace > user > default)
  for (const layer of config.layers) {
    if (layer.alwaysDeny.some(name => commandMatchesName(cmd, name))) {
      return detail({ command, args, decision: 'deny', reason: 'blocked by policy', matchedRule: 'alwaysDeny' });
    }
    if (layer.alwaysAllow.some(name => commandMatchesName(cmd, name))) {
      return detail({ command, args, decision: 'allow', reason: 'safe', matchedRule: 'alwaysAllow' });
    }
  }

  // 1b. Target-aware policies (path, database, endpoint)
  // Checked before chain-resolved auto-allow so user-configured target denies
  // can't be bypassed by chain variable resolution.
  if (cwd && config.targetPolicies?.length) {
    const targetResult = evaluateTargetPolicies(cmd, cwd, config);
    if (targetResult) return detail(targetResult);
  }

  // 1c. Chain-resolved command auto-allow: if command was resolved from a static
  // chain-local variable, didn't hit alwaysDeny/alwaysAllow/targetPolicies,
  // AND has no matching rules (which may contain deny/ask patterns for dangerous args),
  // auto-allow it.
  if (cmd.resolvedFrom && chainAssignments) {
    const varMatch = cmd.resolvedFrom.match(/^\$\{?(\w+)\}?$/);
    if (varMatch) {
      const assignment = chainAssignments.get(varMatch[1]);
      if (assignment && !assignment.isDynamic && assignment.value !== null) {
        // Only auto-allow if no rules exist - rules may have dangerous-arg patterns
        if (!collectMergedRule(cmd, config)) {
          return detail({ command, args, decision: 'allow', reason: `chain-local binary (${assignment.value})`, matchedRule: 'chainResolved' });
        }
      }
    }
  }

  // 1c.5. Local binary auto-allow: relative-path commands (e.g. target/debug/foo,
  // ./build/bar) are project-local builds, not system commands. Auto-allow if no
  // user rules exist for the basename.
  if (cmd.originalPath && !cmd.originalPath.startsWith('/') && !cmd.originalPath.startsWith('~/')) {
    if (!collectMergedRule(cmd, config)) {
      return detail({ command, args, decision: 'allow', reason: `local binary (${cmd.originalPath})`, matchedRule: 'localBinary' });
    }
  }

  // 1d. Temp directory rm auto-allow: rm -rf in chain with cd to temp dir.
  if (command === 'rm' && cmd.effectiveCwd) {
    const tempResult = evaluateRmTempDir(cmd, config);
    if (tempResult) return detail(tempResult);
  }

  // 1d.2. Chain-local rm cleanup: rm -rf $VAR where VAR is chain-assigned.
  // Only upgrades ask→allow - if rules would deny, respect that.
  // Resolves variables for target policy checking.
  if (command === 'rm' && chainAssignments?.size) {
    const rmResult = evaluateRmChainLocal(cmd, chainAssignments, config, cwd);
    if (rmResult) return detail(rmResult);
  }

  // 2. Remote target whitelisting with recursive command evaluation
  const remotes = config.trustedRemotes || [];
  if ((command === 'ssh' || command === 'scp' || command === 'rsync')) {
    const targets = remotes.filter(t => t.context === 'ssh');
    if (targets.length) {
      const sshResult = evaluateSSHCommand(cmd, config, targets, depth);
      if (sshResult) return sshResult;
    }
  }
  if (command === 'docker') {
    const targets = remotes.filter(t => t.context === 'docker');
    if (targets.length) {
      const dockerResult = evaluateDockerExec(cmd, config, targets, depth);
      if (dockerResult) return dockerResult;
    }
  }
  if (command === 'kubectl') {
    const targets = remotes.filter(t => t.context === 'kubectl');
    if (targets.length) {
      const kubectlResult = evaluateKubectlExec(cmd, config, targets, depth);
      if (kubectlResult) return kubectlResult;
    }
  }
  if (command === 'sprite') {
    const targets = remotes.filter(t => t.context === 'sprite');
    if (targets.length) {
      const spriteResult = evaluateSpriteExec(cmd, config, targets, depth);
      if (spriteResult) return spriteResult;
    }
  }
  if (command === 'fly' || command === 'flyctl') {
    const targets = remotes.filter(t => t.context === 'fly');
    if (targets.length) {
      const flyResult = evaluateFlyCommand(cmd, config, targets, depth);
      if (flyResult) return flyResult;
    }
  }
  if (command === 'uv') {
    const uvResult = evaluateUvCommand(cmd, config, depth);
    if (uvResult) return uvResult;
  }
  if (command === 'xargs') {
    return evaluateXargsCommand(cmd, config, depth);
  }
  if (command === 'find') {
    return evaluateFindCommand(cmd, config, depth);
  }

  // 2b. Package runner recursive evaluation (npx/bunx/pnpx → subcommand with evaluator)
  if (command === 'npx' || command === 'bunx' || command === 'pnpx') {
    const pkgResult = evaluatePkgRunnerSubcommand(cmd, config, depth, cwd);
    if (pkgResult) return pkgResult;
  }

  // 2c. Script safety scanning - language-specific evaluators
  if (command === 'python' || command === 'python3') {
    const pyResult = evaluatePythonCommand(cmd, config, depth, cwd);
    if (pyResult) return pyResult;
  }
  if (command === 'node' || command === 'tsx' || command === 'ts-node') {
    const nodeResult = evaluateNodeCommand(cmd, config, depth, cwd);
    if (nodeResult) return nodeResult;
  }
  if (command === 'perl') {
    const perlResult = evaluatePerlCommand(cmd, config, depth, cwd);
    if (perlResult) return perlResult;
  }

  // 3. Scoped command rules - collect and merge across layers
  const mergedRule = collectMergedRule(cmd, config);
  if (mergedRule) {
    return evaluateRule(cmd, mergedRule);
  }

  // 4. Default
  return { command, args, decision: config.defaultDecision, reason: 'unknown command', matchedRule: 'default' };
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
function collectMergedRule(cmd: ParsedCommand, config: WardenConfig): CommandRule | null {
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

// ─── uv run recursive evaluation ───

/** uv run flags that consume the next argument. */
const UV_RUN_FLAGS_WITH_VALUE = new Set([
  '--with', '--from', '--python', '--package', '--index', '--extra-index-url',
  '--cache-dir', '--index-strategy', '--keyring-provider',
]);

/** uv run boolean flags (no value). */
const UV_RUN_FLAGS_NO_VALUE = new Set([
  '--no-cache', '--locked', '--frozen', '--isolated',
  '--verbose', '--quiet', '--no-project',
]);

function parseUvRunSubcommand(args: string[]): { subcommand: ParsedCommand | null; unresolved: boolean } {
  // args[0] is 'run', skip it
  let i = 1;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--') {
      i++;
      break;
    }

    if (!arg.startsWith('-')) {
      break;
    }

    // Handle --flag=value syntax
    if (arg.startsWith('--') && arg.includes('=')) {
      const flagName = arg.slice(0, arg.indexOf('='));
      if (UV_RUN_FLAGS_WITH_VALUE.has(flagName) || UV_RUN_FLAGS_NO_VALUE.has(flagName)) {
        i++;
        continue;
      }
      return { subcommand: null, unresolved: true };
    }

    if (UV_RUN_FLAGS_WITH_VALUE.has(arg)) {
      if (i + 1 >= args.length) return { subcommand: null, unresolved: true };
      i += 2;
      continue;
    }

    if (UV_RUN_FLAGS_NO_VALUE.has(arg)) {
      i++;
      continue;
    }

    // Unknown flag - can't safely resolve
    return { subcommand: null, unresolved: true };
  }

  if (i >= args.length) {
    return { subcommand: null, unresolved: false };
  }

  const subcmd = args[i];
  const subArgs = args.slice(i + 1);
  return {
    unresolved: false,
    subcommand: {
      command: subcmd.includes('/') ? subcmd.split('/').pop()! : subcmd,
      originalCommand: subcmd,
      args: subArgs,
      envPrefixes: [],
      raw: [subcmd, ...subArgs].join(' '),
    },
  };
}

function evaluateUvCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0): CommandEvalDetail | null {
  const { command, args } = cmd;
  if (args[0] !== 'run') return null;

  const { subcommand, unresolved } = parseUvRunSubcommand(args);

  if (unresolved || !subcommand) {
    if (unresolved) {
      return {
        command, args,
        decision: 'ask',
        reason: 'uv run: inner command could not be resolved safely',
        matchedRule: 'uv:run',
      };
    }
    // No inner command (bare `uv run`) - fall through to rules
    return null;
  }

  const parsed: ParseResult = {
    commands: [subcommand],
    hasSubshell: false,
    subshellCommands: [],
    parseError: false,
    chainAssignments: new Map(),
  };

  const result = evaluate(parsed, config, depth + 1);

  return {
    command, args,
    decision: result.decision,
    reason: `uv run: ${result.reason}`,
    matchedRule: 'uv:run',
  };
}

/** xargs short flags that consume a value. */
const XARGS_SHORT_FLAGS_WITH_VALUE = new Set(['E', 'I', 'L', 'n', 'P', 's', 'S', 'd', 'a']);
/** xargs short flags that do not consume a value. */
const XARGS_SHORT_FLAGS_NO_VALUE = new Set(['0', 'e', 'o', 'p', 'r', 't', 'x']);
/** xargs long flags that consume a value. */
const XARGS_LONG_FLAGS_WITH_VALUE = new Set([
  '--eof', '--replace', '--max-lines', '--max-args', '--max-procs', '--max-chars',
  '--arg-file', '--delimiter',
]);
/** xargs long flags that do not consume a value. */
const XARGS_LONG_FLAGS_NO_VALUE = new Set([
  '--null', '--exit', '--open-tty', '--interactive', '--no-run-if-empty',
  '--verbose', '--show-limits',
]);

function parseXargsSubcommand(args: string[]): { subcommand: ParsedCommand | null; unresolved: boolean } {
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--') {
      i++;
      break;
    }

    if (!arg.startsWith('-') || arg === '-') {
      break;
    }

    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      const longFlag = eqIndex === -1 ? arg : arg.slice(0, eqIndex);

      if (XARGS_LONG_FLAGS_WITH_VALUE.has(longFlag)) {
        if (eqIndex !== -1) {
          i++;
          continue;
        }
        if (i + 1 >= args.length) return { subcommand: null, unresolved: true };
        i += 2;
        continue;
      }

      if (XARGS_LONG_FLAGS_NO_VALUE.has(longFlag)) {
        i++;
        continue;
      }

      return { subcommand: null, unresolved: true };
    }

    const short = arg[1];
    if (XARGS_SHORT_FLAGS_WITH_VALUE.has(short)) {
      // Inline value form, e.g. -n1 / -I{}
      if (arg.length > 2) {
        i++;
        continue;
      }
      if (i + 1 >= args.length) return { subcommand: null, unresolved: true };
      i += 2;
      continue;
    }

    // Grouped short flags, e.g. -0rt
    const grouped = arg.slice(1).split('');
    const allKnownNoValue = grouped.every(ch => XARGS_SHORT_FLAGS_NO_VALUE.has(ch));
    if (allKnownNoValue) {
      i++;
      continue;
    }

    return { subcommand: null, unresolved: true };
  }

  // No explicit command means xargs defaults to `echo`.
  if (i >= args.length) {
    return {
      unresolved: false,
      subcommand: {
        command: 'echo',
        originalCommand: 'echo',
        args: [],
        envPrefixes: [],
        raw: 'echo',
      },
    };
  }

  const subcommand = args[i];
  const subArgs = args.slice(i + 1);
  return {
    unresolved: false,
    subcommand: {
      command: subcommand,
      originalCommand: subcommand,
      args: subArgs,
      envPrefixes: [],
      raw: [subcommand, ...subArgs].join(' '),
    },
  };
}

function evaluateXargsCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0): CommandEvalDetail {
  const { command, args } = cmd;
  const { subcommand, unresolved } = parseXargsSubcommand(args);

  if (unresolved || !subcommand) {
    return {
      command,
      args,
      decision: 'ask',
      reason: 'xargs subcommand could not be resolved safely',
      matchedRule: 'xargs:subcommand',
    };
  }

  // Handle sh/bash/zsh -c "..." - recursively parse inner command
  const isShellExec =
    (subcommand.command === 'sh' || subcommand.command === 'bash' || subcommand.command === 'zsh') &&
    subcommand.args.length >= 2 &&
    subcommand.args[0] === '-c';

  let parsed: ParseResult;
  if (isShellExec) {
    const innerResult = parseCommand(subcommand.args[1]);
    if (innerResult.parseError) {
      parsed = { commands: [subcommand], hasSubshell: false, subshellCommands: [], parseError: false, chainAssignments: new Map() };
    } else {
      parsed = innerResult;
    }
  } else {
    parsed = { commands: [subcommand], hasSubshell: false, subshellCommands: [], parseError: false, chainAssignments: new Map() };
  }

  const result = evaluate(parsed, config, depth + 1);

  return {
    command,
    args,
    decision: result.decision,
    reason: `xargs subcommand "${subcommand.command}": ${result.reason}`,
    matchedRule: 'xargs:subcommand',
  };
}

// ─── find -exec whitelisting ───

function parseFindExecCommands(args: string[]): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  let i = 0;

  while (i < args.length) {
    if (args[i] === '-exec' || args[i] === '-execdir') {
      i++;
      const cmdArgs: string[] = [];
      while (i < args.length && args[i] !== ';' && args[i] !== '+') {
        if (args[i] !== '{}') {
          cmdArgs.push(args[i]);
        }
        i++;
      }
      i++; // skip terminator
      if (cmdArgs.length > 0) {
        commands.push({
          command: cmdArgs[0],
          originalCommand: cmdArgs[0],
          args: cmdArgs.slice(1),
          envPrefixes: [],
          raw: cmdArgs.join(' '),
        });
      }
    } else {
      i++;
    }
  }

  return commands;
}

function evaluateFindCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0): CommandEvalDetail {
  const { command, args } = cmd;

  // -delete, -ok, -okdir are inherently dangerous
  if (args.some(a => a === '-delete')) {
    return { command, args, decision: 'ask', reason: 'find -delete can remove files', matchedRule: 'find:delete' };
  }
  if (args.some(a => a === '-ok' || a === '-okdir')) {
    return { command, args, decision: 'ask', reason: 'find -ok/-okdir can execute commands interactively', matchedRule: 'find:ok' };
  }

  // Extract and evaluate -exec/-execdir commands
  const execCommands = parseFindExecCommands(args);

  if (execCommands.length === 0) {
    return { command, args, decision: 'allow', reason: 'find without dangerous flags', matchedRule: 'find:safe' };
  }

  for (const execCmd of execCommands) {
    const parsed: ParseResult = {
      commands: [execCmd],
      hasSubshell: false,
      subshellCommands: [],
      parseError: false,
      chainAssignments: new Map(),
    };
    const result = evaluate(parsed, config, depth + 1);
    if (result.decision === 'deny') {
      return { command, args, decision: 'deny', reason: `find -exec: ${result.reason}`, matchedRule: 'find:exec' };
    }
    if (result.decision === 'ask') {
      return { command, args, decision: 'ask', reason: `find -exec: ${result.reason}`, matchedRule: 'find:exec' };
    }
  }

  return { command, args, decision: 'allow', reason: 'find -exec commands are safe', matchedRule: 'find:exec' };
}

/** SSH flags that consume the next argument (skip it when extracting host). */
const SSH_FLAGS_WITH_VALUE = new Set([
  '-b', '-c', '-D', '-E', '-e', '-F', '-I', '-i', '-J', '-L',
  '-l', '-m', '-O', '-o', '-p', '-Q', '-R', '-S', '-W', '-w',
]);

function matchesPattern(value: string, targets: TrustedTarget[]): boolean {
  return targets.some(t => globToRegex(t.name).test(value));
}

function findMatchingTarget(value: string, targets: TrustedTarget[]): TrustedTarget | null {
  return targets.find(t => globToRegex(t.name).test(value)) || null;
}

interface SSHParseResult {
  host: string | null;
  remoteCommand: string | null;
}

function parseSSHArgs(args: string[]): SSHParseResult {
  let host: string | null = null;
  const remoteArgs: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (SSH_FLAGS_WITH_VALUE.has(arg)) {
      i += 2; // skip flag and its value
      continue;
    }
    if (arg.startsWith('-')) {
      i++; // boolean flag
      continue;
    }
    // First positional arg is host
    if (!host) {
      host = arg.includes('@') ? arg.split('@').pop()! : arg;
      i++;
      // Remaining positional args are the remote command
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }
    i++;
  }

  return {
    host,
    remoteCommand: remoteArgs.length > 0 ? remoteArgs.map(shellQuote).join(' ') : null,
  };
}

/** Extract host from scp/rsync args like `[user@]host:path`. */
function extractHostFromRemotePath(args: string[]): string | null {
  for (const arg of args) {
    const match = arg.match(/^(?:[^@]+@)?([^:]+):/);
    if (match) return match[1];
  }
  return null;
}

function evaluateSSHCommand(cmd: ParsedCommand, config: WardenConfig, targets: TrustedRemote[], depth: number = 0): CommandEvalDetail | null {
  const { command, args } = cmd;
  const trustedHosts = targets;

  if (command === 'scp' || command === 'rsync') {
    const host = extractHostFromRemotePath(args);
    if (!host) return null;
    const target = findMatchingTarget(host, trustedHosts);
    if (!target) return null;
    if (target.allowAll || !target.overrides) {
      return {
        command, args,
        decision: 'allow',
        reason: `Trusted SSH host "${host}"${target.allowAll ? ' (allowAll)' : ''}`,
        matchedRule: 'trustedRemotes:ssh',
      };
    }
    if (target.overrides.alwaysDeny.some(name => name === command)) {
      return {
        command, args,
        decision: 'deny',
        reason: `Trusted SSH host "${host}": "${command}" blocked by overrides`,
        matchedRule: 'trustedRemotes:ssh',
      };
    }
    return {
      command, args,
      decision: 'allow',
      reason: `Trusted SSH host "${host}"`,
      matchedRule: 'trustedRemotes:ssh',
    };
  }

  // ssh
  const { host, remoteCommand } = parseSSHArgs(args);
  if (!host) return null;
  const target = findMatchingTarget(host, trustedHosts);
  if (!target) return null;

  // Trusted host, no remote command
  if (!remoteCommand) {
    return {
      command, args,
      decision: 'allow',
      reason: `Trusted SSH host "${host}" (interactive)`,
      matchedRule: 'trustedRemotes:ssh',
    };
  }

  // Trusted host with remote command - recursively evaluate with context overrides
  if (target.allowAll) {
    return {
      command, args,
      decision: 'allow',
      reason: `Trusted SSH host "${host}" (allowAll)`,
      matchedRule: 'trustedRemotes:ssh',
    };
  }
  const parsed = parseCommand(remoteCommand);
  const result = evaluate(parsed, configWithContextOverrides(config, target), depth + 1);
  return {
    command, args,
    decision: result.decision,
    reason: `Trusted SSH host "${host}": ${result.reason}`,
    matchedRule: 'trustedRemotes:ssh',
  };
}

// ─── Docker exec whitelisting ───

/** docker exec flags that consume the next argument. */
const DOCKER_EXEC_FLAGS_WITH_VALUE = new Set([
  '-e', '--env', '--env-file', '-u', '--user', '-w', '--workdir', '--detach-keys',
]);

interface ExecParseResult {
  target: string | null;
  remoteArgs: string[];
}

/** Shell interpreters that are safe as interactive sessions on trusted remotes. */
const INTERACTIVE_SHELLS = new Set(['bash', 'sh', 'zsh']);

/** Re-quote an arg if it contains spaces or shell metacharacters. */
function shellQuote(arg: string): string {
  if (/[\s"'\\$`!#&|;()<>]/.test(arg)) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}

/** Build a config with trustedContextOverrides applied as the highest-priority layer. */
function configWithContextOverrides(config: WardenConfig, target?: TrustedTarget | null): WardenConfig {
  const overrideLayers = [];
  // Per-target overrides take highest priority
  if (target?.overrides) overrideLayers.push(target.overrides);
  // Global overrides are baseline
  if (config.trustedContextOverrides) overrideLayers.push(config.trustedContextOverrides);
  if (overrideLayers.length === 0) return config;
  return {
    ...config,
    layers: [...overrideLayers, ...config.layers],
  };
}

/**
 * Evaluate remote command args from a trusted remote context (docker, kubectl, sprite).
 * Handles: no command (interactive), bare shell, shell -c "...", and normal commands.
 * Uses structured args to avoid losing quote context from join+re-parse.
 */
function evaluateRemoteCommand(
  remoteArgs: string[],
  config: WardenConfig,
  target?: TrustedTarget | null,
  depth: number = 0,
): EvalResult {
  if (target?.allowAll) {
    return { decision: 'allow', reason: 'allowAll target', details: [] };
  }
  const overriddenConfig = configWithContextOverrides(config, target);

  if (remoteArgs.length === 0) {
    return { decision: 'allow', reason: 'interactive', details: [] };
  }

  const remoteCmd = remoteArgs[0];

  // Bare shell invocation (e.g. `bash`, `sh`) → interactive session
  if (INTERACTIVE_SHELLS.has(remoteCmd) && remoteArgs.length === 1) {
    return { decision: 'allow', reason: 'interactive shell', details: [] };
  }

  // Shell -c "..." → evaluate the inner command string (which preserves pipes/operators)
  if (INTERACTIVE_SHELLS.has(remoteCmd) && remoteArgs[1] === '-c' && remoteArgs.length >= 3) {
    const innerCommand = remoteArgs.slice(2).join(' ');
    const parsed = parseCommand(innerCommand);
    return evaluate(parsed, overriddenConfig, depth + 1);
  }

  // Normal command - construct a ParsedCommand directly from structured args
  const parsed: ParseResult = {
    commands: [{ command: remoteCmd, originalCommand: remoteCmd, args: remoteArgs.slice(1), envPrefixes: [], raw: remoteArgs.join(' ') }],
    hasSubshell: false,
    subshellCommands: [],
    parseError: false,
    chainAssignments: new Map(),
  };
  return evaluate(parsed, overriddenConfig, depth + 1);
}

function parseDockerExecArgs(args: string[]): ExecParseResult {
  let target: string | null = null;
  const remoteArgs: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (DOCKER_EXEC_FLAGS_WITH_VALUE.has(arg)) {
      i += 2;
      continue;
    }
    if (arg.startsWith('-')) {
      i++;
      continue;
    }
    if (!target) {
      target = arg;
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }
    i++;
  }

  return { target, remoteArgs };
}

function evaluateDockerExec(cmd: ParsedCommand, config: WardenConfig, targets: TrustedRemote[], depth: number = 0): CommandEvalDetail | null {
  const { command, args } = cmd;
  if (args[0] !== 'exec') return null;

  const { target: containerName, remoteArgs } = parseDockerExecArgs(args.slice(1));
  if (!containerName) return null;
  const matched = findMatchingTarget(containerName, targets);
  if (!matched) return null;

  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command, args,
    decision: result.decision,
    reason: `Trusted Docker container "${containerName}" (${result.reason})`,
    matchedRule: 'trustedRemotes:docker',
  };
}

// ─── kubectl exec whitelisting ───

/** kubectl flags that consume the next argument (relevant to exec). */
const KUBECTL_FLAGS_WITH_VALUE = new Set([
  '-n', '--namespace', '-c', '--container', '--context', '--cluster',
  '--kubeconfig', '-s', '--server', '--token', '--user', '--as',
  '--as-group', '--certificate-authority', '--client-certificate',
  '--client-key', '-l', '--selector', '-f', '--filename',
  '--cache-dir', '--request-timeout', '-o', '--output',
]);

function parseKubectlExecArgs(args: string[]): { context: string | null; pod: string | null; remoteArgs: string[] } {
  let context: string | null = null;
  let pod: string | null = null;
  const remoteArgs: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--') {
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }

    // Handle --flag=value syntax
    if (arg.startsWith('--') && arg.includes('=')) {
      if (arg.startsWith('--context=')) {
        context = arg.split('=')[1];
      }
      i++;
      continue;
    }

    if (KUBECTL_FLAGS_WITH_VALUE.has(arg)) {
      if (arg === '--context') context = args[i + 1] || null;
      i += 2;
      continue;
    }
    if (arg.startsWith('-')) {
      i++;
      continue;
    }
    // First positional arg is the pod
    if (!pod) {
      pod = arg;
    }
    i++;
  }

  return { context, pod, remoteArgs };
}

function evaluateKubectlExec(cmd: ParsedCommand, config: WardenConfig, targets: TrustedRemote[], depth: number = 0): CommandEvalDetail | null {
  const { command, args } = cmd;
  if (args[0] !== 'exec') return null;

  const { context, pod, remoteArgs } = parseKubectlExecArgs(args.slice(1));
  if (!context) return null;
  const matched = findMatchingTarget(context, targets);
  if (!matched) return null;

  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command, args,
    decision: result.decision,
    reason: `Trusted kubectl context "${context}"${pod ? `, pod "${pod}"` : ''} (${result.reason})`,
    matchedRule: 'trustedRemotes:kubectl',
  };
}

// ─── Sprite exec whitelisting ───

/** sprite global flags that consume the next argument. */
const SPRITE_FLAGS_WITH_VALUE = new Set([
  '-o', '--org', '-s', '--sprite',
]);

function parseSpriteExecArgs(args: string[]): { spriteName: string | null; remoteArgs: string[] } {
  let spriteName: string | null = null;
  const remoteArgs: string[] = [];
  let foundExec = false;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    // Handle --flag=value syntax
    if (arg.startsWith('--') && arg.includes('=')) {
      if (arg.startsWith('--sprite=')) {
        spriteName = arg.split('=')[1];
      }
      i++;
      continue;
    }

    if (SPRITE_FLAGS_WITH_VALUE.has(arg)) {
      if (arg === '-s' || arg === '--sprite') {
        spriteName = args[i + 1] || null;
      }
      i += 2;
      continue;
    }

    if (arg === '--debug') {
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      i++;
      continue;
    }

    // Look for "exec", "x", "console", or "c" subcommand
    if (!foundExec) {
      if (arg === 'exec' || arg === 'x' || arg === 'console' || arg === 'c') {
        foundExec = true;
        i++;
        continue;
      }
      // Unknown positional before subcommand - bail
      return { spriteName: null, remoteArgs: [] };
    }

    // After exec subcommand, remaining args are the remote command
    while (i < args.length) {
      remoteArgs.push(args[i]);
      i++;
    }
    break;
  }

  return { spriteName, remoteArgs };
}

function evaluateSpriteExec(cmd: ParsedCommand, config: WardenConfig, targets: TrustedRemote[], depth: number = 0): CommandEvalDetail | null {
  const { command, args } = cmd;
  const { spriteName, remoteArgs } = parseSpriteExecArgs(args);
  if (!spriteName) return null;
  const matched = findMatchingTarget(spriteName, targets);
  if (!matched) return null;

  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command, args,
    decision: result.decision,
    reason: `Trusted sprite "${spriteName}" (${result.reason})`,
    matchedRule: 'trustedRemotes:sprite',
  };
}

// ─── Fly.io SSH whitelisting ───

/** Fly SSH flags that consume the next argument. */
const FLY_SSH_FLAGS_WITH_VALUE = new Set([
  '-a', '--app', '-C', '--command', '-o', '--org', '-r', '--region',
  '-u', '--user', '--address',
]);

interface FlySSHParseResult {
  app: string | null;
  remoteArgs: string[];
  isSSH: boolean;
}

function parseFlySSHArgs(args: string[]): FlySSHParseResult {
  let app: string | null = null;
  const remoteArgs: string[] = [];
  let isSSH = false;
  let foundConsole = false;
  let i = 0;

  // Look for `ssh console` subcommand sequence
  while (i < args.length) {
    const arg = args[i];

    // Handle --app=value syntax
    if (arg.startsWith('--app=')) {
      app = arg.slice(6);
      i++;
      continue;
    }

    if (FLY_SSH_FLAGS_WITH_VALUE.has(arg)) {
      if (arg === '-a' || arg === '--app') {
        app = args[i + 1] || null;
      }
      if ((arg === '-C' || arg === '--command') && foundConsole) {
        // Everything after -C is the remote command
        const cmdValue = args[i + 1];
        if (cmdValue) {
          // Parse the command string into args
          const parsed = parseCommand(cmdValue);
          if (!parsed.parseError && parsed.commands.length > 0) {
            const cmd = parsed.commands[0];
            remoteArgs.push(cmd.command, ...cmd.args);
          }
        }
        i += 2;
        continue;
      }
      i += 2;
      continue;
    }

    if (arg === '--') {
      // Everything after -- is the remote command
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }

    if (arg.startsWith('-')) {
      i++;
      continue;
    }

    // Positional args: look for ssh -> console
    if (!isSSH && arg === 'ssh') {
      isSSH = true;
      i++;
      continue;
    }

    if (isSSH && !foundConsole && (arg === 'console' || arg === 'sftp')) {
      foundConsole = true;
      i++;
      continue;
    }

    i++;
  }

  return { app, remoteArgs, isSSH: isSSH && foundConsole };
}

function evaluateFlyCommand(cmd: ParsedCommand, config: WardenConfig, targets: TrustedRemote[], depth: number = 0): CommandEvalDetail | null {
  const { command, args } = cmd;
  const { app, remoteArgs, isSSH } = parseFlySSHArgs(args);

  // Only handle ssh console - other fly commands fall through to regular rules
  if (!isSSH) return null;
  if (!app) return null;

  const matched = findMatchingTarget(app, targets);
  if (!matched) return null;

  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command, args,
    decision: result.decision,
    reason: `Trusted Fly app "${app}" (${result.reason})`,
    matchedRule: 'trustedRemotes:fly',
  };
}

// ─── Package runner recursive evaluation (npx/bunx/pnpx) ───

/** Commands that have custom evaluators and should be recursively evaluated when run via npx/bunx. */
const COMMANDS_WITH_SCRIPT_EVALUATORS = new Set(['node', 'tsx', 'ts-node', 'python', 'python3', 'perl']);

function evaluatePkgRunnerSubcommand(cmd: ParsedCommand, config: WardenConfig, depth: number, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;

  // Skip npx flags to find the subcommand
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--package' || args[i] === '-p' || args[i] === '--call' || args[i] === '-c') {
      i += 2;
      continue;
    }
    if (args[i].startsWith('-')) {
      i++;
      continue;
    }
    break;
  }
  if (i >= args.length) return null;

  const subcmd = args[i];
  if (!COMMANDS_WITH_SCRIPT_EVALUATORS.has(subcmd)) return null;

  // Build a subcommand and recursively evaluate through evaluateCommand
  const subArgs = args.slice(i + 1);
  const subParsedCmd: ParsedCommand = {
    command: subcmd,
    originalCommand: subcmd,
    args: subArgs,
    envPrefixes: [],
    raw: [subcmd, ...subArgs].join(' '),
  };
  const subResult = evaluateCommand(subParsedCmd, config, depth + 1, undefined, cwd);

  return {
    command, args,
    decision: subResult.decision,
    reason: `${command} ${subcmd}: ${subResult.reason}`,
    matchedRule: `${command}:subcommand`,
  };
}

// ─── Script safety scanning ───

/**
 * Check if user rules explicitly deny this command. Returns true only if a rule
 * sets `default: 'deny'`, meaning the script evaluator should NOT override with allow.
 * A rule with `default: 'ask'` (the built-in baseline) is fine - the script scanner
 * is providing additional info to upgrade ask → allow. Only explicit deny is a hard block.
 * Respects safety invariant: auto-allow never downgrades a user's explicit deny.
 */
function userRulesWouldRestrict(cmd: ParsedCommand, config: WardenConfig): boolean {
  const rule = collectMergedRule(cmd, config);
  return !!rule && rule.default === 'deny';
}

/** Map scanScriptCode result to a CommandEvalDetail, or null if user rules should take precedence. */
function mapScanResult(
  cmd: ParsedCommand,
  scanResult: ReturnType<typeof scanScriptCode>,
  matchedRule: string,
  config: WardenConfig,
): CommandEvalDetail | null {
  if (!scanResult) {
    // Safe script - but respect user rules if they restrict this command
    if (userRulesWouldRestrict(cmd, config)) return null;
    return { command: cmd.command, args: cmd.args, decision: 'allow', reason: 'script content is safe', matchedRule };
  }
  const reason = scanResult.level === 'dangerous'
    ? `dangerous: ${scanResult.reason}`
    : scanResult.reason;
  return { command: cmd.command, args: cmd.args, decision: 'ask', reason, matchedRule };
}

/** Try to read and scan a script file, returning a CommandEvalDetail or null if user rules take precedence. */
function scanScriptFile(
  cmd: ParsedCommand,
  filePath: string,
  language: 'python' | 'typescript' | 'perl',
  matchedRule: string,
  config: WardenConfig,
  cwd?: string,
): CommandEvalDetail | null {
  const fileResult = readScriptFile(filePath, cwd || process.cwd());
  if ('error' in fileResult) {
    return { command: cmd.command, args: cmd.args, decision: 'ask', reason: fileResult.error, matchedRule };
  }
  return mapScanResult(cmd, scanScriptCode(fileResult.content, language), matchedRule, config);
}

const SAFE_PYTHON_MODULES = new Set([
  'pytest', 'unittest', 'venv', 'pip', 'json.tool', 'compileall',
  'pydoc', 'doctest', 'timeit', 'py_compile', 'black', 'ruff',
  'mypy', 'isort', 'ensurepip', 'zipfile', 'site', 'cProfile',
  'pdb', 'dis', 'ast', 'tokenize', 'sysconfig',
]);

function evaluatePythonCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'python:script';

  // 1. --version / --help / -V
  if (args.some(a => a === '--version' || a === '--help' || a === '-V')) {
    return { command, args, decision: 'allow', reason: 'version/help flag', matchedRule: rule };
  }

  // 2. -c <code>
  const cIdx = args.indexOf('-c');
  if (cIdx !== -1) {
    const code = args[cIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after -c', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'python'), rule, config);
  }

  // 3. -m <module>
  const mIdx = args.indexOf('-m');
  if (mIdx !== -1) {
    const mod = args[mIdx + 1];
    if (!mod) {
      return { command, args, decision: 'ask', reason: 'missing module after -m', matchedRule: rule };
    }
    if (SAFE_PYTHON_MODULES.has(mod)) {
      if (userRulesWouldRestrict(cmd, config)) return null;
      return { command, args, decision: 'allow', reason: `safe module: ${mod}`, matchedRule: rule };
    }
    return { command, args, decision: 'ask', reason: `unknown module: ${mod}`, matchedRule: rule };
  }

  // 4. First arg ending in .py → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && a.endsWith('.py'));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'python', rule, config, cwd);
  }

  // 5. No args → interactive REPL
  if (args.length === 0) {
    return { command, args, decision: 'ask', reason: 'opens interactive REPL', matchedRule: rule };
  }

  // 6. Fall through to rules
  return null;
}

const NODE_SCRIPT_EXTENSIONS = /\.(js|mjs|cjs|ts|mts|cts|tsx|jsx)$/;

function evaluateNodeCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'node:script';

  // 1. --version / --help / -v / -h
  if (args.some(a => a === '--version' || a === '--help' || a === '-v' || a === '-h')) {
    return { command, args, decision: 'allow', reason: 'version/help flag', matchedRule: rule };
  }

  // 2. -e / --eval / -p / --print → inline code
  const evalIdx = args.findIndex(a => a === '-e' || a === '--eval' || a === '-p' || a === '--print');
  if (evalIdx !== -1) {
    const code = args[evalIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after eval flag', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'typescript'), rule, config);
  }

  // 3. First arg ending in script extension → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && NODE_SCRIPT_EXTENSIONS.test(a));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'typescript', rule, config, cwd);
  }

  // 4. No args → interactive REPL
  if (args.length === 0) {
    return { command, args, decision: 'ask', reason: 'opens interactive REPL', matchedRule: rule };
  }

  // 5. Fall through to rules
  return null;
}

function evaluatePerlCommand(cmd: ParsedCommand, config: WardenConfig, depth: number = 0, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'perl:script';

  // 1. --version / --help / -v
  if (args.some(a => a === '--version' || a === '--help' || a === '-v')) {
    return { command, args, decision: 'allow', reason: 'version/help flag', matchedRule: rule };
  }

  // 2. -e / -E → inline code
  const eIdx = args.findIndex(a => a === '-e' || a === '-E');
  if (eIdx !== -1) {
    const code = args[eIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after -e', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'perl'), rule, config);
  }

  // 3. First arg ending in .pl / .pm → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && (a.endsWith('.pl') || a.endsWith('.pm')));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'perl', rule, config, cwd);
  }

  // 4. No args → ask
  if (args.length === 0) {
    return { command, args, decision: 'ask', reason: 'opens interactive REPL', matchedRule: rule };
  }

  // 5. Fall through to rules
  return null;
}
