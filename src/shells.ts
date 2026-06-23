/**
 * POSIX-family shells with identical `-c "<command>"` and `<script>` semantics.
 * Single source of truth: every `-c`/script recursion gate imports this set.
 * Out of scope (different invocation semantics): fish, rc, busybox sh applet.
 */
export const SHELL_INTERPRETERS: ReadonlySet<string> = new Set([
  'sh',
  'bash',
  'zsh',
  'dash',
  'ksh',
  'mksh',
  'ash',
]);
