import parse from 'bash-parser';
import { basename } from 'path';
import { homedir } from 'os';
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

interface CompoundListNode extends AstNode {
  type: 'CompoundList';
  commands: AstNode[];
}

interface WhileUntilNode extends AstNode {
  type: 'While' | 'Until';
  clause: CompoundListNode;
  do: CompoundListNode;
}

interface IfNode extends AstNode {
  type: 'If';
  clause: CompoundListNode;
  then: CompoundListNode;
  else?: CompoundListNode | IfNode;
}

interface ForNode extends AstNode {
  type: 'For';
  do: CompoundListNode;
}

interface CaseItemNode extends AstNode {
  type: 'CaseItem';
  body?: CompoundListNode;
}

interface CaseNode extends AstNode {
  type: 'Case';
  cases?: CaseItemNode[];
}

interface FunctionNode extends AstNode {
  type: 'Function';
  body: CompoundListNode;
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
 * which is just string interpolation - not arbitrary command execution.
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
  // Split into segments respecting quotes - we only touch unquoted parts
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
      // Dynamic or null value - still mark resolvedFrom so evaluator knows it's chain-local
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
        // Standalone assignment (no command name) - track in chainAssignments
        for (const a of extractAssignments(cmd)) {
          result.chainAssignments.set(a.name, { value: a.value, isDynamic: a.isDynamic });
        }
        break;
      }

      // Handle sh/bash/zsh -c "..." - recursively parse inner command
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
      } else if (
        (parsed.command === 'sh' || parsed.command === 'bash' || parsed.command === 'zsh') &&
        parsed.args.length >= 1
      ) {
        // Handle sh/bash/zsh <script> - extract script as the command
        const scriptIdx = parsed.args.findIndex(a => !a.startsWith('-'));
        if (scriptIdx !== -1) {
          let scriptPath = parsed.args[scriptIdx];
          if (scriptPath.startsWith('~/')) {
            scriptPath = homedir() + scriptPath.slice(1);
          }
          const scriptCommand = scriptPath.includes('/') ? basename(scriptPath) : scriptPath;
          const scriptArgs = parsed.args.slice(scriptIdx + 1);
          result.commands.push({
            command: scriptCommand,
            originalCommand: scriptPath,
            args: scriptArgs,
            envPrefixes: parsed.envPrefixes,
            raw: parsed.raw,
          });
        } else {
          // All args are flags (e.g. bash --version) - keep as-is
          result.commands.push(parsed);
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

    case 'While':
    case 'Until': {
      const loop = node as WhileUntilNode;
      if (loop.clause?.commands) {
        for (const cmd of loop.clause.commands) walkNode(cmd, result);
      }
      if (loop.do?.commands) {
        for (const cmd of loop.do.commands) walkNode(cmd, result);
      }
      break;
    }

    case 'If': {
      const walkIf = (ifNode: IfNode): void => {
        if (ifNode.clause?.commands) {
          for (const cmd of ifNode.clause.commands) walkNode(cmd, result);
        }
        if (ifNode.then?.commands) {
          for (const cmd of ifNode.then.commands) walkNode(cmd, result);
        }
        if (ifNode.else) {
          if (ifNode.else.type === 'If') {
            walkIf(ifNode.else as IfNode);
          } else {
            const elseBlock = ifNode.else as CompoundListNode;
            if (elseBlock.commands) {
              for (const cmd of elseBlock.commands) walkNode(cmd, result);
            }
          }
        }
      };
      walkIf(node as IfNode);
      break;
    }

    case 'For': {
      const forNode = node as ForNode;
      if (forNode.do?.commands) {
        for (const cmd of forNode.do.commands) walkNode(cmd, result);
      }
      break;
    }

    case 'Case': {
      const caseNode = node as CaseNode;
      if (caseNode.cases) {
        for (const item of caseNode.cases) {
          if (item.body?.commands) {
            for (const cmd of item.body.commands) walkNode(cmd, result);
          }
        }
      }
      break;
    }

    case 'Function': {
      const funcNode = node as FunctionNode;
      if (funcNode.body?.commands) {
        for (const cmd of funcNode.body.commands) walkNode(cmd, result);
      }
      break;
    }

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
 * Skips expansion/commandAST children - heredocs inside $() are handled
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

  // Preprocess $(cat <<MARKER...MARKER) patterns - these are just multi-line
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
        // Heredocs are complex - flag as hasSubshell so evaluator can decide
        return { commands: result.commands, hasSubshell: true, subshellCommands: result.subshellCommands, parseError: false, chainAssignments: result.chainAssignments };
      } catch {
        return { commands: [], hasSubshell: true, subshellCommands: [], parseError: true, chainAssignments: new Map() };
      }
    }

    // No heredoc nodes - normal AST walking, no false positive
    for (const cmd of ast.commands) {
      walkNode(cmd, result);
    }

    return { commands: result.commands, hasSubshell: result.hasSubshell, subshellCommands: result.subshellCommands, parseError: false, chainAssignments: result.chainAssignments };
  } catch {
    // Parse failure - use regex fallback for heredoc detection
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
    // Compound command fallback: when bash-parser fails on nested control flow
    // (while/if/for/until/case), extract inner command groups and parse recursively.
    const compoundResult = compoundCommandFallback(input);
    if (compoundResult) return compoundResult;

    // Pipeline fallback: split on unquoted operators, parse each segment individually.
    // This handles cases like `gh run view ... 2>&1 | grep -v "^$" | head -20` where
    // bash-parser chokes on $ in double-quoted strings combined with pipe operators.
    const pipelineResult = pipelineFallbackParse(input);
    if (pipelineResult) return pipelineResult;

    // General parse failure - try regex fallback to extract at least the command name
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
      // Bare & (background) - too complex. But skip >&N redirect syntax.
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

  // No operators found - nothing to split
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
    // Merge after resolving - current segment's assignments available to next segments only
    for (const [k, v] of segResult.chainAssignments) {
      chainAssignments.set(k, v);
    }
  }

  return { commands: allCommands, hasSubshell, subshellCommands: allSubshellCommands, parseError: false, chainAssignments };
}

