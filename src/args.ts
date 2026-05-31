import type { ParsedCommand } from './types';

/** Build a bare ParsedCommand from a command name + args (no env/path metadata). */
export function makeCommand(command: string, args: string[]): ParsedCommand {
  return {
    command,
    originalCommand: command,
    args,
    envPrefixes: [],
    raw: [command, ...args].join(' '),
  };
}

export interface FlagWalkSpec {
  /** Flags that consume the following token as their value. */
  withValue: Set<string>;
  /** Known boolean flags (no value). Only consulted when `strictUnknown` is set. */
  noValue?: Set<string>;
  /** When true, bail (unresolved) on a flag not in `withValue`/`noValue`. */
  strictUnknown?: boolean;
}

export interface FlagWalkResult {
  /** Index of the first positional argument (or args.length if none). */
  index: number;
  /** True when an unknown flag prevented safe resolution (`strictUnknown` only). */
  unresolved: boolean;
}

/**
 * Walk leading flags and return the index of the first positional argument.
 * Handles `--flag=value`, value-consuming flags, and `--` terminators.
 * Shared by the package-runner evaluators (uv, npx/bunx/pnpx).
 */
export function skipLeadingFlags(args: string[], spec: FlagWalkSpec): FlagWalkResult {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--') {
      return { index: i + 1, unresolved: false };
    }
    if (!arg.startsWith('-') || arg === '-') {
      break;
    }

    // --flag=value form
    if (arg.startsWith('--') && arg.includes('=')) {
      const flag = arg.slice(0, arg.indexOf('='));
      if (spec.withValue.has(flag) || spec.noValue?.has(flag)) {
        i++;
        continue;
      }
      if (spec.strictUnknown) return { index: i, unresolved: true };
      i++;
      continue;
    }

    if (spec.withValue.has(arg)) {
      if (i + 1 >= args.length) return { index: i, unresolved: true };
      i += 2;
      continue;
    }

    if (spec.noValue?.has(arg) || !spec.strictUnknown) {
      i++;
      continue;
    }

    return { index: i, unresolved: true };
  }
  return { index: i, unresolved: false };
}
