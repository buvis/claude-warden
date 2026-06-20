import { wardenEval } from './core';
import { setQuiet, loadConfig } from './rules';
import { readAuditLog, aggregateAsks, parseDurationMs } from './audit-analyze';
import { formatSuggestionReport } from './suggest';
import type { Decision } from './types';

// CLI is interactive — surface config-loading warnings to stderr.
// (rules.ts defaults to quiet mode for hook entry points.)
setQuiet(false);

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: warden eval [options] <command>',
      '       warden suggest [options]',
      '',
      'Evaluate a shell command against Warden safety rules, or',
      'suggest warden.yaml rules from the audit log.',
      '',
      'Commands:',
      '  eval       Evaluate a shell command',
      '  suggest    Suggest rules from audit log',
      '',
      'Options:',
      '  --cwd <dir>   Set working directory for config loading',
      '  --json        Output result as JSON',
      '  -h, --help    Show this help',
      '',
      'Exit codes:',
      '  0 = allow, 1 = ask, 2 = deny',
      '',
      'Examples:',
      '  warden eval "ls -la"',
      '  warden eval --json "git push --force"',
      '  warden eval --cwd /path/to/project "rm -rf dist"',
      '  warden suggest --json --top 5',
      '  warden suggest --since 7d',
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
  } else {
    process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
    printHelp();
    process.exit(1);
  }
}

main();
