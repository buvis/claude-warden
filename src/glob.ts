/**
 * Convert a glob pattern to a regex string (no anchors).
 *
 * `pathAware` controls wildcard semantics:
 * - false (general): `*` matches anything (`.*`), `?` matches one char (`.`).
 *   Used for trusted context name matching.
 * - true (path-aware): `*` matches a single path segment (`[^/]*`), `**` matches
 *   any depth (`.*`), `?` matches one non-slash char (`[^/]`).
 *
 * Both modes support `[...]`, `[!...]`, and `{a,b,c}`.
 */
function globToRegexString(pattern: string, pathAware: boolean): string {
  let result = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pathAware && pattern[i + 1] !== '*') {
        result += '[^/]*';
      } else {
        // Consume all consecutive * chars → match any depth
        while (pattern[i + 1] === '*') i++;
        result += '.*';
      }
    } else if (ch === '?') {
      result += pathAware ? '[^/]' : '.';
    } else if (ch === '[') {
      i++;
      if (i < pattern.length && pattern[i] === '!') {
        result += '[^';
        i++;
      } else {
        result += '[';
      }
      while (i < pattern.length && pattern[i] !== ']') {
        result += pattern[i];
        i++;
      }
      if (i < pattern.length) {
        result += ']';
      }
    } else if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(',').map(s => s.replace(/[.+^$|\\()]/g, '\\$&'));
        result += `(${alternatives.join('|')})`;
        i = end;
      } else {
        result += '\\{';
      }
    } else if ('.+^$|\\()[]'.includes(ch)) {
      result += '\\' + ch;
    } else {
      result += ch;
    }
    i++;
  }
  return result;
}

/**
 * General glob → RegExp. Supports *, ?, [...], [!...], {a,b,c}.
 * Returns a compiled RegExp with ^...$ anchors.
 * Used for trusted context name matching.
 */
export function globToRegex(pattern: string): RegExp {
  return new RegExp(`^${globToRegexString(pattern, false)}$`);
}

/**
 * Path-aware glob → regex string (not compiled).
 * * matches a single path segment ([^/]*), ** matches any depth (.*).
 * Also supports ?, [...], [!...], {a,b,c}.
 * Returns a string - callers wrap in ^...$ anchors.
 */
export function pathGlobToRegex(pattern: string): string {
  return globToRegexString(pattern, true);
}
