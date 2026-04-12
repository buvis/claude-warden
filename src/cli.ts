import { wardenEval } from './core';
import { setQuiet } from './rules';
import type { Decision } from './types';

// CLI is interactive — surface config-loading warnings to stderr.
// (rules.ts defaults to quiet mode for hook entry points.)
setQuiet(false);

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: warden eval [options] <command>',
      '',
      'Evaluate a shell command against Warden safety rules.',
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
      '',
    ].join('\n'),
  );
}

const EXIT_CODES: Record<Decision, number> = { allow: 0, ask: 1, deny: 2 };

function main(): void {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  if (argv[0] !== 'eval') {
    process.stderr.write(`Unknown subcommand: ${argv[0]}\n`);
    printHelp();
    process.exit(1);
  }

  let cwd = process.cwd();
  let json = false;
  let command: string | undefined;

  for (let i = 1; i < argv.length; i++) {
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

main();
