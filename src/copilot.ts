import { wardenEval } from './core';
import { readStdin } from './stdin';
import type { Decision } from './types';

interface CopilotHookInput {
  timestamp: number;
  cwd: string;
  toolName: string;
  toolArgs: string;
}

const MAX_STDIN_SIZE = 1024 * 1024; // 1MB

function output(decision: Decision, reason: string): void {
  const result = {
    permissionDecision: decision,
    permissionDecisionReason: reason,
  };
  process.stdout.write(JSON.stringify(result));
}

async function main() {
  const stdin = await readStdin(MAX_STDIN_SIZE);
  if ('tooLarge' in stdin) {
    output('ask', '[warden] Input exceeds size limit');
    process.exit(0);
  }
  const raw = stdin.data;

  let input: CopilotHookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  if (input.toolName !== 'bash') {
    process.exit(0);
  }

  let command: string | undefined;
  try {
    const args = JSON.parse(input.toolArgs);
    command = args.command;
  } catch {
    process.exit(0);
  }

  if (!command || typeof command !== 'string') {
    process.exit(0);
  }

  const result = wardenEval(command, { cwd: input.cwd });

  output(result.decision, `[warden] ${result.reason}`);
  process.exit(0);
}

main().catch(() => process.exit(0));
