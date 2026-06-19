import { describe, it, expect } from 'vitest';
import { parseCommand } from '../parser';
import { evaluate } from '../evaluator';
import { DEFAULT_CONFIG } from '../defaults';
import type { ParseResult } from '../types';
import { SHELL_CORPUS, SENTINEL } from './fixtures/shell-corpus';

function commandsCarrySentinel(parsed: ParseResult): boolean {
  return parsed.commands.some(
    c => c.raw.includes(SENTINEL) || c.originalCommand.includes(SENTINEL),
  );
}

function subshellsCarrySentinel(parsed: ParseResult): boolean {
  return parsed.subshellCommands.some(s => s.includes(SENTINEL));
}

/** The parser-layer safety property: the planted sentinel is never silently dropped. */
function surfacedSomehow(parsed: ParseResult): boolean {
  return (
    commandsCarrySentinel(parsed) ||
    subshellsCarrySentinel(parsed) ||
    parsed.hasSubshell ||
    parsed.incomplete === true
  );
}

describe('parser completeness: construct corpus', () => {
  for (const entry of SHELL_CORPUS) {
    describe(entry.name, () => {
      it('surfaces the planted sentinel (never silently dropped)', () => {
        expect(surfacedSomehow(parseCommand(entry.snippet))).toBe(true);
      });

      it(`surfaces the sentinel via "${entry.surface}"`, () => {
        const parsed = parseCommand(entry.snippet);
        switch (entry.surface) {
          case 'command':
            expect(commandsCarrySentinel(parsed)).toBe(true);
            break;
          case 'subshell':
            expect(subshellsCarrySentinel(parsed)).toBe(true);
            break;
          case 'flag':
            expect(parsed.hasSubshell || parsed.incomplete === true).toBe(true);
            break;
        }
      });

      it('never evaluates the planted sentinel to allow', () => {
        const decision = evaluate(parseCommand(entry.snippet), DEFAULT_CONFIG).decision;
        expect(decision).not.toBe('allow');
      });
    });
  }
});
