import { parse } from 'unbash';
import type {
  Node, Statement, Command as UnbashCommand, Pipeline, AndOr,
  While, If, For, Case,
  Function as UnbashFunction,
  Subshell, BraceGroup, CompoundList,
  Select, Coproc, ArithmeticFor,
  Word, WordPart, DoubleQuotedChild, CommandExpansionPart, Redirect,
  TestCommand, ArithmeticCommand, TestExpression,
} from 'unbash';
import { basename, resolve } from 'path';
import { homedir } from 'os';
import { SHELL_INTERPRETERS } from './shells';
import type { ParsedCommand, ParseResult, ChainAssignment } from './types';

export interface WalkResult {
  commands: ParsedCommand[];
  hasSubshell: boolean;
  subshellCommands: string[];
  chainAssignments: Map<string, ChainAssignment>;
  effectiveCwd?: string;
  incomplete?: boolean;
  incompleteNodeTypes?: string[];
}

/**
 * Node types that legitimately carry no executable command. walkNode's default
 * case treats every OTHER unhandled type as incomplete (fail loud), so adding a
 * new no-command construct here is the one place to suppress a false ask.
 */
const NO_COMMAND_NODE_TYPES = new Set<string>([]);

const VAR_REF_REGEX = /^\$\{?(\w+)\}?$/;

function resolveVarRef(
  text: string,
  chainAssignments: Map<string, ChainAssignment>,
): string | null {
  const m = text.match(VAR_REF_REGEX);
  if (!m) return null;
  const assignment = chainAssignments.get(m[1]);
  if (!assignment || assignment.isDynamic || assignment.value === null) return null;
  return assignment.value;
}

/**
 * Detect the $(cat <<MARKER...MARKER) string interpolation idiom.
 * A CommandExpansion containing only cat with a heredoc redirect
 * and actual multi-line body content is just text interpolation.
 */
function isCatHeredocInterpolation(part: CommandExpansionPart): boolean {
  if (!part.script) return false;
  const { commands } = part.script;
  if (commands.length !== 1) return false;
  const node = commands[0].command;
  if (node.type !== 'Command') return false;
  if (node.name?.value !== 'cat') return false;
  if (node.suffix.length > 0) return false;
  const heredoc = node.redirects.find(
    r => r.operator === '<<' || r.operator === '<<-',
  );
  if (!heredoc) return false;
  return heredoc.content != null && heredoc.content.includes('\n');
}

const WRITE_REDIRECT_OPERATORS = new Set<string>(['>', '>>', '>|', '&>', '&>>', '<>', '>&']);

