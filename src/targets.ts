import { resolve, normalize } from 'path';
import { homedir } from 'os';
import type { ParsedCommand, WardenConfig, CommandEvalDetail, TargetPolicy, PathPolicy, DatabasePolicy, EndpointPolicy } from './types';
import { globToRegex, pathGlobToRegex } from './glob';

const PATH_COMMANDS = ['rm', 'chmod', 'chown', 'cp', 'mv', 'tee', 'mkdir', 'rmdir', 'touch', 'ln'];
const DATABASE_COMMANDS = ['psql', 'mysql', 'mariadb', 'redis-cli', 'mongosh', 'mongo'];
const ENDPOINT_COMMANDS = ['curl', 'wget', 'http', 'httpie'];

interface ParsedConnectionInfo {
  host?: string;
  port?: number;
  database?: string;
}

function expandHome(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return homedir() + p.slice(1);
  return p;
}

function expandCwd(p: string, cwd: string): string {
  return p.replace(/\{\{cwd\}\}/g, cwd);
}

function defaultCommandsForType(type: TargetPolicy['type']): string[] {
  switch (type) {
    case 'path': return PATH_COMMANDS;
    case 'database': return DATABASE_COMMANDS;
    case 'endpoint': return ENDPOINT_COMMANDS;
  }
}

function policyAppliesToCommand(policy: TargetPolicy, command: string): boolean {
  if (policy.allowAll) return true;
  const commands = policy.commands ?? defaultCommandsForType(policy.type);
  return commands.includes(command);
}

function hasGlobChars(s: string): boolean {
  return /[*?[\]{]/.test(s);
}

function evaluatePathPolicy(policy: PathPolicy, cmd: ParsedCommand, cwd: string): boolean {
  const recursive = policy.recursive ?? true;
  const expandedPath = expandHome(expandCwd(policy.path, cwd));
  const policyPath = normalize(resolve(cwd, expandedPath));
  const useGlob = hasGlobChars(expandedPath);

  const globRegex = useGlob
    ? new RegExp(`^${pathGlobToRegex(policyPath)}${recursive ? '(/.*)?' : ''}$`)
    : null;

  for (const arg of cmd.args) {
    if (arg.startsWith('-')) continue;
    const argPath = normalize(resolve(cwd, expandHome(arg)));
    if (globRegex) {
      if (globRegex.test(argPath)) return true;
    } else {
      if (recursive) {
        if (argPath === policyPath || argPath.startsWith(policyPath + '/')) return true;
      } else {
        if (argPath === policyPath) return true;
      }
    }
  }
  return false;
}

function parseConnectionFlags(args: string[]): ParsedConnectionInfo {
  const info: ParsedConnectionInfo = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Long flags with =
    if (arg.startsWith('--host=')) { info.host = arg.slice(7); continue; }
    if (arg.startsWith('--port=')) { info.port = Number(arg.slice(7)); continue; }
    if (arg.startsWith('--dbname=')) { info.database = arg.slice(9); continue; }
    // Long flags with space
    if (arg === '--host' && i + 1 < args.length) { info.host = args[++i]; continue; }
    if (arg === '--port' && i + 1 < args.length) { info.port = Number(args[++i]); continue; }
    if (arg === '--dbname' && i + 1 < args.length) { info.database = args[++i]; continue; }
    // Short flags
    if (arg === '-h' && i + 1 < args.length) { info.host = args[++i]; continue; }
    if (arg === '-d' && i + 1 < args.length) { info.database = args[++i]; continue; }
    if (arg === '-p' && i + 1 < args.length) { info.port = Number(args[++i]); continue; }
  }
  return info;
}

function parseConnectionUri(args: string[]): ParsedConnectionInfo {
  const uriPattern = /^(postgresql|postgres|mongodb|redis|mysql|mariadb):\/\//;
  for (const arg of args) {
    if (!uriPattern.test(arg)) continue;
    try {
      const url = new URL(arg);
      const info: ParsedConnectionInfo = {};
      if (url.hostname) info.host = url.hostname;
      if (url.port) info.port = Number(url.port);
      const dbPath = url.pathname.replace(/^\//, '');
      if (dbPath) info.database = dbPath;
      return info;
    } catch {
      continue;
    }
  }
  return {};
}

function evaluateDatabasePolicy(policy: DatabasePolicy, cmd: ParsedCommand): boolean {
  const flagInfo = parseConnectionFlags(cmd.args);
  const uriInfo = parseConnectionUri(cmd.args);
  const host = flagInfo.host ?? uriInfo.host;
  const port = flagInfo.port ?? uriInfo.port;
  const database = flagInfo.database ?? uriInfo.database;

  if (!host && !port && !database) return false;

  if (host) {
    const hostRegex = globToRegex(policy.host);
    if (!hostRegex.test(host)) return false;
  }

  if (policy.port !== undefined) {
    if (port === undefined || port !== policy.port) return false;
  }

  if (policy.database !== undefined) {
    if (database === undefined) return false;
    const dbRegex = globToRegex(policy.database);
    if (!dbRegex.test(database)) return false;
  }

  return true;
}

function extractUrls(cmd: ParsedCommand): string[] {
  const urls: string[] = [];
  const args = cmd.args;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && i + 1 < args.length) {
      urls.push(args[++i]);
      continue;
    }
    if (arg.startsWith('http://') || arg.startsWith('https://')) {
      urls.push(arg);
    }
  }
  return urls;
}

function evaluateEndpointPolicy(policy: EndpointPolicy, cmd: ParsedCommand): boolean {
  const urls = extractUrls(cmd);
  const patternRegex = globToRegex(policy.pattern);
  return urls.some(url => patternRegex.test(url));
}

function policyMatches(policy: TargetPolicy, cmd: ParsedCommand, cwd: string): boolean {
  switch (policy.type) {
    case 'path': return evaluatePathPolicy(policy, cmd, cwd);
    case 'database': return evaluateDatabasePolicy(policy, cmd);
    case 'endpoint': return evaluateEndpointPolicy(policy, cmd);
  }
}

export function evaluateTargetPolicies(
  cmd: ParsedCommand,
  cwd: string,
  config: WardenConfig,
): CommandEvalDetail | null {
  const matching: TargetPolicy[] = [];

  for (const policy of config.targetPolicies) {
    if (!policyAppliesToCommand(policy, cmd.command)) continue;
    if (policyMatches(policy, cmd, cwd)) {
      matching.push(policy);
    }
  }

  if (matching.length === 0) return null;

  // Most restrictive wins: deny > ask > allow
  let winningPolicy = matching[0];
  for (const policy of matching) {
    if (policy.decision === 'deny') {
      winningPolicy = policy;
      break;
    }
    if (policy.decision === 'ask' && winningPolicy.decision === 'allow') {
      winningPolicy = policy;
    }
  }

  return {
    command: cmd.command,
    args: cmd.args,
    decision: winningPolicy.decision,
    reason: winningPolicy.reason ?? `target policy (${winningPolicy.type})`,
    matchedRule: `targetPolicy:${winningPolicy.type}`,
    resolvedFrom: cmd.resolvedFrom,
  };
}
