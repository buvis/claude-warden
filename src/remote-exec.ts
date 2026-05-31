import type {
  ParsedCommand, ParseResult, WardenConfig, EvalResult, CommandEvalDetail,
  TrustedTarget, TrustedRemote,
} from './types';
import { parseCommand } from './parser';
import { globToRegex } from './glob';
import { evaluate } from './evaluator';
import { makeCommand } from './args';

function findMatchingTarget(value: string, targets: TrustedTarget[]): TrustedTarget | null {
  return targets.find(t => globToRegex(t.name).test(value)) || null;
}

/** Re-quote an arg if it contains spaces or shell metacharacters. */
function shellQuote(arg: string): string {
  if (/[\s"'\\$`!#&|;()<>]/.test(arg)) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}

/** Shell interpreters that are safe as interactive sessions on trusted remotes. */
const INTERACTIVE_SHELLS = new Set(['bash', 'sh', 'zsh']);

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
    commands: [makeCommand(remoteCmd, remoteArgs.slice(1))],
    hasSubshell: false,
    subshellCommands: [],
    parseError: false,
    chainAssignments: new Map(),
  };
  return evaluate(parsed, overriddenConfig, depth + 1);
}

// ─── SSH / scp / rsync ───

/** SSH flags that consume the next argument (skip it when extracting host). */
const SSH_FLAGS_WITH_VALUE = new Set([
  '-b', '-c', '-D', '-E', '-e', '-F', '-I', '-i', '-J', '-L',
  '-l', '-m', '-O', '-o', '-p', '-Q', '-R', '-S', '-W', '-w',
]);

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
            const inner = parsed.commands[0];
            remoteArgs.push(inner.command, ...inner.args);
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

// ─── Dispatch ───

/**
 * Route a command to its trusted-remote evaluator (ssh/scp/rsync, docker, kubectl,
 * sprite, fly). Returns null when the command is not a remote-exec command or no
 * trusted target of the matching context is configured.
 */
export function tryRemoteExec(cmd: ParsedCommand, config: WardenConfig, depth: number): CommandEvalDetail | null {
  const remotes = config.trustedRemotes || [];
  const { command } = cmd;

  if (command === 'ssh' || command === 'scp' || command === 'rsync') {
    const targets = remotes.filter(t => t.context === 'ssh');
    return targets.length ? evaluateSSHCommand(cmd, config, targets, depth) : null;
  }
  if (command === 'docker') {
    const targets = remotes.filter(t => t.context === 'docker');
    return targets.length ? evaluateDockerExec(cmd, config, targets, depth) : null;
  }
  if (command === 'kubectl') {
    const targets = remotes.filter(t => t.context === 'kubectl');
    return targets.length ? evaluateKubectlExec(cmd, config, targets, depth) : null;
  }
  if (command === 'sprite') {
    const targets = remotes.filter(t => t.context === 'sprite');
    return targets.length ? evaluateSpriteExec(cmd, config, targets, depth) : null;
  }
  if (command === 'fly' || command === 'flyctl') {
    const targets = remotes.filter(t => t.context === 'fly');
    return targets.length ? evaluateFlyCommand(cmd, config, targets, depth) : null;
  }
  return null;
}
