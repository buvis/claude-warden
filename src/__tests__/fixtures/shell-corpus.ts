// Construct corpus for parser-completeness testing.
//
// Each entry plants a dangerous sentinel command inside a specific shell
// construct. The contract Warden must uphold is: the sentinel is never
// silently allowed. It surfaces through one of three mechanisms, recorded
// per entry so a regression that changes the mechanism is visible:
//
//   'command'  - extracted into parsed.commands (handled construct bodies)
//   'subshell' - extracted into parsed.subshellCommands (command substitution / backticks)
//   'flag'     - surfaced only via parsed.hasSubshell or parsed.incomplete
//                (process substitution; or an unhandled node that fails loud)
//
// The sentinel target string lets tests recognize the planted command after
// the parser normalizes the command path to its basename.

export const SENTINEL = '/SENTINEL';
export const SENTINEL_CMD = `rm -rf ${SENTINEL}`;

export type SurfaceKind = 'command' | 'subshell' | 'flag';

export interface CorpusEntry {
  /** Human-readable construct name (also the test label). */
  name: string;
  /** Shell snippet with the sentinel planted inside the construct. */
  snippet: string;
  /** How the planted sentinel must surface so it cannot be silently allowed. */
  surface: SurfaceKind;
}

export const SHELL_CORPUS: CorpusEntry[] = [
  {
    name: 'for loop body (guards the 478829c recursion fix)',
    snippet: `for f in *; do ${SENTINEL_CMD}; done`,
    surface: 'command',
  },
  {
    name: 'while loop body',
    snippet: `while true; do ${SENTINEL_CMD}; done`,
    surface: 'command',
  },
  {
    name: 'if branch',
    snippet: `if true; then ${SENTINEL_CMD}; fi`,
    surface: 'command',
  },
  {
    name: 'case branch',
    snippet: `case x in x) ${SENTINEL_CMD};; esac`,
    surface: 'command',
  },
  {
    name: 'function body',
    snippet: `cleanup() { ${SENTINEL_CMD}; }`,
    surface: 'command',
  },
  {
    name: 'subshell group',
    snippet: `( ${SENTINEL_CMD} )`,
    surface: 'command',
  },
  {
    name: 'brace group',
    snippet: `{ ${SENTINEL_CMD}; }`,
    surface: 'command',
  },
  {
    name: 'select body',
    snippet: `select x in a b; do ${SENTINEL_CMD}; done`,
    surface: 'command',
  },
  {
    name: 'coproc body',
    snippet: `coproc { ${SENTINEL_CMD}; }`,
    surface: 'command',
  },
  {
    name: 'arithmetic for body',
    snippet: `for ((i=0; i<1; i++)); do ${SENTINEL_CMD}; done`,
    surface: 'command',
  },
  {
    name: 'and-or chain',
    snippet: `true && ${SENTINEL_CMD}`,
    surface: 'command',
  },
  {
    name: 'pipeline',
    snippet: `echo x | ${SENTINEL_CMD}`,
    surface: 'command',
  },
  {
    name: 'nested sh -c',
    snippet: `sh -c "${SENTINEL_CMD}"`,
    surface: 'command',
  },
  {
    name: 'command substitution',
    snippet: `echo $(${SENTINEL_CMD})`,
    surface: 'subshell',
  },
  {
    name: 'backtick substitution',
    snippet: `echo \`${SENTINEL_CMD}\``,
    surface: 'subshell',
  },
  {
    name: 'process substitution',
    snippet: `cat <(${SENTINEL_CMD})`,
    surface: 'flag',
  },
];
