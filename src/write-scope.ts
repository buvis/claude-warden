import { lstatSync, readlinkSync, statSync } from 'fs';
import { homedir } from 'os';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import type { ChainAssignment, ParsedCommand } from './types';

/**
 * Autopilot write-scope fence, Bash half.
 *
 * `~/.claude/hooks/enforce_write_scope.py` gates Edit/Write/MultiEdit/
 * NotebookEdit during an unattended autopilot batch; every write that travels
 * through Bash (redirects, tee, cp, mv, sed -i, ...) walked past it, which is
 * how a 2026-08-25 batch edited a different repo. This module is the same
 * fence for Bash: same arming contract, same root set, same deny wording.
 * A parity test beside the Python hook fails when the two drift.
 *
 * Arming (three states, mirrored from the hook):
 *   CLAUDE_UNATTENDED unset or != "1"          -> inert, silent
 *   CLAUDE_UNATTENDED=1, _AUTOPILOT_WRITE_SCOPE=off -> inert, says so on stderr
 *   CLAUDE_UNATTENDED=1                        -> enforce
 *
 * Roots (realpath'd, in this order, $HOME and its ancestors dropped):
 *   1. the session repo: nearest ancestor of cwd holding dev/local/autopilot,
 *      searched below $HOME only; cwd itself when none
 *   2. <repo>/dev/local
 *   3. $TMPDIR when set
 *   4. /tmp
 *   5. each ':'-joined entry of _AUTOPILOT_WRITE_SCOPE_EXTRA (~ expanded)
 *
 * The fence is fail-closed on anything it cannot resolve to a concrete path: a
 * write target still holding a shell expression, an unsupported `~user`, or a
 * relative target after a `cd` whose destination it could not follow. Coverage
 * of write commands is a named list; see docs/guide/write-scope.md for the
 * vectors deliberately left out (interpreter scripts, git, staged scripts,
 * runtime-substituted find/xargs operands, glob-through-symlink).
 */

export const MARKER = 'CLAUDE_UNATTENDED';
export const KILL_SWITCH = '_AUTOPILOT_WRITE_SCOPE';
export const EXTRA_ROOTS_VAR = '_AUTOPILOT_WRITE_SCOPE_EXTRA';
const TMP_ROOTS = ['/tmp'];
const REPO_MARKER = ['dev', 'local', 'autopilot'];

/** Commands whose every positional argument is a path they create/change/remove. */
const EVERY_ARG_WRITES = new Set(['tee', 'mkdir', 'touch', 'rm', 'rmdir', 'mv', 'ln']);
/** Commands that write only to their destination (last positional, or `-t DIR`). */
const DEST_ARG_WRITES = new Set(['cp', 'install']);
/** Per-command flags that consume the following argument as a NON-path value. */
const VALUE_FLAGS: Record<string, Set<string>> = {
  touch: new Set(['-r', '--reference', '-d', '--date', '-t']),
  cp: new Set(['-t', '--target-directory', '--sparse', '--reflink']),
  mv: new Set(['-t', '--target-directory', '-S', '--suffix']),
  ln: new Set(['-S', '--suffix', '-t', '--target-directory']),
  install: new Set([
    '-g', '--group', '-m', '--mode', '-o', '--owner', '-t', '--target-directory',
    '--strip-program', '-Z', '--context', '--backup', '-S', '--suffix',
  ]),
};
/**
 * Transparent wrappers: run their trailing argument as a command. Peeled off
 * before write classification so `timeout 5 cp a /out` is judged as `cp`.
 * Each value lists the wrapper flags that consume the next arg as a value.
 */
const WRAPPERS: Record<string, Set<string>> = {
  env: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']),
  command: new Set([]),
  nohup: new Set([]),
  nice: new Set(['-n', '--adjustment']),
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  ionice: new Set(['-c', '--class', '-n', '--classdata', '-p', '--pid']),
  stdbuf: new Set(['-i', '--input', '-o', '--output', '-e', '--error']),
  setsid: new Set([]),
  time: new Set(['-o', '--output', '-f', '--format']),
};

export type WriteScopeState =
  | { armed: false; disarmed: boolean }
  | { armed: true; roots: string[] };

export function writeScopeState(cwd: string, env: NodeJS.ProcessEnv = process.env): WriteScopeState {
  if (env[MARKER] !== '1') return { armed: false, disarmed: false };
  if (env[KILL_SWITCH] === 'off') return { armed: false, disarmed: true };
  return { armed: true, roots: allowedRoots(cwd, env) };
}

export const DISARM_LINE = `[warden] write-scope fence disarmed by ${KILL_SWITCH}=off`;

