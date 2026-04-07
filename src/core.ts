import { parseCommand } from './parser';
import { evaluate } from './evaluator';
import { loadConfig } from './rules';
import type { WardenConfig, EvalResult } from './types';

/** Evaluate a shell command against Warden rules, loading config automatically. */
export function wardenEval(command: string, options?: { cwd?: string }): EvalResult {
  const config = loadConfig(options?.cwd);
  return wardenEvalWithConfig(command, config, options?.cwd);
}

/** Evaluate a shell command against Warden rules with a pre-loaded config. */
export function wardenEvalWithConfig(command: string, config: WardenConfig, cwd?: string): EvalResult {
  const parsed = parseCommand(command);
  return evaluate(parsed, config, cwd);
}