// Shell keywords that are part of control flow syntax, not commands.
const SHELL_KEYWORDS = new Set(['do', 'done', 'then', 'else', 'elif', 'fi', 'esac', 'in', ';;']);

// Keywords that start compound commands bash-parser may fail to nest.
const COMPOUND_STARTERS = /\b(while|until|if|for|case)\b/;

/**
 * Tokenize shell input into words respecting quotes, then match compound
 * command keyword pairs (while/do/done, if/then/fi, for/do/done, case/esac)
 * to extract inner command groups. Each group is recursively parsed.
 *
 * Returns null if the input doesn't contain compound command keywords.
 */
function compoundCommandFallback(input: string): ParseResult | null {
  if (!COMPOUND_STARTERS.test(input)) return null;

  const groups = extractCommandGroups(input);
  if (!groups) return null;

  const allCommands: ParsedCommand[] = [];
  let hasSubshell = false;
  const allSubshellCommands: string[] = [];
  const chainAssignments = new Map<string, ChainAssignment>();

  for (const group of groups) {
    const groupResult = parseCommand(group);
    if (groupResult.parseError) return null;
    allCommands.push(...groupResult.commands);
    if (groupResult.hasSubshell) hasSubshell = true;
    allSubshellCommands.push(...groupResult.subshellCommands);
    for (const [k, v] of groupResult.chainAssignments) {
      chainAssignments.set(k, v);
    }
  }

  return { commands: allCommands, hasSubshell, subshellCommands: allSubshellCommands, parseError: false, chainAssignments };
}

