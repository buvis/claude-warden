import type { ParsedCommand, ParseResult, WardenConfig, CommandEvalDetail } from './types';
import { parseCommand } from './parser';
import { evaluate, evaluateCommand } from './evaluator';
import { makeCommand, skipLeadingFlags } from './args';

/** Wrap a single ParsedCommand as a standalone ParseResult for recursive evaluation. */
function asParseResult(cmd: ParsedCommand): ParseResult {
  return {
    commands: [cmd],
    hasSubshell: false,
    subshellCommands: [],
    parseError: false,
    chainAssignments: new Map(),
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
  // args[0] is 'run'
  const rest = args.slice(1);
  const { index, unresolved } = skipLeadingFlags(rest, {
    withValue: UV_RUN_FLAGS_WITH_VALUE,
    noValue: UV_RUN_FLAGS_NO_VALUE,
    strictUnknown: true,
  });

  if (unresolved) return { subcommand: null, unresolved: true };
  if (index >= rest.length) return { subcommand: null, unresolved: false };

  const subcmd = rest[index];
  const subArgs = rest.slice(index + 1);
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

  const result = evaluate(asParseResult(subcommand), config, depth + 1);

  return {
    command, args,
    decision: result.decision,
    reason: `uv run: ${result.reason}`,
    matchedRule: 'uv:run',
  };
}

// ─── xargs recursive evaluation ───

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
    return { unresolved: false, subcommand: makeCommand('echo', []) };
  }

  return {
    unresolved: false,
    subcommand: makeCommand(args[i], args.slice(i + 1)),
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
    parsed = innerResult.parseError ? asParseResult(subcommand) : innerResult;
  } else {
    parsed = asParseResult(subcommand);
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
        commands.push(makeCommand(cmdArgs[0], cmdArgs.slice(1)));
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
    const result = evaluate(asParseResult(execCmd), config, depth + 1);
    if (result.decision === 'deny') {
      return { command, args, decision: 'deny', reason: `find -exec: ${result.reason}`, matchedRule: 'find:exec' };
    }
    if (result.decision === 'ask') {
      return { command, args, decision: 'ask', reason: `find -exec: ${result.reason}`, matchedRule: 'find:exec' };
    }
  }

  return { command, args, decision: 'allow', reason: 'find -exec commands are safe', matchedRule: 'find:exec' };
}

// ─── Package runner recursive evaluation (npx/bunx/pnpx) ───

/** Commands that have custom evaluators and should be recursively evaluated when run via npx/bunx. */
const COMMANDS_WITH_SCRIPT_EVALUATORS = new Set(['node', 'tsx', 'ts-node', 'python', 'python3', 'perl']);

/** npx/bunx/pnpx flags that consume the next argument. */
const PKG_RUNNER_FLAGS_WITH_VALUE = new Set(['--package', '-p', '--call', '-c']);

function evaluatePkgRunnerSubcommand(cmd: ParsedCommand, config: WardenConfig, depth: number, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;

  const { index } = skipLeadingFlags(args, { withValue: PKG_RUNNER_FLAGS_WITH_VALUE });
  if (index >= args.length) return null;

  const subcmd = args[index];
  if (!COMMANDS_WITH_SCRIPT_EVALUATORS.has(subcmd)) return null;

  // Build a subcommand and recursively evaluate through evaluateCommand
  const subArgs = args.slice(index + 1);
  const subResult = evaluateCommand(makeCommand(subcmd, subArgs), config, depth + 1, undefined, cwd);

  return {
    command, args,
    decision: subResult.decision,
    reason: `${command} ${subcmd}: ${subResult.reason}`,
    matchedRule: `${command}:subcommand`,
  };
}

// ─── Dispatch ───

/**
 * Route a command to its subcommand-runner evaluator (uv run, xargs, find, npx/bunx/pnpx).
 * Returns null when the command is not a runner or the runner defers to normal rules.
 */
export function trySubcommandRunner(cmd: ParsedCommand, config: WardenConfig, depth: number, cwd?: string): CommandEvalDetail | null {
  switch (cmd.command) {
    case 'uv': return evaluateUvCommand(cmd, config, depth);
    case 'xargs': return evaluateXargsCommand(cmd, config, depth);
    case 'find': return evaluateFindCommand(cmd, config, depth);
    case 'npx':
    case 'bunx':
    case 'pnpx': return evaluatePkgRunnerSubcommand(cmd, config, depth, cwd);
  }
  return null;
}
