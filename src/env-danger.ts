/**
 * Dangerous environment variable names that trigger arbitrary code execution.
 */
export const DANGEROUS_EXEC_ENV: ReadonlySet<string> = new Set([
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'DYLD_FRAMEWORK_PATH',
  'PAGER',
  'GIT_PAGER',
  'GIT_EXTERNAL_DIFF',
  'GIT_SEQUENCE_EDITOR',
  'GIT_EDITOR',
  'GIT_SSH_COMMAND',
  'BASH_ENV',
  'ENV',
  'PROMPT_COMMAND',
  'PERL5OPT',
  'PYTHONSTARTUP',
]);

/**
 * If `token` is `NAME=value` where `NAME` is a dangerous env var, return `NAME`.
 * Splits on the first `=` only; returns `null` otherwise.
 */
export function matchesDangerousEnv(token: string): string | null {
  const idx = token.indexOf('=');
  if (idx === -1) return null;
  const name = token.slice(0, idx);
  return DANGEROUS_EXEC_ENV.has(name) ? name : null;
}

/**
 * Regex source that matches a dangerous env-var prefix at the start of a string.
 * Built from `DANGEROUS_EXEC_ENV` so it stays in sync.
 */
export const DANGEROUS_EXEC_ENV_PATTERN: string = `^(${[...DANGEROUS_EXEC_ENV].join('|')})=`;
