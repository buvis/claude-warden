/**
 * General glob → RegExp. Supports *, ?, [...], [!...], {a,b,c}.
 * Returns a compiled RegExp with ^...$ anchors.
 * Used for trusted context name matching.
 */
export function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      regex += '.*';
    } else if (ch === '?') {
      regex += '.';
    } else if (ch === '[') {
      i++;
      if (i < pattern.length && pattern[i] === '!') {
        regex += '[^';
        i++;
      } else {
        regex += '[';
      }
      while (i < pattern.length && pattern[i] !== ']') {
        regex += pattern[i];
        i++;
      }
      if (i < pattern.length) {
        regex += ']';
      }
    } else if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(',').map(s => s.replace(/[.+^$|\\()]/g, '\\$&'));
        regex += `(${alternatives.join('|')})`;
        i = end;
      } else {
        regex += '\\{';
      }
    } else if ('.+^$|\\()'.includes(ch)) {
      regex += '\\' + ch;
    } else {
      regex += ch;
    }
    i++;
  }
  return new RegExp(`^${regex}$`);
}

/**
 * Path-aware glob → regex string (not compiled).
 * * matches a single path segment ([^/]*), ** matches any depth (.*).
 * Also supports ?, [...], [!...], {a,b,c}.
 * Returns a string — callers wrap in ^...$ anchors.
 */
export function pathGlobToRegex(pattern: string): string {
  let result = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      result += '.*';
      i++; // skip second *
    } else if (ch === '*') {
      result += '[^/]*';
    } else if (ch === '?') {
      result += '[^/]';
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