/**
 * Tokenize shell input into words respecting quotes, then walk through
 * matching compound keyword pairs to extract the command groups within.
 *
 * For `while COND; do BODY; done`, extracts [COND, BODY].
 * For `if COND; then BODY; elif COND2; then BODY2; else BODY3; fi`, extracts all groups.
 * For `for VAR in LIST; do BODY; done`, extracts [BODY].
 * For `case WORD in PAT) BODY;; esac`, extracts [BODY] from each case item.
 *
 * Handles nesting by depth-tracking keyword pairs.
 */
function extractCommandGroups(input: string): string[] | null {
  const tokens = shellTokenize(input);
  if (!tokens) return null;

  const groups: string[] = [];
  const result = walkTokens(tokens, 0, groups);
  if (!result.ok) return null;
  return groups.length > 0 ? groups : null;
}

interface TokenWalkResult {
  ok: boolean;
  pos: number;
}

/**
 * Walk tokens starting at `start`, extracting command groups from compound
 * commands and appending them to `groups`. Returns the position after the
 * last consumed token. Handles top-level semicolon/&&/|| chains.
 */
function walkTokens(tokens: string[], start: number, groups: string[]): TokenWalkResult {
  let i = start;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === 'while' || tok === 'until') {
      const r = walkWhileUntil(tokens, i, groups);
      if (!r.ok) return r;
      i = r.pos;
    } else if (tok === 'if') {
      const r = walkIf(tokens, i, groups);
      if (!r.ok) return r;
      i = r.pos;
    } else if (tok === 'for') {
      const r = walkFor(tokens, i, groups);
      if (!r.ok) return r;
      i = r.pos;
    } else if (tok === 'case') {
      const r = walkCase(tokens, i, groups);
      if (!r.ok) return r;
      i = r.pos;
    } else if (isCommandPosition(tokens, i) && SHELL_KEYWORDS.has(tok)) {
      // Unexpected keyword in command position - bail
      return { ok: false, pos: i };
    } else if (tok === ';' || tok === '&&' || tok === '||') {
      i++;
    } else {
      // Regular command - collect tokens until next keyword-at-command-position or separator
      const cmdTokens: string[] = [];
      while (i < tokens.length && tokens[i] !== ';' && tokens[i] !== '&&' && tokens[i] !== '||') {
        const atCmdPos = isCommandPosition(tokens, i);
        if (atCmdPos && (SHELL_KEYWORDS.has(tokens[i]) || COMPOUND_STARTERS.test(tokens[i]))) break;
        cmdTokens.push(tokens[i]);
        i++;
      }
      if (cmdTokens.length > 0) {
        groups.push(cmdTokens.join(' '));
      }
    }
  }
  return { ok: true, pos: i };
}

/** Walk `while COND; do BODY; done` or `until COND; do BODY; done`. */
function walkWhileUntil(tokens: string[], start: number, groups: string[]): TokenWalkResult {
  let i = start + 1; // skip 'while'/'until'
  // Collect condition until 'do'
  const cond = collectUntil(tokens, i, 'do');
  if (!cond) return { ok: false, pos: i };
  i = cond.end + 1; // skip 'do'

  // Collect body until matching 'done'
  const body = collectCompoundBody(tokens, i, 'done');
  if (!body) return { ok: false, pos: i };
  i = body.end + 1; // skip 'done'

  // Parse condition and body groups recursively
  const condResult = walkTokens(cond.tokens, 0, groups);
  if (!condResult.ok) return condResult;
  const bodyResult = walkTokens(body.tokens, 0, groups);
  if (!bodyResult.ok) return bodyResult;

  return { ok: true, pos: i };
}

