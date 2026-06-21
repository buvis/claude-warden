import { wardenEval } from './core';
import { setQuiet, loadConfig } from './rules';
import { readAuditLog, aggregateAsks, parseDurationMs } from './audit-analyze';
import { formatSuggestionReport } from './suggest';
import { runDiagnostics } from './diagnose';
import type { CheckResult } from './diagnose';
import type { Decision } from './types';

// CLI is interactive — surface config-loading warnings to stderr.
// (rules.ts defaults to quiet mode for hook entry points.)
setQuiet(false);

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: warden eval [options] <command>',
      '       warden suggest [options]',
      '       warden validate [options]',
      '       warden diagnose [options]',
      '       warden doctor [options]',
      '',
      'Evaluate a shell command against Warden safety rules, suggest',
      'warden.yaml rules from the audit log, validate config files,',
      'or run a diagnostics health-check.',
      '',
      'Commands:',
      '  eval       Evaluate a shell command',
      '  suggest    Suggest rules from audit log',
      '  validate   Validate warden.yaml config files',
      '  diagnose   Run diagnostics health-check',
      '  doctor     Alias for diagnose',
      '',
      'Options:',
      '  --cwd <dir>   Set working directory for config loading',
      '  --json        Output result as JSON',
      '  -h, --help    Show this help',
      '',
      'Exit codes:',
      '  eval/suggest: 0 = allow, 1 = ask, 2 = deny',
      '  validate:     0 = no warnings, 1 = warnings found',
      '  diagnose:     0 = all checks pass, 1 = fail/unknown found',
      '',
      'Examples:',
      '  warden eval "ls -la"',
      '  warden eval --json "git push --force"',
      '  warden eval --cwd /path/to/project "rm -rf dist"',
      '  warden suggest --json --top 5',
      '  warden suggest --since 7d',
      '  warden validate',
      '  warden validate --json',
      '  warden diagnose',
      '  warden diagnose --json',
      '',
    ].join('\n'),
  );
}

const EXIT_CODES: Record<Decision, number> = { allow: 0, ask: 1, deny: 2 };

function runEval(argv: string[]): void {
  let cwd = process.cwd();
  let json = false;
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cwd' && argv[i + 1]) {
      cwd = argv[i + 1];
      i++;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (!command) {
      command = arg;
    }
  }

  if (!command) {
    process.stderr.write('Error: no command provided\n');
    printHelp();
    process.exit(1);
  }

  const result = wardenEval(command, { cwd });

  if (json) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    process.stdout.write(`${result.decision}: ${result.reason}\n`);
  }

  process.exit(EXIT_CODES[result.decision]);
}

function parseValidateArgs(argv: string[]): { cwd: string; json: boolean } {
  let cwd = process.cwd();
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cwd' && argv[i + 1]) {
      cwd = argv[i + 1];
      i++;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return { cwd, json };
}

function printWarningReport(warnings: NonNullable<ReturnType<typeof loadConfig>['warnings']>): void {
  const byFile = new Map<string, typeof warnings>();
  for (const w of warnings) {
    const arr = byFile.get(w.file);
    if (arr) {
      arr.push(w);
    } else {
      byFile.set(w.file, [w]);
    }
  }
  for (const [file, fileWarnings] of byFile) {
    process.stdout.write(file + '\n');
    for (const w of fileWarnings) {
      const line = `  ${w.path}: ${w.message}`;
      const suggestionLine = w.suggestion ? ` (did you mean "${w.suggestion}")` : '';
      process.stdout.write(line + suggestionLine + '\n');
    }
  }
  if (warnings.length === 0) {
    process.stdout.write('ok — no config problems\n');
  } else {
    process.stdout.write(`${warnings.length} warning(s) found\n`);
  }
}

function runValidate(argv: string[]): void {
  setQuiet(true);

  const { cwd, json } = parseValidateArgs(argv);
  const config = loadConfig(cwd);
  const warnings = config.warnings ?? [];

  if (json) {
    process.stdout.write(JSON.stringify(warnings) + '\n');
  } else {
    printWarningReport(warnings);
  }

  process.exit(warnings.length > 0 ? 1 : 0);
}

function parseDiagnoseArgs(argv: string[]): { cwd: string; json: boolean } {
  let cwd = process.cwd();
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cwd' && argv[i + 1]) {
      cwd = argv[i + 1];
      i++;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return { cwd, json };
}

function printDiagnoseReport(checks: CheckResult[]): void {
  const symbolMap: Record<string, string> = {
    pass: '✓',
    fail: '✗',
    warn: '⚠',
    info: 'ℹ',
    skip: '–',
    unknown: '?',
  };

  for (const check of checks) {
    const symbol = symbolMap[check.status] ?? '?';
    process.stdout.write(`${symbol} ${check.id}: ${check.detail}\n`);
    if ((check.status === 'fail' || check.status === 'warn' || check.status === 'unknown') && check.fix) {
      process.stdout.write(`  → fix: ${check.fix}\n`);
    }
  }

  const problems = checks.filter(c => c.status === 'fail' || c.status === 'warn' || c.status === 'unknown').length;
  process.stdout.write(`${checks.length} check(s), ${problems} problem(s)\n`);
}

function runDiagnose(argv: string[]): void {
  setQuiet(true);

  const { cwd, json } = parseDiagnoseArgs(argv);
  const checks = runDiagnostics({ cwd });

  if (json) {
    process.stdout.write(JSON.stringify({ checks }) + '\n');
  } else {
    printDiagnoseReport(checks);
  }

  process.exit(checks.some(c => c.status === 'fail' || c.status === 'unknown') ? 1 : 0);
}

function runSuggest(argv: string[]): void {
  let cwd = process.cwd();
  let json = false;
  let top: number | undefined;
  let since: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cwd' && argv[i + 1]) {
      cwd = argv[i + 1];
      i++;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--top' && argv[i + 1]) {
      const raw = argv[i + 1];
      const parsed = parseInt(raw, 10);
      if (!/^\d+$/.test(raw) || parsed <= 0) {
        process.stderr.write('Error: invalid --top value\n');
        process.exit(1);
      }
      top = parsed;
      i++;
    } else if (arg === '--since' && argv[i + 1]) {
      since = argv[i + 1];
      i++;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  let sinceMs: number | undefined;
  if (since !== undefined) {
    const parsed = parseDurationMs(since);
    if (parsed === null) {
      process.stderr.write('Error: invalid --since value\n');
      process.exit(1);
    }
    sinceMs = parsed;
  }

  const config = loadConfig(cwd);
  const entries = readAuditLog(config.auditPath, { sinceMs });
  const groups = aggregateAsks(entries);
  const out = formatSuggestionReport(groups, { top, json });
  process.stdout.write(out + (out.endsWith('\n') ? '' : '\n'));
  process.exit(0);
}

function main(): void {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  const subcommand = argv[0];
  const rest = argv.slice(1);

  if (subcommand === 'eval') {
    runEval(rest);
  } else if (subcommand === 'suggest') {
    runSuggest(rest);
  } else if (subcommand === 'validate') {
    runValidate(rest);
  } else if (subcommand === 'diagnose' || subcommand === 'doctor') {
    runDiagnose(rest);
  } else {
    process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
    printHelp();
    process.exit(1);
  }
}

main();
