import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * PRD 00017 single-source-of-truth guard.
 *
 * `SHELL_INTERPRETERS` in `src/shells.ts` is the ONLY place a POSIX shell-name
 * list may live. Before this PRD the list was hardcoded in four files and drifted.
 * This guard fails if any non-test source file reintroduces a hardcoded shell
 * array (a fifth copy), which would re-open the drift the PRD closed.
 *
 * Scope (per design): sweep only non-test `src/*.ts`, excluding `src/shells.ts`
 * (the lone allowlisted definition site) and everything under `src/__tests__/`
 * (the parity tests legitimately list dash/ksh/mksh/ash arrays).
 *
 * Match rule: flag a bracket literal that contains 2+ DISTINCT shell names as
 * whole quoted tokens (`'sh'` / `"sh"`). Anchoring on quotes plus the 2-distinct
 * threshold keeps it from tripping on `[...SHELL_INTERPRETERS]` spreads, flag-only
 * sets like `['-b','-c',...]`, or incidental substrings.
 */
const SHELL_NAMES = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'mksh', 'ash'];

/** Bracket literals in `content` that hardcode 2+ distinct quoted shell names. */
function hardcodedShellArrays(content: string): string[] {
  const hits: string[] = [];
  // Each innermost bracket literal (no nesting): [ ... ] with no inner brackets.
  for (const literal of content.match(/\[[^[\]]*\]/g) ?? []) {
    const distinct = SHELL_NAMES.filter(
      (name) => literal.includes(`'${name}'`) || literal.includes(`"${name}"`),
    );
    if (distinct.length >= 2) hits.push(literal.trim());
  }
  return hits;
}

describe('shells single source of truth (guard)', () => {
  it('no source file outside shells.ts hardcodes a shell array', () => {
    const srcDir = join(__dirname, '..'); // src/
    const sources = readdirSync(srcDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'shells.ts')
      .map((e) => join(srcDir, e.name));

    const offenders: string[] = [];
    for (const file of sources) {
      for (const literal of hardcodedShellArrays(readFileSync(file, 'utf8'))) {
        offenders.push(`${file}: ${literal}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  // Prove the detector is live (not a no-op that always passes) and precise.
  it('flags a reintroduced hardcoded shell array', () => {
    expect(hardcodedShellArrays(`const SHELLS = ['sh', 'bash', 'zsh'];`)).not.toEqual([]);
    expect(hardcodedShellArrays(`new Set(["dash", "ksh", "mksh", "ash"])`)).not.toEqual([]);
  });

  it('ignores the spread, flag-only sets, and single shell names', () => {
    expect(hardcodedShellArrays(`new Set([...SHELL_INTERPRETERS])`)).toEqual([]);
    expect(hardcodedShellArrays(`const SSH_FLAGS_WITH_VALUE = new Set(['-b', '-c', '-i']);`)).toEqual([]);
    expect(hardcodedShellArrays(`if (cmd === 'sh' || cmd === 'ssh') {}`)).toEqual([]);
  });
});