/** Walk `if COND; then BODY [; elif COND; then BODY]* [; else BODY]; fi`. */
function walkIf(tokens: string[], start: number, groups: string[]): TokenWalkResult {
  let i = start + 1; // skip 'if'

  // Collect condition until 'then'
  const cond = collectUntil(tokens, i, 'then');
  if (!cond) return { ok: false, pos: i };
  i = cond.end + 1;
  const condResult = walkTokens(cond.tokens, 0, groups);
  if (!condResult.ok) return condResult;

  // Collect then-body until 'elif', 'else', or 'fi'
  const body = collectCompoundBodyMultiEnd(tokens, i, ['elif', 'else', 'fi']);
  if (!body) return { ok: false, pos: i };
  const bodyResult = walkTokens(body.tokens, 0, groups);
  if (!bodyResult.ok) return bodyResult;
  i = body.end;

  // Handle elif/else chains
  while (i < tokens.length && tokens[i] === 'elif') {
    i++; // skip 'elif'
    const elifCond = collectUntil(tokens, i, 'then');
    if (!elifCond) return { ok: false, pos: i };
    i = elifCond.end + 1;
    const elifCondResult = walkTokens(elifCond.tokens, 0, groups);
    if (!elifCondResult.ok) return elifCondResult;

    const elifBody = collectCompoundBodyMultiEnd(tokens, i, ['elif', 'else', 'fi']);
    if (!elifBody) return { ok: false, pos: i };
    const elifBodyResult = walkTokens(elifBody.tokens, 0, groups);
    if (!elifBodyResult.ok) return elifBodyResult;
    i = elifBody.end;
  }

  if (i < tokens.length && tokens[i] === 'else') {
    i++; // skip 'else'
    const elseBody = collectCompoundBody(tokens, i, 'fi');
    if (!elseBody) return { ok: false, pos: i };
    const elseBodyResult = walkTokens(elseBody.tokens, 0, groups);
    if (!elseBodyResult.ok) return elseBodyResult;
    i = elseBody.end;
  }

  if (i < tokens.length && tokens[i] === 'fi') {
    i++; // skip 'fi'
  } else {
    return { ok: false, pos: i };
  }

  return { ok: true, pos: i };
}

/** Walk `for VAR in LIST; do BODY; done`. */
function walkFor(tokens: string[], start: number, groups: string[]): TokenWalkResult {
  let i = start + 1; // skip 'for'
  // Skip variable name and optional 'in LIST'
  while (i < tokens.length && tokens[i] !== 'do' && tokens[i] !== ';') {
    i++;
  }
  if (i < tokens.length && tokens[i] === ';') i++;
  if (i >= tokens.length || tokens[i] !== 'do') return { ok: false, pos: i };
  i++; // skip 'do'

  const body = collectCompoundBody(tokens, i, 'done');
  if (!body) return { ok: false, pos: i };
  const bodyResult = walkTokens(body.tokens, 0, groups);
  if (!bodyResult.ok) return bodyResult;
  i = body.end + 1; // skip 'done'

  return { ok: true, pos: i };
}

/** Walk `case WORD in PAT) BODY;; ... esac`. */
function walkCase(tokens: string[], start: number, groups: string[]): TokenWalkResult {
  let i = start + 1; // skip 'case'
  // Skip word and 'in'
  while (i < tokens.length && tokens[i] !== 'in') i++;
  if (i >= tokens.length) return { ok: false, pos: i };
  i++; // skip 'in'

  // Parse case items until 'esac'
  while (i < tokens.length && tokens[i] !== 'esac') {
    // Skip pattern(s) until ')'
    while (i < tokens.length && !tokens[i].endsWith(')') && tokens[i] !== 'esac') i++;
    if (i >= tokens.length || tokens[i] === 'esac') break;
    i++; // skip the token ending with ')'

    // Collect body until ';;' or 'esac'
    const bodyTokens: string[] = [];
    while (i < tokens.length && tokens[i] !== ';;' && tokens[i] !== 'esac') {
      bodyTokens.push(tokens[i]);
      i++;
    }
    if (bodyTokens.length > 0) {
      const bodyResult = walkTokens(bodyTokens, 0, groups);
      if (!bodyResult.ok) return bodyResult;
    }
    if (i < tokens.length && tokens[i] === ';;') i++;
  }
  if (i < tokens.length && tokens[i] === 'esac') i++;

  return { ok: true, pos: i };
}

