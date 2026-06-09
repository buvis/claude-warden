import type { ParsedCommand, WardenConfig, CommandEvalDetail } from './types';
import { scanScriptCode, readScriptFile, type Language } from './script-scanner';
import { collectMergedRule } from './evaluator';

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

/**
 * Map scanScriptCode result to a CommandEvalDetail, or null if user rules should take precedence.
 *
 * Pass `inline` for `-c`/`-e`-style invocations: the reason is wrapped with an
 * educational nudge ("For JSON, prefer jq. For reuse, save to scripts/*.{ext} ...") so
 * Claude has a fresh prompt to pick the right tool, even after SessionStart guidance has
 * been compacted out of context.
 */
/** Wrap a scan reason with the inline educational nudge for `-c`/`-e`-style invocations. */
function withInlineNudge(reason: string, inline?: { lang: string; ext: string }): string {
  return inline
    ? `Inline ${inline.lang} is hard to audit. For JSON, prefer \`jq\`. For reuse, save to scripts/*.${inline.ext} and run it. (${reason})`
    : reason;
}

function mapScanResult(
  cmd: ParsedCommand,
  scanResult: ReturnType<typeof scanScriptCode>,
  matchedRule: string,
  config: WardenConfig,
  inline?: { lang: string; ext: string },
): CommandEvalDetail | null {
  if (scanResult.verdict === 'dangerous') {
    const reason = withInlineNudge(`dangerous: ${scanResult.reason}`, inline);
    return { command: cmd.command, args: cmd.args, decision: 'ask', reason, matchedRule };
  }
  if (scanResult.verdict === 'cautious') {
    const reason = withInlineNudge(scanResult.reason, inline);
    return { command: cmd.command, args: cmd.args, decision: 'ask', reason, matchedRule };
  }
  if (scanResult.verdict === 'unknown') {
    // No positive safe-shape and no danger pattern: ask. Allow now requires a `safe`
    // verdict, so absence of evidence is no longer a silent allow. A user `default: deny`
    // is stricter than ask, so defer to it (preserves "user deny still wins").
    if (userRulesWouldRestrict(cmd, config)) return null;
    const reason = withInlineNudge(scanResult.reason, inline);
    return { command: cmd.command, args: cmd.args, decision: 'ask', reason, matchedRule };
  }
  // safe: allow path (respects user deny rules)
  if (userRulesWouldRestrict(cmd, config)) return null;
  return { command: cmd.command, args: cmd.args, decision: 'allow', reason: 'script content is safe', matchedRule };
}