/** Component-wise containment: `path` is `root` or lives below it. */
function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(root.endsWith('/') ? root : root + '/');
}

/** $HOME first, like Python's Path.home(); os.homedir() ignores a HOME set on process.env in a worker. */
function homeOf(env: NodeJS.ProcessEnv): string {
  return env.HOME || homedir();
}

// Not targets.ts's expandHome: this leaves `~user` UNCHANGED so the fence can
// reject it (bash would expand it out of scope, and warden cannot look it up),
// and reads $HOME from the passed env rather than os.homedir().
function expandHome(p: string, env: NodeJS.ProcessEnv): string {
  if (p === '~') return homeOf(env);
  if (p.startsWith('~/')) return homeOf(env) + p.slice(1);
  return p;
}

/**
 * os.path.realpath, in TypeScript: resolve every symlink component, following
 * even a dangling leaf symlink, and tolerate missing tail components (they are
 * appended literally). Node's fs.realpathSync throws on a missing or dangling
 * path, which would hand a symlinked escape back as an in-scope literal.
 */
export function realpathLenient(p: string, seen: Set<string> = new Set()): string {
  const abs = resolve(p);
  const parent = dirname(abs);
  const base = basename(abs);
  const realParent = parent === abs ? abs : realpathLenient(parent, seen);
  const full = join(realParent, base);
  let link: string;
  try {
    if (!lstatSync(full).isSymbolicLink()) return full;
    link = readlinkSync(full);
  } catch {
    return full; // missing component: append literally, like os.path.realpath
  }
  if (seen.has(full)) return full; // symlink loop: stop, mirror realpath's give-up
  seen.add(full);
  const target = isAbsolute(link) ? link : join(realParent, link);
  return realpathLenient(target, seen);
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Nearest ancestor of `cwd` (below $HOME) holding dev/local/autopilot; `cwd` if none. */
function repoRoot(cwd: string, env: NodeJS.ProcessEnv): string {
  const home = homeOf(env);
  let dir = cwd;
  for (;;) {
    if (isInside(home, dir)) break; // the walk stops at $HOME exclusive
    if (isDir(join(dir, ...REPO_MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

/** Realpath'd roots an autopilot session may write under; see the module doc. */
export function allowedRoots(cwd: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const repo = repoRoot(resolve(cwd), env);
  const candidates = [repo, join(repo, 'dev', 'local')];
  if (env.TMPDIR) candidates.push(env.TMPDIR);
  candidates.push(...TMP_ROOTS);
  for (const extra of (env[EXTRA_ROOTS_VAR] ?? '').split(':')) {
    if (extra) candidates.push(expandHome(extra, env));
  }
  const home = realpathLenient(homeOf(env));
  const roots: string[] = [];
  for (const candidate of candidates) {
    const root = realpathLenient(resolve(candidate));
    // Root floor: $HOME itself and everything above it grant no scope.
    if (isInside(home, root) || roots.includes(root)) continue;
    roots.push(root);
  }
  return roots;
}

/** Positional args, honouring `--` (everything after it is positional). */
function positionals(args: string[]): string[] {
  const out: string[] = [];
  let literal = false;
  for (const a of args) {
    if (literal) {
      out.push(a);
      continue;
    }
    if (a === '--') {
      literal = true;
      continue;
    }
    if (a === '' || !a.startsWith('-')) out.push(a);
  }
  return out;
}

/** Positional args with the value-consuming flags of `command` removed. */
function operands(command: string, args: string[]): string[] {
  const valueFlags = VALUE_FLAGS[command];
  if (!valueFlags) return positionals(args);
  const kept: string[] = [];
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (literal) {
      kept.push(a);
      continue;
    }
    if (a === '--') { literal = true; continue; }
    if (valueFlags.has(a)) { i++; continue; } // flag + its value both skipped
    if (a === '' || !a.startsWith('-')) kept.push(a);
  }
  return kept;
}

/** Destination of cp/install: `-t DIR`, or the last positional; `install -d` -> every positional. */
function destination(command: string, args: string[]): string[] {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-t' || args[i] === '--target-directory') {
      return i + 1 < args.length ? [args[i + 1]] : positionals(args);
    }
    if (args[i].startsWith('--target-directory=')) return [args[i].slice('--target-directory='.length)];
  }
  const pos = operands(command, args);
  if (command === 'install' && args.includes('-d')) return pos;
  if (pos.length === 0) return [];
  return [pos[pos.length - 1]];
}

/**
 * Files `sed -i` rewrites. Tuned for BSD sed (macOS, the batch environment):
 * a bare `-i` consumes the next arg as the backup suffix. Attached (`-i.bak`,
 * `-eSCRIPT`, `-fFILE`) and long (`--in-place`, `--expression=`) forms take no
 * separate value. The first bare positional is the script; the rest are files.
 * KNOWN LIMIT: GNU `sed -i 's/../../' f` (bare -i, inline script, no suffix)
 * mis-parses the suffix; harmless (a sed script resolves relative, in-scope).
 */
function sedFiles(args: string[]): string[] {
  const files: string[] = [];
  let scriptSeen = false;
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (literal) { files.push(a); continue; }
    if (a === '--') { literal = true; continue; }
    if (a === '-e' || a === '-f' || a === '--expression' || a === '--file') {
      i++; // the script / script file is read, not written
      scriptSeen = true;
      continue;
    }
    if (
      a.startsWith('-e') || a.startsWith('-f') ||
      a.startsWith('--expression=') || a.startsWith('--file=')
    ) { scriptSeen = true; continue; } // attached script/scriptfile
    if (a === '-i') { i++; continue; } // BSD bare -i: next arg is the backup suffix
    if (a.startsWith('-')) continue; // -i.bak, --in-place, other flags: no separate value
    if (!scriptSeen) { scriptSeen = true; continue; } // inline script
    files.push(a);
  }
  return files;
}

/** Peel transparent wrappers (`env`, `command`, `timeout`, `nice`, ...) to the real command. */
function peelWrappers(command: string, args: string[]): { command: string; args: string[] } {
  let cmd = command;
  let rest = args;
  const guard = new Set<string>();
  while (WRAPPERS[cmd] && rest.length > 0 && !guard.has(cmd)) {
    guard.add(cmd);
    const valueFlags = WRAPPERS[cmd];
    let i = 0;
    while (i < rest.length) {
      const a = rest[i];
      if (a === '--') { i++; break; }
      if (cmd === 'env' && /^\w+=/.test(a)) { i++; continue; } // env VAR=val
      if (cmd === 'timeout' && /^\d/.test(a)) { i++; break; } // the DURATION operand
      if (valueFlags.has(a)) { i += 2; continue; }
      if (a.startsWith('-')) { i++; continue; }
      break;
    }
    if (i >= rest.length) return { command: cmd, args: rest }; // nothing left to unwrap
    const inner = rest[i];
    cmd = inner.includes('/') ? inner.split('/').pop()! : inner;
    rest = rest.slice(i + 1);
  }
  return { command: cmd, args: rest };
}

/**
 * Paths a parsed command writes: redirect targets plus the operands of the
 * covered write commands (wrappers peeled first). See the module doc for the
 * named gaps.
 */
export function writeTargets(cmd: ParsedCommand): string[] {
  const targets = [...(cmd.writeRedirects ?? [])];
  const { command, args } = peelWrappers(cmd.command, cmd.args);
  if (EVERY_ARG_WRITES.has(command)) {
    // mv removes its sources; ln can point a new in-scope link at an out-of-scope
    // target; tee/mkdir/touch/rm/rmdir write every operand. All positionals.
    targets.push(...operands(command, args));
  } else if (DEST_ARG_WRITES.has(command)) {
    targets.push(...destination(command, args));
  } else if (command === 'sed' && args.some(a => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) {
    targets.push(...sedFiles(args));
  } else if (command === 'dd') {
    targets.push(...args.filter(a => a.startsWith('of=')).map(a => a.slice(3)));
  }
  return targets;
}

/**
 * Expand `$VAR`/`${VAR}` from in-command assignments first (a chain-local
 * `TMPDIR=/x` shadows the environment), then the environment. Returns null when
 * any variable is unset or dynamic, or the word still holds a shell expression
 * (`${VAR:-x}`, `$(...)`, backticks): fail closed rather than guess.
 */
function expandVars(
  word: string,
  env: NodeJS.ProcessEnv,
  assignments: Map<string, ChainAssignment>,
): string | null {
  let unresolved = false;
  const lookup = (name: string): string | undefined => {
    const assigned = assignments.get(name);
    if (assigned) return assigned.isDynamic || assigned.value === null ? undefined : assigned.value;
    return env[name];
  };
  const expanded = word.replace(/\$(\w+)|\$\{(\w+)\}/g, (_m, a: string, b: string) => {
    const value = lookup(a ?? b);
    if (value === undefined) unresolved = true;
    return value ?? '';
  });
  // Any remaining $ or backtick is an expression we did not expand (operators,
  // command substitution, positional/special params): unresolvable.
  return unresolved || /[$`]/.test(expanded) ? null : expanded;
}

function quoted(paths: string[]): string {
  return paths.map(p => `'${p}'`).join(', ');
}

/** The hook's block reason, byte for byte, so the parity test can compare roots. */
export function breachReason(resolved: string, roots: string[]): string {
  return (
    `BLOCKED: autopilot write-scope fence: '${resolved}' is outside the ` +
    `allowed scope (${quoted(roots)}). ` +
    "Write inside the session's repo, its dev/local, or a temp dir; " +
    `add a root via ${EXTRA_ROOTS_VAR}, or set ${KILL_SWITCH}=off to disarm.`
  );
}

function unresolvableReason(target: string, command: string, roots: string[]): string {
  return (
    `BLOCKED: autopilot write-scope fence: cannot resolve the write target '${target}' of ` +
    `\`${command}\` (shell expression, unset variable, ~user, or a directory change the ` +
    `fence could not follow); use a literal path inside the allowed scope (${quoted(roots)}), ` +
    `or set ${KILL_SWITCH}=off to disarm.`
  );
}

/** Resolve a write/cd target to an absolute realpath, or null when unresolvable. */
function resolveTarget(
  target: string,
  base: string | null,
  env: NodeJS.ProcessEnv,
  assignments: Map<string, ChainAssignment>,
): string | null {
  const expanded = expandVars(target, env, assignments);
  if (expanded === null) return null;
  const homed = expandHome(expanded, env);
  if (homed.startsWith('~')) return null; // ~user: bash expands it, warden cannot
  if (isAbsolute(homed)) return realpathLenient(homed);
  if (base === null) return null; // relative target after an unfollowable cd
  return realpathLenient(join(base, homed));
}

const NO_SCOPE_REASON =
  'enforce_write_scope: no usable write scope (every candidate root was $HOME or above); refusing all writes';

/**
 * First out-of-scope write among `commands`, as a deny reason; null when every
 * write target resolves inside `roots`. The fence tracks `cd`/`pushd` itself
 * (the parser only carries cwd across `&&`/`||`, and never expands `~`), so a
 * `;`-, newline-, or `~`-based directory change cannot re-anchor a relative
 * write at the session cwd. An unfollowable cd (`cd -`, `popd`, an unresolved
 * variable) makes the base unknown, and every later relative write fails closed.
 */
export function writeScopeBreach(
  commands: ParsedCommand[],
  roots: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  assignments: Map<string, ChainAssignment> = new Map(),
): string | null {
  let base: string | null = realpathLenient(cwd);
  for (const cmd of commands) {
    if (cmd.command === 'cd' || cmd.command === 'pushd') {
      // First operand that is a directory: `-` (previous dir) or a non-flag.
      // positionals() would drop the literal `-`, so scan the raw args.
      const arg = cmd.args.find(a => a === '-' || (a !== '' && !a.startsWith('-')));
      if (cmd.command === 'cd' && arg === undefined) {
        base = realpathLenient(homeOf(env)); // bare `cd` -> $HOME (out of scope; caught on write)
      } else if (arg === undefined || arg === '-') {
        base = null; // `cd -`/`pushd` with no dir: cannot follow the destination
      } else {
        base = resolveTarget(arg, base, env, assignments);
      }
      continue;
    }
    if (cmd.command === 'popd') { base = null; continue; }
    for (const target of writeTargets(cmd)) {
      if (roots.length === 0) return NO_SCOPE_REASON;
      const resolved = resolveTarget(target, base, env, assignments);
      if (resolved === null) return unresolvableReason(target, cmd.command, roots);
      if (resolved.startsWith('/dev/')) continue; // /dev/null, /dev/stderr: not files
      if (!roots.some(root => isInside(resolved, root))) return breachReason(resolved, roots);
    }
  }
  return null;
}

/**
 * The hook's authoritative check: parse `command` and return a deny reason if
 * an armed batch would write out of scope, else null. Called from index.ts
 * BEFORE the YOLO and bypass-permission short-circuits so the scope bound
 * cannot be lifted for the session. Returns null when the fence is not armed.
 */
export function writeScopeDeny(
  command: string,
  cwd: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const sessionCwd = typeof cwd === 'string' && cwd ? cwd : process.cwd();
  const state = writeScopeState(sessionCwd, env);
  if (!state.armed) return null;
  // Imported lazily to avoid a parser<->write-scope import cycle at module load.
  const { parseCommand } = require('./parser') as typeof import('./parser');
  const parsed = parseCommand(command);
  if (parsed.parseError) return null; // an unparseable command is judged (ask) by the evaluator
  return writeScopeBreach(parsed.commands, state.roots, sessionCwd, env, parsed.chainAssignments);
}