/** Check if token at position `i` is in command position (where a keyword would be recognized). */
function isCommandPosition(tokens: string[], i: number): boolean {
  if (i === 0) return true;
  const prev = tokens[i - 1];
  // After separators, a token is in command position
  if (prev === ';' || prev === '&&' || prev === '||' || prev === '|' || prev === ';;') return true;
  // After control flow keywords that expect a command list
  if (prev === 'do' || prev === 'then' || prev === 'else') return true;
  return false;
}

/**
 * Collect tokens from `start` until one of `endKeywords` at depth 0.
 * Tracks nesting depth by counting compound starters vs their closers.
 * Only recognizes keywords in command position to avoid matching arguments.
 */
function collectCompoundBodyMultiEnd(tokens: string[], start: number, endKeywords: string[]): { tokens: string[]; end: number } | null {
  const collected: string[] = [];
  let depth = 0;
  let i = start;

  while (i < tokens.length) {
    const tok = tokens[i];
    const atCmdPos = isCommandPosition(tokens, i);

    if (atCmdPos && depth === 0 && endKeywords.includes(tok)) {
      return { tokens: collected, end: i };
    }

    if (atCmdPos) {
      if (tok === 'while' || tok === 'until' || tok === 'for' || tok === 'if' || tok === 'case') {
        depth++;
      } else if (tok === 'done' || tok === 'fi' || tok === 'esac') {
        depth--;
      }
    }

    collected.push(tok);
    i++;
  }

  return null; // No matching end keyword found
}

/** Collect tokens until a matching end keyword, wrapping collectCompoundBodyMultiEnd. */
function collectCompoundBody(tokens: string[], start: number, endKeyword: string): { tokens: string[]; end: number } | null {
  return collectCompoundBodyMultiEnd(tokens, start, [endKeyword]);
}

/** Collect tokens until a specific keyword at the current depth. */
function collectUntil(tokens: string[], start: number, keyword: string): { tokens: string[]; end: number } | null {
  const collected: string[] = [];
  let i = start;
  let depth = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const atCmdPos = isCommandPosition(tokens, i);
    if (atCmdPos && depth === 0 && tok === keyword) {
      return { tokens: collected, end: i };
    }
    if (atCmdPos) {
      if (tok === 'while' || tok === 'until' || tok === 'for' || tok === 'if' || tok === 'case') depth++;
      if (tok === 'done' || tok === 'fi' || tok === 'esac') depth--;
    }
    collected.push(tok);
    i++;
  }
  return null;
}

/**
 * Tokenize a shell command string into words, respecting quotes.
 * Preserves semicolons and operators as separate tokens.
 */
function shellTokenize(input: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let i = 0;

  const flush = () => {
    if (current) { tokens.push(current); current = ''; }
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\' && !inSingle) {
      current += ch;
      if (i + 1 < input.length) { current += input[i + 1]; i += 2; } else { i++; }
      continue;
    }

    if (ch === "'" && !inDouble) { inSingle = !inSingle; current += ch; i++; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; current += ch; i++; continue; }

    if (!inSingle && !inDouble) {
      if (ch === ';' && i + 1 < input.length && input[i + 1] === ';') {
        flush();
        tokens.push(';;');
        i += 2;
        continue;
      }
      if (ch === ';') {
        flush();
        tokens.push(';');
        i++;
        continue;
      }
      if (ch === '&' && i + 1 < input.length && input[i + 1] === '&') {
        flush();
        tokens.push('&&');
        i += 2;
        continue;
      }
      if (ch === '|' && i + 1 < input.length && input[i + 1] === '|') {
        flush();
        tokens.push('||');
        i += 2;
        continue;
      }
      if (ch === '|') {
        flush();
        tokens.push('|');
        i++;
        continue;
      }
      if (/\s/.test(ch)) {
        flush();
        i++;
        continue;
      }
    }

    current += ch;
    i++;
  }
  flush();

  return tokens.length > 0 ? tokens : null;
}

/**
 * Regex-based fallback parser for when bash-parser fails.
 * Extracts the command name and arguments from simple single commands.
 * Only handles straightforward cases - returns null for pipes, chains, etc.
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