/** Try to read and scan a script file, returning a CommandEvalDetail or null if user rules take precedence. */
function scanScriptFile(
  cmd: ParsedCommand,
  filePath: string,
  language: Language,
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

/** Allow when any of `flags` (exact match) is present — version/help flags. */
function allowIfVersionFlag(cmd: ParsedCommand, flags: string[], rule: string): CommandEvalDetail | null {
  if (cmd.args.some(a => flags.includes(a))) {
    return { command: cmd.command, args: cmd.args, decision: 'allow', reason: 'version/help flag', matchedRule: rule };
  }
  return null;
}

/** Ask: no args means the interpreter opens an interactive REPL. */
function askRepl(cmd: ParsedCommand, rule: string): CommandEvalDetail {
  return { command: cmd.command, args: cmd.args, decision: 'ask', reason: 'opens interactive REPL', matchedRule: rule };
}

const SAFE_PYTHON_MODULES = new Set([
  'pytest', 'unittest', 'venv', 'pip', 'json.tool', 'compileall',
  'pydoc', 'doctest', 'timeit', 'py_compile', 'black', 'ruff',
  'mypy', 'isort', 'ensurepip', 'zipfile', 'site', 'cProfile',
  'pdb', 'dis', 'ast', 'tokenize', 'sysconfig',
]);

function evaluatePythonCommand(cmd: ParsedCommand, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'python:script';

  const version = allowIfVersionFlag(cmd, ['--version', '--help', '-V'], rule);
  if (version) return version;

  // -c <code>
  const cIdx = args.indexOf('-c');
  if (cIdx !== -1) {
    const code = args[cIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after -c', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'python'), rule, config, { lang: 'Python', ext: 'py' });
  }

  // -m <module>
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

  // First arg ending in .py → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && a.endsWith('.py'));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'python', rule, config, cwd);
  }

  if (args.length === 0) return askRepl(cmd, rule);

  // Fall through to rules
  return null;
}

const NODE_SCRIPT_EXTENSIONS = /\.(js|mjs|cjs|ts|mts|cts|tsx|jsx)$/;

function evaluateNodeCommand(cmd: ParsedCommand, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'node:script';

  const version = allowIfVersionFlag(cmd, ['--version', '--help', '-v', '-h'], rule);
  if (version) return version;

  // -e / --eval / -p / --print → inline code (also --eval=script / --print=script form)
  const inlineJs = { lang: 'JavaScript', ext: 'js' };
  const evalIdx = args.findIndex(a => a === '-e' || a === '--eval' || a === '-p' || a === '--print');
  if (evalIdx !== -1) {
    const code = args[evalIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after eval flag', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'typescript'), rule, config, inlineJs);
  }
  const evalEqArg = args.find(a => a.startsWith('--eval=') || a.startsWith('--print='));
  if (evalEqArg) {
    const code = evalEqArg.slice(evalEqArg.indexOf('=') + 1);
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after eval flag', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'typescript'), rule, config, inlineJs);
  }

  // First arg ending in script extension → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && NODE_SCRIPT_EXTENSIONS.test(a));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'typescript', rule, config, cwd);
  }

  if (args.length === 0) return askRepl(cmd, rule);

  // Fall through to rules
  return null;
}

function evaluatePerlCommand(cmd: ParsedCommand, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'perl:script';

  const version = allowIfVersionFlag(cmd, ['--version', '--help', '-v'], rule);
  if (version) return version;

  // -i (in-place edit) is checked before the eval flag because it can be bundled
  // (-pie, -pi) or standalone (-i, -i.bak). Mutates files; ask regardless of body.
  if (args.some(a => /^-[a-z]*i/.test(a))) {
    return {
      command,
      args,
      decision: 'ask',
      reason: 'Perl `-i` does in-place file edits. Save the script to scripts/*.pl and run it.',
      matchedRule: rule,
    };
  }

  // -e / -E inline (also bundled: -pe, -ne, -ane, -pE — common sed-like one-liners).
  // The `[npa]` lets us accept the read-only short flags without breaking strict -e/-E.
  const eIdx = args.findIndex(a => /^-[npa]*[eE]$/.test(a));
  if (eIdx !== -1) {
    const code = args[eIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after -e', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'perl'), rule, config, { lang: 'Perl', ext: 'pl' });
  }

  // First arg ending in .pl / .pm → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && (a.endsWith('.pl') || a.endsWith('.pm')));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'perl', rule, config, cwd);
  }

  if (args.length === 0) return askRepl(cmd, rule);

  // Fall through to rules
  return null;
}

function evaluateRubyCommand(cmd: ParsedCommand, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'ruby:script';

  const version = allowIfVersionFlag(cmd, ['--version', '--help', '-v', '-h'], rule);
  if (version) return version;

  // -e / --eval → inline code
  const evalIdx = args.findIndex(a => a === '-e' || a === '--eval');
  if (evalIdx !== -1) {
    const code = args[evalIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after eval flag', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'ruby'), rule, config, { lang: 'Ruby', ext: 'rb' });
  }

  // First arg ending in .rb → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && a.endsWith('.rb'));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'ruby', rule, config, cwd);
  }

  if (args.length === 0) return askRepl(cmd, rule);

  // Fall through to rules
  return null;
}

function evaluatePhpCommand(cmd: ParsedCommand, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  const { command, args } = cmd;
  const rule = 'php:script';

  const version = allowIfVersionFlag(cmd, ['--version', '--help', '-v', '-h'], rule);
  if (version) return version;

  // -r → inline code
  const rIdx = args.indexOf('-r');
  if (rIdx !== -1) {
    const code = args[rIdx + 1];
    if (!code) {
      return { command, args, decision: 'ask', reason: 'missing code after -r', matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, 'php'), rule, config, { lang: 'PHP', ext: 'php' });
  }

  // First arg ending in .php → read and scan
  const scriptArg = args.find(a => !a.startsWith('-') && a.endsWith('.php'));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, 'php', rule, config, cwd);
  }

  if (args.length === 0) return askRepl(cmd, rule);

  // Fall through to rules
  return null;
}

// ─── Dispatch ───

/**
 * Route a command to its script-safety evaluator (python/python3, node/tsx/ts-node,
 * perl, ruby, php). Returns null when the command is not a script interpreter or it
 * defers to normal rules.
 */
export function tryScriptEval(cmd: ParsedCommand, config: WardenConfig, cwd?: string): CommandEvalDetail | null {
  switch (cmd.command) {
    case 'python':
    case 'python3': return evaluatePythonCommand(cmd, config, cwd);
    case 'node':
    case 'tsx':
    case 'ts-node': return evaluateNodeCommand(cmd, config, cwd);
    case 'perl': return evaluatePerlCommand(cmd, config, cwd);
    case 'ruby': return evaluateRubyCommand(cmd, config, cwd);
    case 'php': return evaluatePhpCommand(cmd, config, cwd);
  }
  return null;
}