// Extract redirect targets from a source slice unbash reduced to no command
// (a bare `> f`). Only reached for a statement that yielded zero commands, so
// the slice is the redirect list itself; an fd-duplication target (`>&1`, `>&-`)
// is not a file and is skipped.
const BARE_REDIRECT_RE = /(?:\d+|&)?(?:>>|>\||&>>|&>|<>|>&|>)\s*("[^"]*"|'[^']*'|[^\s;&|<>]+)/g;
function bareRedirectTargets(slice: string): string[] {
  const targets: string[] = [];
  for (const m of slice.matchAll(BARE_REDIRECT_RE)) {
    const raw = m[1].replace(/^["']|["']$/g, '');
    if (raw && !/^(\d+|-)$/.test(raw)) targets.push(raw);
  }
  return targets;
}

/** Files a redirect list writes to; fd duplications (`2>&1`, `>&-`) are not files. */
function writeRedirectTargets(redirects: Redirect[]): string[] {
  const targets: string[] = [];
  for (const r of redirects) {
    if (!WRITE_REDIRECT_OPERATORS.has(r.operator) || !r.target) continue;
    const value = r.target.value;
    if (r.operator === '>&' && /^(\d+|-)$/.test(value)) continue;
    targets.push(value);
  }
  return targets;
}

function extractHeredoc(
  cmd: UnbashCommand,
): { content: string; quotedDelimiter: boolean } | undefined {
  const heredocs = cmd.redirects.filter(
    r => r.operator === '<<' || r.operator === '<<-',
  );
  // v1: only a single heredoc with captured body is certifiable; 0 = none,
  // 2+ caps at ask, empty/missing content caps at ask.
  if (heredocs.length !== 1) return undefined;
  const h = heredocs[0];
  if (h.content == null || h.content.length === 0) return undefined;
  return { content: h.content, quotedDelimiter: h.heredocQuoted === true };
}

/**
 * Quote unquoted parentheses in path-like tokens so the parser doesn't
 * treat them as subshells. Targets patterns like foo/(bar)/baz where parens
 * are part of a file path (e.g. Next.js route groups).
 */
function preprocessPathParentheses(input: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) {
        if (input[j] === '\\' && quote === '"') j++;
        j++;
      }
      result.push(input.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (
      (ch === '$' || ch === '<' || ch === '>') &&
      i + 1 < input.length &&
      input[i + 1] === '('
    ) {
      let depth = 1;
      let j = i + 2;
      while (j < input.length && depth > 0) {
        if (input[j] === '(') depth++;
        else if (input[j] === ')') depth--;
        if (depth > 0) j++;
      }
      result.push(input.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch !== ' ' && ch !== '\t' && ch !== '\n') {
      let j = i;
      while (j < input.length && !' \t\n'.includes(input[j]) && input[j] !== '"' && input[j] !== "'" && !(input[j] === '$' && j + 1 < input.length && input[j + 1] === '(')) {
        j++;
      }
      const token = input.slice(i, j);
      if (token.includes('/') && /[()]/.test(token) && !/^[<>|;&]/.test(token)) {
        result.push('"' + token + '"');
      } else {
        result.push(token);
      }
      i = j;
      continue;
    }
    result.push(ch);
    i++;
  }
  return result.join('');
}

/** Extract the inner command string from a CommandExpansion text. */
function extractExpansionCommand(text: string): string {
  if (text.startsWith('$(') && text.endsWith(')')) return text.slice(2, -1);
  if (text.startsWith('`') && text.endsWith('`')) return text.slice(1, -1);
  return text;
}

/** Scan a single word part for command expansions and process substitutions. */
function scanWordPart(part: WordPart | DoubleQuotedChild, result: WalkResult): void {
  switch (part.type) {
    case 'CommandExpansion':
      if (isCatHeredocInterpolation(part)) break;
      result.hasSubshell = true;
      result.subshellCommands.push(extractExpansionCommand(part.text));
      break;
    case 'ProcessSubstitution':
      result.hasSubshell = true;
      result.subshellCommands.push(
        part.inner ?? part.text.replace(/^[<>]\(/, '').replace(/\)$/, ''),
      );
      break;
    case 'DoubleQuoted':
    case 'LocaleString':
      for (const child of part.parts) scanWordPart(child, result);
      break;
    case 'ParameterExpansion':
      if (part.operand) collectExpansionsFromWord(part.operand, result);
      if (part.slice?.offset) collectExpansionsFromWord(part.slice.offset, result);
      if (part.slice?.length) collectExpansionsFromWord(part.slice.length, result);
      if (part.replace?.pattern) collectExpansionsFromWord(part.replace.pattern, result);
      if (part.replace?.replacement) collectExpansionsFromWord(part.replace.replacement, result);
      break;
    case 'ArithmeticExpansion':
      // `$(( ... ))` arithmetic expansion is out of v1 scope. Bash evaluates the
      // arithmetic and does not run a bare token as a command, so `$(( a + b ))`
      // is benign: no-op, and do NOT flag incomplete (that would ask on every
      // benign `echo $(( 1 + 2 ))`).
      // KNOWN v1 LIMITATION: a command substitution nested inside arithmetic
      // (`$(( $(cmd) ))`) is NOT surfaced. unbash flattens it into the arithmetic
      // token text with no nested CommandExpansion part to scan, so its inner
      // command is currently dropped. Pre-existing gap, documented in the design
      // doc Risks; closing it needs arithmetic-body extraction (v2).
      break;
  }
}

/** Scan a Word for command expansions and process substitutions. */
function collectExpansionsFromWord(word: Word, result: WalkResult): void {
  if (!word.parts) return;
  for (const part of word.parts) scanWordPart(part, result);
}

function scanTestExpression(expr: TestExpression, result: WalkResult): void {
  switch (expr.type) {
    case 'TestUnary':   collectExpansionsFromWord(expr.operand, result); break;
    case 'TestBinary':  collectExpansionsFromWord(expr.left, result);
                        collectExpansionsFromWord(expr.right, result); break;
    case 'TestLogical': scanTestExpression(expr.left, result);
                        scanTestExpression(expr.right, result); break;
    case 'TestNot':     scanTestExpression(expr.operand, result); break;
    case 'TestGroup':   scanTestExpression(expr.expression, result); break;
  }
}

/** Extract chain assignments from a Command with no name (standalone VAR=value). */
function extractAssignments(
  cmd: UnbashCommand,
): Array<{ name: string; value: string | null; isDynamic: boolean }> {
  const assignments: Array<{ name: string; value: string | null; isDynamic: boolean }> = [];
  for (const p of cmd.prefix) {
    if (!p.name) continue;
    const isDynamic =
      p.value?.parts?.some(part => part.type === 'CommandExpansion') ?? false;
    const value = isDynamic ? null : (p.value?.value ?? '');
    assignments.push({ name: p.name, value, isDynamic });
  }
  return assignments;
}

function convertCommand(
  cmd: UnbashCommand,
  chainAssignments: Map<string, ChainAssignment>,
): ParsedCommand | null {
  if (!cmd.name) return null;

  let originalCommand = cmd.name.value;
  let resolvedFrom: string | undefined;

  const varMatch = originalCommand.match(VAR_REF_REGEX);
  if (varMatch) {
    const resolved = resolveVarRef(originalCommand, chainAssignments);
    if (resolved !== null) {
      resolvedFrom = originalCommand;
      originalCommand = resolved;
    } else if (chainAssignments.has(varMatch[1])) {
      resolvedFrom = originalCommand;
    }
  }

  const command = originalCommand.includes('/')
    ? basename(originalCommand)
    : originalCommand;

  const envPrefixes = cmd.prefix.map(p => p.text);
  const args = cmd.suffix.map(s => s.value);

  const rawParts = [...envPrefixes, cmd.name.value, ...args];
  const raw = rawParts.join(' ');

  const result: ParsedCommand = { command, originalCommand, args, envPrefixes, raw };
  if (originalCommand.includes('/')) result.originalPath = originalCommand;
  if (resolvedFrom) result.resolvedFrom = resolvedFrom;
  const heredoc = extractHeredoc(cmd);
  if (heredoc) result.heredoc = heredoc;
  const writes = writeRedirectTargets(cmd.redirects);
  if (writes.length > 0) result.writeRedirects = writes;
  return result;
}

function updateEffectiveCwd(cdCmd: ParsedCommand, result: WalkResult): void {
  const target = cdCmd.args[0];
  if (!target || target === '-') {
    result.effectiveCwd = undefined;
    return;
  }

  // Try resolving $VAR
  let resolved = target;
  const varMatch = target.match(VAR_REF_REGEX);
  if (varMatch) {
    const assignment = result.chainAssignments.get(varMatch[1]);
    if (assignment && !assignment.isDynamic && assignment.value !== null) {
      resolved = assignment.value;
    } else {
      result.effectiveCwd = undefined;
      return;
    }
  }

  if (resolved.startsWith('/')) {
    result.effectiveCwd = resolved;
  } else if (result.effectiveCwd) {
    result.effectiveCwd = resolve(result.effectiveCwd, resolved);
  } else {
    result.effectiveCwd = undefined;
  }
}

function walkCompoundList(list: CompoundList, result: WalkResult): void {
  for (const stmt of list.commands) {
    walkNode(stmt, result);
  }
}

function walkIfNode(ifNode: If, result: WalkResult): void {
  walkCompoundList(ifNode.clause, result);
  walkCompoundList(ifNode.then, result);
  if (ifNode.else) {
    if (ifNode.else.type === 'If') {
      walkIfNode(ifNode.else as If, result);
    } else {
      walkCompoundList(ifNode.else as CompoundList, result);
    }
  }
}

export function walkNode(node: Node, result: WalkResult): void {
  switch (node.type) {
    case 'Statement': {
      const stmt = node as Statement;
      for (const r of stmt.redirects) {
        if (r.target) collectExpansionsFromWord(r.target, result);
        if (r.body) collectExpansionsFromWord(r.body, result);
      }
      const before = result.commands.length;
      walkNode(stmt.command, result);
      // A statement redirect writes: `{ a; b; } > f` and `for ...; done > f`
      // stamp every inner command; a bare `> f` (no command) produced none, so
      // emit a synthetic command carrying the write so the fence still sees it.
      const writes = writeRedirectTargets(stmt.redirects);
      if (writes.length > 0) {
        if (result.commands.length === before) {
          result.commands.push({
            command: '', originalCommand: '', args: [], envPrefixes: [],
            raw: writes.join(' '), writeRedirects: writes,
          });
        } else {
          for (let i = before; i < result.commands.length; i++) {
            const cmd = result.commands[i];
            cmd.writeRedirects = [...(cmd.writeRedirects ?? []), ...writes];
          }
        }
      }
      break;
    }

    case 'Command': {
      const cmd = node as UnbashCommand;

      // Collect command expansions from name and suffix words
      if (cmd.name) collectExpansionsFromWord(cmd.name, result);
      for (const s of cmd.suffix) collectExpansionsFromWord(s, result);

      // Collect from redirect words (target/body)
      for (const r of cmd.redirects) {
        if (r.target) collectExpansionsFromWord(r.target, result);
        if (r.body) collectExpansionsFromWord(r.body, result);
      }

      // Collect from prefix-assignment values (in addition to chain tracking)
      for (const p of cmd.prefix) {
        if (p.value) collectExpansionsFromWord(p.value, result);
        if (p.array) for (const w of p.array) collectExpansionsFromWord(w, result);
      }

      const parsed = convertCommand(cmd, result.chainAssignments);
      if (!parsed) {
        // Standalone assignment (no command name)
        for (const a of extractAssignments(cmd)) {
          result.chainAssignments.set(a.name, {
            value: a.value,
            isDynamic: a.isDynamic,
          });
        }
        // A nameless command that still redirects (`> out`, `2>err`,
        // `VAR=x >out`) truncates/creates its target. Emit a synthetic command
        // carrying the write targets so the write-scope fence can judge them;
        // without this a bare redirect parsed to zero commands and evaluated as
        // "Empty command: allow".
        const bareWrites = writeRedirectTargets(cmd.redirects);
        if (bareWrites.length > 0) {
          result.commands.push({
            command: '', originalCommand: '', args: [], envPrefixes: [],
            raw: bareWrites.join(' '), writeRedirects: bareWrites,
          });
        }
        break;
      }

      // Handle POSIX shell (SHELL_INTERPRETERS) -c "..." recursion
      if (
        SHELL_INTERPRETERS.has(parsed.command) &&
        parsed.args.length >= 2 &&
        parsed.args[0] === '-c'
      ) {
        const innerResult = parseCommand(parsed.args[1]);
        if (innerResult.parseError) {
          result.commands.push(parsed);
        } else if (
          innerResult.commands.length === 0 &&
          parsed.envPrefixes.length > 0
        ) {
          // Empty/comment-only/assignment-only inner body yields no commands.
          // Keep the wrapper so its env prefix stays evaluable (the evaluator's
          // env-prefix post-pass names any dangerous variable it carries).
          result.commands.push(parsed);
        } else {
          if (parsed.envPrefixes.length > 0) {
            result.commands.push(
              ...innerResult.commands.map(cmd => ({
                ...cmd,
                envPrefixes: [...parsed.envPrefixes, ...cmd.envPrefixes],
              })),
            );
          } else {
            result.commands.push(...innerResult.commands);
          }
          if (innerResult.hasSubshell) result.hasSubshell = true;
          result.subshellCommands.push(...innerResult.subshellCommands);
          if (innerResult.incomplete) result.incomplete = true;
          if (innerResult.incompleteNodeTypes) {
            result.incompleteNodeTypes ??= [];
            for (const t of innerResult.incompleteNodeTypes) {
              if (!result.incompleteNodeTypes.includes(t)) {
                result.incompleteNodeTypes.push(t);
              }
            }
          }
        }
      } else if (
        SHELL_INTERPRETERS.has(parsed.command) &&
        parsed.args.length >= 1
      ) {
        // Handle POSIX shell (SHELL_INTERPRETERS) <script> - extract script as the command
        const scriptIdx = parsed.args.findIndex(a => !a.startsWith('-'));
        if (scriptIdx !== -1) {
          let scriptPath = parsed.args[scriptIdx];
          if (scriptPath.startsWith('~/')) {
            scriptPath = homedir() + scriptPath.slice(1);
          }
          const scriptCommand = scriptPath.includes('/')
            ? basename(scriptPath)
            : scriptPath;
          const scriptArgs = parsed.args.slice(scriptIdx + 1);
          const scriptCmd: ParsedCommand = {
            command: scriptCommand,
            originalCommand: scriptPath,
            args: scriptArgs,
            envPrefixes: parsed.envPrefixes,
            raw: parsed.raw,
          };
          if (scriptPath.includes('/')) scriptCmd.originalPath = scriptPath;
          if (parsed.writeRedirects) scriptCmd.writeRedirects = parsed.writeRedirects;
          result.commands.push(scriptCmd);
        } else {
          result.commands.push(parsed);
        }
      } else {
        result.commands.push(parsed);
      }
      break;
    }

    case 'Pipeline': {
      const pipeline = node as Pipeline;
      for (const cmd of pipeline.commands) walkNode(cmd, result);
      break;
    }

    case 'AndOr': {
      const andOr = node as AndOr;
      const savedCwd = result.effectiveCwd;
      result.effectiveCwd = undefined;
      for (const cmd of andOr.commands) {
        const before = result.commands.length;
        walkNode(cmd, result);
        // Stamp newly added commands with current effectiveCwd.
        // Skip commands that already have effectiveCwd from inner recursive
        // parsing (e.g. sh -c "cd /home && rm foo" should keep /home, not
        // get overwritten by the outer chain's cwd).
        for (let i = before; i < result.commands.length; i++) {
          if (result.effectiveCwd && !result.commands[i].effectiveCwd) {
            result.commands[i].effectiveCwd = result.effectiveCwd;
          }
        }
        // Check if any newly added command is cd - update effectiveCwd
        for (let i = before; i < result.commands.length; i++) {
          const pc = result.commands[i];
          if (pc.command === 'cd') {
            updateEffectiveCwd(pc, result);
          }
        }
      }
      result.effectiveCwd = savedCwd;
      break;
    }

    case 'While': {
      const loop = node as While;
      walkCompoundList(loop.clause, result);
      walkCompoundList(loop.body, result);
      break;
    }

    case 'If': {
      walkIfNode(node as If, result);
      break;
    }

    case 'For': {
      const f = node as For;
      for (const w of f.wordlist) collectExpansionsFromWord(w, result);
      walkCompoundList(f.body, result);
      break;
    }

    case 'Case': {
      const c = node as Case;
      collectExpansionsFromWord(c.word, result);
      for (const item of c.items) {
        for (const p of item.pattern) collectExpansionsFromWord(p, result);
        walkCompoundList(item.body, result);
      }
      break;
    }

    case 'Function': {
      walkNode((node as UnbashFunction).body, result);
      break;
    }

    case 'Subshell': {
      // Explicit `(...)` subshells: walk inner commands so they're evaluated
      // normally. We don't set hasSubshell here — its contents are fully
      // extracted and side-effects (cd, env) are scoped to the subshell,
      // making them safer than top-level execution, not less safe.
      walkCompoundList((node as Subshell).body, result);
      break;
    }

    case 'BraceGroup': {
      walkCompoundList((node as BraceGroup).body, result);
      break;
    }

    case 'CompoundList': {
      walkCompoundList(node as CompoundList, result);
      break;
    }

    case 'Select': {
      const s = node as Select;
      for (const w of s.wordlist) collectExpansionsFromWord(w, result);
      walkCompoundList(s.body, result);
      break;
    }

    case 'Coproc': {
      result.hasSubshell = true;
      walkNode((node as Coproc).body, result);
      break;
    }

    case 'ArithmeticFor': {
      walkCompoundList((node as ArithmeticFor).body, result);
      break;
    }

    case 'TestCommand': {
      const e = (node as TestCommand).expression;
      if (e) scanTestExpression(e, result);
      break;
    }

    case 'ArithmeticCommand': {
      const body = (node as ArithmeticCommand).body;
      if (/\$\((?!\()|`/.test(body)) {
        result.incomplete = true;
        result.incompleteNodeTypes ??= [];
        if (!result.incompleteNodeTypes.includes('ArithmeticCommand')) {
          result.incompleteNodeTypes.push('ArithmeticCommand');
        }
      }
      break;
    }

    default: {
      // Every Node union member now has an explicit case, so `node` narrows to
      // `never` here. This branch stays as a fail-loud guard for any future
      // node type unbash adds; read the discriminant through a widened alias.
      const nodeType = (node as Node).type;
      if (!NO_COMMAND_NODE_TYPES.has(nodeType)) {
        result.incomplete = true;
        result.incompleteNodeTypes ??= [];
        if (!result.incompleteNodeTypes.includes(nodeType)) {
          result.incompleteNodeTypes.push(nodeType);
        }
      }
      break;
    }
  }
}

/**
 * Cap at ask when the input has 2+ heredoc openers: unbash captures only the
 * first heredoc body and drops the rest, so we can't see (let alone certify)
 * what actually executes. Strip the captured bodies before counting so a `<<`
 * INSIDE a body (a bit-shift, Ruby's append operator) is never miscounted as a
 * second heredoc. `replaceAll` strips every occurrence — a body that recurs
 * earlier in the input only removes more spurious `<<`, which stays fail-safe.
 */
function dropHeredocsIfMultiple(input: string, commands: ParsedCommand[]): void {
  let skeleton = input;
  for (const cmd of commands) {
    if (cmd.heredoc) skeleton = skeleton.replaceAll(cmd.heredoc.content, '');
  }
  if ((skeleton.match(/<<(?!<)/g) ?? []).length > 1) {
    for (const cmd of commands) delete cmd.heredoc;
  }
}

export function parseCommand(input: string): ParseResult {
  if (!input || !input.trim()) {
    return {
      commands: [],
      hasSubshell: false,
      subshellCommands: [],
      parseError: false,
      chainAssignments: new Map(),
    };
  }

  // Quote unquoted parentheses in path-like tokens (e.g. Next.js route groups)
  const preprocessed = preprocessPathParentheses(input);

  const ast = parse(preprocessed);
  if (ast.errors?.length) {
    return {
      commands: [],
      hasSubshell: false,
      subshellCommands: [],
      parseError: true,
      chainAssignments: new Map(),
    };
  }

  const result: WalkResult = {
    commands: [],
    hasSubshell: false,
    subshellCommands: [],
    chainAssignments: new Map(),
  };

  for (const stmt of ast.commands) {
    const before = result.commands.length;
    walkNode(stmt, result);
    // unbash DROPS a command-less redirect (`> f`, `2>> f`) entirely - it lands
    // on neither the Statement nor the empty Command node. Recover its write
    // targets from the statement's own source slice so the fence still sees the
    // file the shell would truncate/create.
    if (result.commands.length === before && typeof stmt.pos === 'number' && typeof stmt.end === 'number') {
      const bareWrites = bareRedirectTargets(preprocessed.slice(stmt.pos, stmt.end));
      if (bareWrites.length > 0) {
        result.commands.push({
          command: '', originalCommand: '', args: [], envPrefixes: [],
          raw: bareWrites.join(' '), writeRedirects: bareWrites,
        });
      }
    }
  }

  dropHeredocsIfMultiple(input, result.commands);

  return {
    commands: result.commands,
    hasSubshell: result.hasSubshell,
    subshellCommands: result.subshellCommands,
    parseError: false,
    chainAssignments: result.chainAssignments,
    incomplete: result.incomplete === true,
    incompleteNodeTypes: result.incompleteNodeTypes,
  };
}
