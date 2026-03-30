import { parse } from 'unbash';
import type {
  Node, Statement, Command as UnbashCommand, Pipeline, AndOr,
  While, If, For, Case,
  Function as UnbashFunction,
  Subshell, BraceGroup, CompoundList,
  Select, Coproc, ArithmeticFor,
  Word, CommandExpansionPart, Redirect,
} from 'unbash';
import { basename } from 'path';
import { homedir } from 'os';
import type { ParsedCommand, ParseResult, ChainAssignment } from './types';

interface WalkResult {
  commands: ParsedCommand[];
  hasSubshell: boolean;
  subshellCommands: string[];
  chainAssignments: Map<string, ChainAssignment>;
}

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
    if (ch === '$' && i + 1 < input.length && input[i + 1] === '(') {
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

/** Scan a Word for command expansions and process substitutions. */
function collectExpansionsFromWord(word: Word, result: WalkResult): void {
  if (!word.parts) return;
  for (const part of word.parts) {
    switch (part.type) {
      case 'CommandExpansion':
        if (isCatHeredocInterpolation(part)) break;
        result.hasSubshell = true;
        result.subshellCommands.push(extractExpansionCommand(part.text));
        break;
      case 'DoubleQuoted':
      case 'LocaleString':
        for (const child of part.parts) {
          if (child.type === 'CommandExpansion') {
            if (isCatHeredocInterpolation(child)) continue;
            result.hasSubshell = true;
            result.subshellCommands.push(extractExpansionCommand(child.text));
          }
        }
        break;
      case 'ProcessSubstitution':
        result.hasSubshell = true;
        break;
    }
  }
}

/** Check if any redirect is a heredoc. */
function hasHeredocRedirect(redirects: Redirect[]): boolean {
  return redirects.some(r => r.operator === '<<' || r.operator === '<<-');
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
  return result;
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

function walkNode(node: Node, result: WalkResult): void {
  switch (node.type) {
    case 'Statement': {
      const stmt = node as Statement;
      if (hasHeredocRedirect(stmt.redirects)) {
        result.hasSubshell = true;
      }
      walkNode(stmt.command, result);
      break;
    }

    case 'Command': {
      const cmd = node as UnbashCommand;

      // Collect command expansions from name and suffix words
      if (cmd.name) collectExpansionsFromWord(cmd.name, result);
      for (const s of cmd.suffix) collectExpansionsFromWord(s, result);

      // Check for heredoc redirects
      if (hasHeredocRedirect(cmd.redirects)) {
        result.hasSubshell = true;
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
        break;
      }

      // Handle sh/bash/zsh -c "..." recursion
      if (
        (parsed.command === 'sh' ||
          parsed.command === 'bash' ||
          parsed.command === 'zsh') &&
        parsed.args.length >= 2 &&
        parsed.args[0] === '-c'
      ) {
        const innerResult = parseCommand(parsed.args[1]);
        if (innerResult.parseError) {
          result.commands.push(parsed);
        } else {
          result.commands.push(...innerResult.commands);
          if (innerResult.hasSubshell) result.hasSubshell = true;
          result.subshellCommands.push(...innerResult.subshellCommands);
        }
      } else if (
        (parsed.command === 'sh' ||
          parsed.command === 'bash' ||
          parsed.command === 'zsh') &&
        parsed.args.length >= 1
      ) {
        // Handle sh/bash/zsh <script> - extract script as the command
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
      for (const cmd of andOr.commands) walkNode(cmd, result);
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
      walkCompoundList((node as For).body, result);
      break;
    }

    case 'Case': {
      for (const item of (node as Case).items) {
        walkCompoundList(item.body, result);
      }
      break;
    }

    case 'Function': {
      walkNode((node as UnbashFunction).body, result);
      break;
    }

    case 'Subshell': {
      result.hasSubshell = true;
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
      walkCompoundList((node as Select).body, result);
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

    // TestCommand, ArithmeticCommand: no executable commands to extract
    default:
      break;
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
    walkNode(stmt, result);
  }

  return {
    commands: result.commands,
    hasSubshell: result.hasSubshell,
    subshellCommands: result.subshellCommands,
    parseError: false,
    chainAssignments: result.chainAssignments,
  };
}
