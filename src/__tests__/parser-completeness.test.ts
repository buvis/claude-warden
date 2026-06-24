import { describe, it, expect } from 'vitest';
import { parseCommand } from '../parser';
import { evaluate } from '../evaluator';
import { DEFAULT_CONFIG } from '../defaults';
import type { ParseResult } from '../types';
import { SHELL_CORPUS, SENTINEL, SENTINEL_CMD } from './fixtures/shell-corpus';

function commandsCarrySentinel(parsed: ParseResult): boolean {
  return parsed.commands.some(
    c => c.raw.includes(SENTINEL) || c.originalCommand.includes(SENTINEL),
  );
}

function subshellsCarrySentinel(parsed: ParseResult): boolean {
  // Require the full sentinel COMMAND (`rm -rf /SENTINEL`), not just the target
  // path. A parser bug that surfaces only the redirect/word target (`/SENTINEL`)
  // instead of the whole substitution body would pass a bare-`SENTINEL` check.
  return parsed.subshellCommands.some(s => s.includes(SENTINEL_CMD));
}

/** The parser-layer safety property: the planted sentinel is never silently dropped. */
function surfacedSomehow(parsed: ParseResult): boolean {
  return (
    commandsCarrySentinel(parsed) ||
    subshellsCarrySentinel(parsed) ||
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

describe('process substitution body is caught regardless of askOnSubshell', () => {
  it('never evaluates a process-sub body sentinel to allow when askOnSubshell is false', () => {
    const decision = evaluate(parseCommand('cat <(rm -rf /SENTINEL)'), {
      ...DEFAULT_CONFIG,
      askOnSubshell: false,
    }).decision;
    expect(decision).not.toBe('allow');
  });
});

// Deterministic sentinel fuzz harness.
//
// Wrap the sentinel in random nestings of recursive constructs, with a fixed
// seed so the generated set is identical on every run (CI-stable, no flake).
// The safety property mirrors the corpus: every generated snippet must surface
// the sentinel in parsed.commands OR set parsed.incomplete - never silently drop.

/** mulberry32: a tiny deterministic PRNG, no dependency. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Constructs that recurse into a body, each wrapping an arbitrary inner snippet. */
const NESTERS: ((inner: string) => string)[] = [
  inner => `for f in *; do ${inner}; done`,
  inner => `while true; do ${inner}; done`,
  inner => `if true; then ${inner}; fi`,
  inner => `case x in x) ${inner};; esac`,
  inner => `fn() { ${inner}; }`,
  inner => `( ${inner} )`,
  inner => `{ ${inner}; }`,
  inner => `for ((i=0; i<1; i++)); do ${inner}; done`,
  inner => `cat < <(${inner})`,
  inner => `x=$(${inner}); echo done`,
  inner => `echo \${y:-$(${inner})}`,
  inner => `cat <(${inner})`,
];

describe('parser completeness: sentinel fuzz harness', () => {
  const SEED = 0x1234_5678;
  const ITERATIONS = 200;
  const MAX_DEPTH = 5;

  it('surfaces the sentinel for every randomly nested construct', () => {
    const rand = mulberry32(SEED);
    const failures: string[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const depth = 1 + Math.floor(rand() * MAX_DEPTH);
      let snippet = SENTINEL_CMD;
      for (let d = 0; d < depth; d++) {
        snippet = NESTERS[Math.floor(rand() * NESTERS.length)](snippet);
      }
      const parsed = parseCommand(snippet);
      const surfaced =
        commandsCarrySentinel(parsed) ||
        subshellsCarrySentinel(parsed) ||
        parsed.incomplete === true;
      if (!surfaced) failures.push(snippet);
    }
    expect(failures).toEqual([]);
  });
});

describe('parser completeness: benign word-position expansions stay allow', () => {
  it('keeps a benign parameter expansion allow', () => {
    expect(evaluate(parseCommand('echo "${HOME}"'), DEFAULT_CONFIG).decision).toBe('allow');
  });

  it('keeps a redirect from a literal file allow', () => {
    expect(evaluate(parseCommand('cat < file'), DEFAULT_CONFIG).decision).toBe('allow');
  });

  it('keeps the chain-local mktemp rm-cleanup idiom allow', () => {
    expect(
      evaluate(parseCommand('TMPDIR=$(mktemp -d) && rm -rf $TMPDIR'), DEFAULT_CONFIG).decision,
    ).toBe('allow');
  });
});
