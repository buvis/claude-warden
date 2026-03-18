import parse from 'bash-parser';
import { basename } from 'path';
import type { ParsedCommand, ParseResult, ChainAssignment } from './types';

interface AstNode {
  type: string;
  [key: string]: unknown;
}

interface WordNode extends AstNode {
  type: 'Word';
  text: string;
  expansion?: ExpansionNode[];
}

interface AssignmentNode extends AstNode {
  type: 'AssignmentWord';
  text: string;
}

interface ExpansionNode extends AstNode {
  type: 'CommandExpansion' | 'ParameterExpansion' | 'ArithmeticExpansion';
  command?: string;
}

interface CommandNode extends AstNode {
  type: 'Command';
  name?: WordNode;
  prefix?: (AssignmentNode | AstNode)[];
  suffix?: (WordNode | AstNode)[];
}

interface PipelineNode extends AstNode {
  type: 'Pipeline';
  commands: AstNode[];
}

interface LogicalExpressionNode extends AstNode {
  type: 'LogicalExpression';
  op: 'and' | 'or';
  left: AstNode;
  right: AstNode;
}

interface SubshellNode extends AstNode {
  type: 'Subshell';
  list: { type: 'CompoundList'; commands: AstNode[] };
}

interface ScriptNode extends AstNode {
  type: 'Script';
  commands: AstNode[];
}

interface WalkResult {
  commands: ParsedCommand[];
  hasSubshell: boolean;
  subshellCommands: string[];
  chainAssignments: Map<string, ChainAssignment>;
}

const HEREDOC_REGEX = /<<-?\s*['"]?\w+['"]?/;

/**
 * Replace $(cat <<MARKER...MARKER) patterns with a placeholder string.
 * This handles the common idiom of passing multi-line text via heredoc,
 * which is just string interpolation — not arbitrary command execution.
 */
function preprocessCatHeredocs(input: string): string {
  // Match $(cat <<[-]?['"]?MARKER['"]?\n...MARKER\n) patterns
  const regex = /\$\(cat\s+<<-?\s*['"]?(\w+)['"]?\n([\s\S]*?)\n\1\s*\)/g;
  return input.replace(regex, '__HEREDOC_TEXT__');
}

/**
 * Quote unquoted parentheses in path-like tokens so bash-parser doesn't
 * choke on them. Targets patterns like `foo/(bar)/baz` where parens are
 * clearly part of a file path (e.g. Next.js route groups).
 *
 * Strategy: find unquoted tokens that contain `/` adjacent to `(` or `)`,
 * and wrap the entire token in double quotes.
 */
function preprocessPathParentheses(input: string): string {
  // Split into segments respecting quotes — we only touch unquoted parts
  const result: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    // Preserve quoted strings as-is
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) {
        if (input[j] === '\\' && quote === '"') j++; // skip escaped char in double quotes
        j++;
      }
      result.push(input.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    // Preserve $(...) as-is (command substitution)
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
    // Collect an unquoted token (non-whitespace, non-shell-operator segment)
    if (ch !== ' ' && ch !== '\t' && ch !== '\n') {
      let j = i;
      while (j < input.length && !' \t\n'.includes(input[j]) && input[j] !== '"' && input[j] !== "'" && !(input[j] === '$' && j + 1 < input.length && input[j + 1] === '(')) {
        j++;
      }
      const token = input.slice(i, j);
      // Quote if it looks like a path with parentheses: contains / and ( or )
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

const VAR_REF_REGEX = /^\$\{?(\w+)\}?$/;

function resolveVarRef(text: string, chainAssignments: Map<string, ChainAssignment>): string | null {
  const m = text.match(VAR_REF_REGEX);
  if (!m) return null;
  const assignment = chainAssignments.get(m[1]);
  if (!assignment || assignment.isDynamic || assignment.value === null) return null;
  return assignment.value;
}

function convertCommand(node: CommandNode, chainAssignments: Map<string, ChainAssignment>): ParsedCommand | null {
  if (!node.name) return null;

  let originalCommand = node.name.text;
  let resolvedFrom: string | undefined;

  // Resolve $VAR in command position
  const varMatch = originalCommand.match(VAR_REF_REGEX);
  if (varMatch) {
    const resolved = resolveVarRef(originalCommand, chainAssignments);
    if (resolved !== null) {
      resolvedFrom = originalCommand;
      originalCommand = resolved;
    } else if (chainAssignments.has(varMatch[1])) {
      // Dynamic or null value — still mark resolvedFrom so evaluator knows it's chain-local
      resolvedFrom = originalCommand;
    }
  }

  const command = originalCommand.includes('/')
    ? basename(originalCommand)
    : originalCommand;

  const envPrefixes: string[] = [];
  if (node.prefix) {
    for (const p of node.prefix) {
      if (p.type === 'AssignmentWord') {
        envPrefixes.push((p as AssignmentNode).text);
      }
    }
  }

  const args: string[] = [];
  if (node.suffix) {
    for (const s of node.suffix) {
      if (s.type === 'Word') {
        args.push((s as WordNode).text);
      }
      // Skip redirect operators (type: 'dless', etc.)
    }
  }

  // Reconstruct raw from parts
  const rawParts = [
    ...envPrefixes,
    node.name.text,
    ...args,
  ];
  const raw = rawParts.join(' ');

  const result: ParsedCommand = { command, originalCommand, args, envPrefixes, raw };
  if (resolvedFrom) result.resolvedFrom = resolvedFrom;
  return result;
}

function collectCommandExpansions(node: AstNode): string[] {
  const commands: string[] = [];

  if (node.type === 'Command') {
    const cmd = node as CommandNode;
    if (cmd.suffix) {
      for (const s of cmd.suffix) {
        if (s.type === 'Word' && (s as WordNode).expansion) {
          for (const exp of (s as WordNode).expansion!) {
            if (exp.type === 'CommandExpansion' && exp.command) {
              commands.push(exp.command);
            }
          }
        }
      }
    }
    if (cmd.name?.expansion) {
      for (const exp of cmd.name.expansion) {
        if (exp.type === 'CommandExpansion' && exp.command) {
          commands.push(exp.command);
        }
      }
    }
  }

  return commands;
}

/** Extract assignments from a Command node's prefix (VAR=value tokens). */
function extractAssignments(node: CommandNode): Array<{ name: string; value: string | null; isDynamic: boolean }> {
  const assignments: Array<{ name: string; value: string | null; isDynamic: boolean }> = [];
  if (!node.prefix) return assignments;

  for (const p of node.prefix) {
    if (p.type !== 'AssignmentWord') continue;
    const text = (p as AssignmentNode).text;
    const eqIdx = text.indexOf('=');
    if (eqIdx === -1) continue;
    const name = text.slice(0, eqIdx);
    const value = text.slice(eqIdx + 1);
    // Strip surrounding quotes from value
    const stripped = value.replace(/^['"]|['"]$/g, '');
    const isDynamic = /\$\(|`/.test(value);
    assignments.push({ name, value: isDynamic ? null : stripped, isDynamic });
  }
  return assignments;
}

function walkNode(node: AstNode, result: WalkResult): void {
  switch (node.type) {
    case 'Command': {
      const cmd = node as CommandNode;

      // Check for command substitutions
      const expansions = collectCommandExpansions(node);
      if (expansions.length > 0) {
        result.hasSubshell = true;
        result.subshellCommands.push(...expansions);
      }

      const parsed = convertCommand(cmd, result.chainAssignments);
      if (!parsed) {
        // Standalone assignment (no command name) — track in chainAssignments
        for (const a of extractAssignments(cmd)) {
          result.chainAssignments.set(a.name, { value: a.value, isDynamic: a.isDynamic });
        }
        break;
      }

      // Handle sh/bash/zsh -c "..." — recursively parse inner command
      if (
        (parsed.command === 'sh' || parsed.command === 'bash' || parsed.command === 'zsh') &&
        parsed.args.length >= 2 &&
        parsed.args[0] === '-c'
      ) {
        const innerResult = parseCommand(parsed.args[1]);
        if (innerResult.parseError) {
          result.commands.push(parsed); // fallback to the raw sh -c command
        } else {
          result.commands.push(...innerResult.commands);
          if (innerResult.hasSubshell) {
            result.hasSubshell = true;
          }
          result.subshellCommands.push(...innerResult.subshellCommands);
        }
      } else {
        result.commands.push(parsed);
      }
      break;
    }

    case 'Pipeline': {
      const pipeline = node as PipelineNode;
      for (const cmd of pipeline.commands) {
        walkNode(cmd, result);
      }
      break;
    }

    case 'LogicalExpression': {
      const logical = node as LogicalExpressionNode;
      walkNode(logical.left, result);
      walkNode(logical.right, result);
      break;
    }

    case 'Subshell': {
      result.hasSubshell = true;
      const subshell = node as SubshellNode;
      if (subshell.list?.commands) {
        for (const cmd of subshell.list.commands) {
          walkNode(cmd, result);
        }
      }
      break;
    }

    // Complex constructs — flag as subshell for safety
    case 'If':
    case 'For':
    case 'While':
    case 'Until':
    case 'Case':
    case 'Function':
      result.hasSubshell = true;
      break;

    default:
      break;
  }
}

/**
 * Parse a full shell command string into individual commands.
 */
/**
 * Check if a Command node contains a heredoc redirect (suffix with type 'dless').
 */
function hasHeredocRedirect(node: CommandNode): boolean {
  if (!node.suffix) return false;
  return node.suffix.some(s => s.type === 'dless' || s.type === 'dlessdash');
}

/**
 * Parse a full shell command string into individual commands.
 */
/**
 * Check if any top-level Command node in the AST has a heredoc redirect.
 * Skips expansion/commandAST children — heredocs inside $() are handled
 * correctly by bash-parser and don't cause misparse of body lines.
 */
function astHasHeredoc(ast: ScriptNode): boolean {
  function check(node: AstNode): boolean {
    if (node.type === 'Command') {
      if (hasHeredocRedirect(node as CommandNode)) return true;
    }
    // Recurse into child nodes, but skip commandAST inside expansions
    for (const [key, value] of Object.entries(node)) {
      if (key === 'commandAST' || key === 'expansion') continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && 'type' in child && check(child as AstNode)) return true;
        }
      } else if (value && typeof value === 'object' && 'type' in (value as object)) {
        if (check(value as AstNode)) return true;
      }
    }
    return false;
  }
  for (const cmd of ast.commands) {
    if (check(cmd)) return true;
  }
  return false;
}

export function parseCommand(input: string): ParseResult {
  if (!input || !input.trim()) {
    return { commands: [], hasSubshell: false, subshellCommands: [], parseError: false, chainAssignments: new Map() };
  }

  // Preprocess $(cat <<MARKER...MARKER) patterns — these are just multi-line
  // string interpolation, not arbitrary subshells. Replace with placeholder text
  // so the parser sees clean commands (e.g. `gh pr create --body "__HEREDOC_TEXT__"`).
  input = preprocessCatHeredocs(input);

  // Quote unquoted parentheses in path-like tokens (e.g. Next.js route groups)
  input = preprocessPathParentheses(input);

  try {
    const ast = parse(input) as ScriptNode;
    const result: WalkResult = { commands: [], hasSubshell: false, subshellCommands: [], chainAssignments: new Map() };

    // Check if the AST contains actual heredoc redirects (dless/dlessdash).
    // bash-parser misparses heredoc body lines as separate commands, so we
    // need to fall back to first-line extraction for real heredocs.
    if (astHasHeredoc(ast)) {
      const firstLine = input.split('\n')[0];
      const cmdPart = firstLine.replace(/<<-?\s*['"]?\w+['"]?.*$/, '').trim();
      if (!cmdPart) {
        return { commands: [], hasSubshell: false, subshellCommands: [], parseError: true, chainAssignments: new Map() };
      }
      try {
        const cmdAst = parse(cmdPart) as ScriptNode;
        for (const cmd of cmdAst.commands) {
          walkNode(cmd, result);
        }
        // Heredocs are complex — flag as hasSubshell so evaluator can decide
        return { commands: result.commands, hasSubshell: true, subshellCommands: result.subshellCommands, parseError: false, chainAssignments: result.chainAssignments };
      } catch {
        return { commands: [], hasSubshell: true, subshellCommands: [], parseError: true, chainAssignments: new Map() };
      }
    }

    // No heredoc nodes — normal AST walking, no false positive
    for (const cmd of ast.commands) {
      walkNode(cmd, result);
    }

    return { commands: result.commands, hasSubshell: result.hasSubshell, subshellCommands: result.subshellCommands, parseError: false, chainAssignments: result.chainAssignments };
  } catch {
    // Parse failure — use regex fallback for heredoc detection
    if (HEREDOC_REGEX.test(input)) {
      const firstLine = input.split('\n')[0];
      const cmdPart = firstLine.replace(/<<-?\s*['"]?\w+['"]?.*$/, '').trim();
      if (!cmdPart) {
        return { commands: [], hasSubshell: true, subshellCommands: [], parseError: true, chainAssignments: new Map() };
      }
      try {
        const ast = parse(cmdPart) as ScriptNode;
        const result: WalkResult = { commands: [], hasSubshell: false, subshellCommands: [], chainAssignments: new Map() };
        for (const cmd of ast.commands) {
          walkNode(cmd, result);
        }
        return { commands: result.commands, hasSubshell: true, subshellCommands: result.subshellCommands, parseError: false, chainAssignments: result.chainAssignments };
      } catch {
        return { commands: [], hasSubshell: true, subshellCommands: [], parseError: true, chainAssignments: new Map() };
      }
    }
    // Pipeline fallback: split on unquoted operators, parse each segment individually.
    // This handles cases like `gh run view ... 2>&1 | grep -v "^$" | head -20` where
    // bash-parser chokes on $ in double-quoted strings combined with pipe operators.
    const pipelineResult = pipelineFallbackParse(input);
    if (pipelineResult) return pipelineResult;

    // General parse failure — try regex fallback to extract at least the command name
    // so the evaluator can still apply rules (e.g. gh is default allow).
    // This handles cases where bash-parser chokes on special characters in arguments
    // (like $ in double-quoted strings that aren't actual expansions).
    const fallback = regexFallbackParse(input);
    if (fallback) {
      return { commands: [fallback], hasSubshell: false, subshellCommands: [], parseError: false, chainAssignments: new Map() };
    }
    return { commands: [], hasSubshell: false, subshellCommands: [], parseError: true, chainAssignments: new Map() };
  }
}

/**
 * Split a shell command string on unquoted operators (|, ||, &&, ;).
 * Returns null if there are no operators, if a bare & (background) is found,
 * or if any resulting segment is empty.
 */
function splitOnUnquotedOperators(input: string): { segments: string[]; operators: string[] } | null {
  const segments: string[] = [];
  const operators: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let parenDepth = 0;  // tracks $() nesting
  let inBacktick = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Handle escapes outside single quotes
    if (ch === '\\' && !inSingle) {
      current += ch;
      if (i + 1 < input.length) {
        current += input[i + 1];
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (ch === "'" && !inDouble && !inBacktick && parenDepth === 0) { inSingle = !inSingle; current += ch; i++; continue; }
    if (ch === '"' && !inSingle && !inBacktick) { inDouble = !inDouble; current += ch; i++; continue; }
    if (ch === '`' && !inSingle) { inBacktick = !inBacktick; current += ch; i++; continue; }

    // Track $() depth (can appear inside or outside double quotes)
    if (ch === '$' && i + 1 < input.length && input[i + 1] === '(' && !inSingle && !inBacktick) {
      parenDepth++;
      current += ch + input[i + 1];
      i += 2;
      continue;
    }
    if (ch === ')' && parenDepth > 0 && !inSingle && !inBacktick) {
      parenDepth--;
      current += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && parenDepth === 0 && !inBacktick) {
      // Check || before |
      if (ch === '|' && i + 1 < input.length && input[i + 1] === '|') {
        const seg = current.trim();
        if (!seg) return null;
        segments.push(seg);
        operators.push('||');
        current = '';
        i += 2;
        continue;
      }
      if (ch === '|') {
        const seg = current.trim();
        if (!seg) return null;
        segments.push(seg);
        operators.push('|');
        current = '';
        i++;
        continue;
      }
      // Check && before bare &
      if (ch === '&' && i + 1 < input.length && input[i + 1] === '&') {
        const seg = current.trim();
        if (!seg) return null;
        segments.push(seg);
        operators.push('&&');
        current = '';
        i += 2;
        continue;
      }
      // Bare & (background) — too complex. But skip >&N redirect syntax.
      if (ch === '&' && (current.length === 0 || current[current.length - 1] !== '>')) return null;

      if (ch === ';') {
        const seg = current.trim();
        if (!seg) return null;
        segments.push(seg);
        operators.push(';');
        current = '';
        i++;
        continue;
      }
    }

    current += ch;
    i++;
  }

  // Last segment
  const lastSeg = current.trim();
  if (!lastSeg) return null;
  segments.push(lastSeg);

  // No operators found — nothing to split
  if (operators.length === 0) return null;

  return { segments, operators };
}

/**
 * Pipeline fallback: when bash-parser fails on a multi-segment command,
 * split on unquoted operators and parse each segment individually.
 * Returns null if splitting fails or any segment fails to parse.
 */
function pipelineFallbackParse(input: string): ParseResult | null {
  const split = splitOnUnquotedOperators(input);
  if (!split) return null;

  const allCommands: ParsedCommand[] = [];
  let hasSubshell = false;
  const allSubshellCommands: string[] = [];
  const chainAssignments = new Map<string, ChainAssignment>();

  for (const segment of split.segments) {
    const segResult = parseCommand(segment);
    if (segResult.parseError) return null;

    // Resolve $VAR commands using chain assignments accumulated from prior segments
    for (const cmd of segResult.commands) {
      const varMatch = cmd.command.match(VAR_REF_REGEX);
      if (varMatch && !cmd.resolvedFrom) {
        const assignment = chainAssignments.get(varMatch[1]);
        if (assignment && !assignment.isDynamic && assignment.value !== null) {
          cmd.resolvedFrom = cmd.command;
          cmd.originalCommand = assignment.value;
          cmd.command = assignment.value.includes('/') ? basename(assignment.value) : assignment.value;
        } else if (assignment) {
          cmd.resolvedFrom = cmd.command;
        }
      }
    }

    allCommands.push(...segResult.commands);
    if (segResult.hasSubshell) hasSubshell = true;
    allSubshellCommands.push(...segResult.subshellCommands);
    // Merge after resolving — current segment's assignments available to next segments only
    for (const [k, v] of segResult.chainAssignments) {
      chainAssignments.set(k, v);
    }
  }

  return { commands: allCommands, hasSubshell, subshellCommands: allSubshellCommands, parseError: false, chainAssignments };
}

/**
 * Regex-based fallback parser for when bash-parser fails.
 * Extracts the command name and arguments from simple single commands.
 * Only handles straightforward cases — returns null for pipes, chains, etc.
 */
function regexFallbackParse(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Don't attempt fallback for pipes, chains, or semicolons (too complex)
  // Check outside of quotes
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && inDouble) { i++; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && (ch === '|' || ch === ';' || (ch === '&' && trimmed[i + 1] === '&'))) {
      return null; // Too complex for fallback
    }
  }

  // Skip env prefixes (VAR=value)
  const envPrefixes: string[] = [];
  let rest = trimmed;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(rest)) {
    const match = rest.match(/^([A-Za-z_][A-Za-z0-9_]*=\S*)\s*/);
    if (!match) break;
    envPrefixes.push(match[1]);
    rest = rest.slice(match[0].length);
  }

  if (!rest) return null;

  // Extract command (first token)
  const cmdMatch = rest.match(/^(\S+)/);
  if (!cmdMatch) return null;

  const originalCommand = cmdMatch[1];
  const command = originalCommand.includes('/') ? basename(originalCommand) : originalCommand;
  const argsStr = rest.slice(cmdMatch[0].length).trim();

  // Tokenize args respecting quotes
  const args: string[] = [];
  let current = '';
  let qSingle = false;
  let qDouble = false;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '\\' && qDouble && i + 1 < argsStr.length) {
      current += argsStr[++i];
      continue;
    }
    if (ch === "'" && !qDouble) { qSingle = !qSingle; continue; }
    if (ch === '"' && !qSingle) { qDouble = !qDouble; continue; }
    if (!qSingle && !qDouble && /\s/.test(ch)) {
      if (current) { args.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current) args.push(current);

  return { command, originalCommand, args, envPrefixes, raw: trimmed };
}
