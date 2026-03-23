import { describe, it, expect } from 'vitest';
import { globToRegex, pathGlobToRegex } from '../glob';

describe('globToRegex', () => {
  it('* matches any string', () => {
    const re = globToRegex('staging-*');
    expect(re.test('staging-1')).toBe(true);
    expect(re.test('staging-foo-bar')).toBe(true);
    expect(re.test('production-1')).toBe(false);
  });

  it('? matches single character', () => {
    const re = globToRegex('dev?');
    expect(re.test('dev1')).toBe(true);
    expect(re.test('devA')).toBe(true);
    expect(re.test('dev')).toBe(false);
    expect(re.test('dev12')).toBe(false);
  });

  it('[abc] character class', () => {
    const re = globToRegex('app-[abc]');
    expect(re.test('app-a')).toBe(true);
    expect(re.test('app-c')).toBe(true);
    expect(re.test('app-d')).toBe(false);
  });

  it('[!abc] negated character class', () => {
    const re = globToRegex('app-[!abc]');
    expect(re.test('app-d')).toBe(true);
    expect(re.test('app-a')).toBe(false);
  });

  it('{a,b,c} brace expansion', () => {
    const re = globToRegex('{dev,staging,prod}-server');
    expect(re.test('dev-server')).toBe(true);
    expect(re.test('staging-server')).toBe(true);
    expect(re.test('prod-server')).toBe(true);
    expect(re.test('test-server')).toBe(false);
  });

  it('unmatched { is escaped', () => {
    const re = globToRegex('test{foo');
    expect(re.test('test{foo')).toBe(true);
    expect(re.test('testfoo')).toBe(false);
  });

  it('regex metacharacters are escaped', () => {
    const re = globToRegex('file.txt');
    expect(re.test('file.txt')).toBe(true);
    expect(re.test('fileXtxt')).toBe(false);
  });

  it('anchored with ^...$', () => {
    const re = globToRegex('foo');
    expect(re.test('foo')).toBe(true);
    expect(re.test('foobar')).toBe(false);
    expect(re.test('barfoo')).toBe(false);
  });

  it('* matches across path separators (not path-aware)', () => {
    const re = globToRegex('*.internal.company.com');
    expect(re.test('staging.internal.company.com')).toBe(true);
    expect(re.test('deep.staging.internal.company.com')).toBe(true);
  });

  it('empty string matches only empty string', () => {
    const re = globToRegex('');
    expect(re.test('')).toBe(true);
    expect(re.test('a')).toBe(false);
  });

  it('consecutive *** treated as single *', () => {
    const re = globToRegex('foo***bar');
    expect(re.test('foo-anything-bar')).toBe(true);
    expect(re.test('foobar')).toBe(true);
  });

  it('unclosed [ produces invalid regex and throws', () => {
    expect(() => globToRegex('test[abc')).toThrow();
  });

  it('literal ] outside character class is escaped', () => {
    const re = globToRegex('foo]bar');
    expect(re.test('foo]bar')).toBe(true);
    expect(re.test('foobar')).toBe(false);
  });
});

describe('pathGlobToRegex', () => {
  it('* matches single path segment (no /)', () => {
    const re = new RegExp(`^${pathGlobToRegex('/opt/tools/*/run.sh')}$`);
    expect(re.test('/opt/tools/mytool/run.sh')).toBe(true);
    expect(re.test('/opt/tools/deep/nested/run.sh')).toBe(false);
  });

  it('** matches across path segments', () => {
    const re = new RegExp(`^${pathGlobToRegex('/home/user/.claude/skills/**')}$`);
    expect(re.test('/home/user/.claude/skills/foo/bar/script.sh')).toBe(true);
    expect(re.test('/home/user/.claude/skills/script.sh')).toBe(true);
    expect(re.test('/home/user/.claude/other/script.sh')).toBe(false);
  });

  it('? matches single non-/ character', () => {
    const re = new RegExp(`^${pathGlobToRegex('/tmp/file-?.txt')}$`);
    expect(re.test('/tmp/file-A.txt')).toBe(true);
    expect(re.test('/tmp/file-1.txt')).toBe(true);
    expect(re.test('/tmp/file-.txt')).toBe(false);
    expect(re.test('/tmp/file-AB.txt')).toBe(false);
  });

  it('[abc] character class', () => {
    const re = new RegExp(`^${pathGlobToRegex('/opt/app-[abc]/run')}$`);
    expect(re.test('/opt/app-a/run')).toBe(true);
    expect(re.test('/opt/app-d/run')).toBe(false);
  });

  it('[!abc] negated character class', () => {
    const re = new RegExp(`^${pathGlobToRegex('/opt/app-[!abc]/run')}$`);
    expect(re.test('/opt/app-d/run')).toBe(true);
    expect(re.test('/opt/app-a/run')).toBe(false);
  });

  it('{a,b,c} brace expansion', () => {
    const re = new RegExp(`^${pathGlobToRegex('/opt/{dev,staging}/run.sh')}$`);
    expect(re.test('/opt/dev/run.sh')).toBe(true);
    expect(re.test('/opt/staging/run.sh')).toBe(true);
    expect(re.test('/opt/prod/run.sh')).toBe(false);
  });

  it('regex metacharacters are escaped', () => {
    const re = new RegExp(`^${pathGlobToRegex('/path/to/file.txt')}$`);
    expect(re.test('/path/to/file.txt')).toBe(true);
    expect(re.test('/path/to/fileXtxt')).toBe(false);
  });

  it('empty pattern returns empty string', () => {
    expect(pathGlobToRegex('')).toBe('');
  });

  it('combined * and ** patterns', () => {
    const re = new RegExp(`^${pathGlobToRegex('/opt/*/scripts/**')}$`);
    expect(re.test('/opt/mytool/scripts/deploy.sh')).toBe(true);
    expect(re.test('/opt/mytool/scripts/deep/nested/run.sh')).toBe(true);
    expect(re.test('/opt/a/b/scripts/run.sh')).toBe(false); // * doesn't cross /
  });

  it('? does not match /', () => {
    const re = new RegExp(`^${pathGlobToRegex('/tmp/?')}$`);
    expect(re.test('/tmp/a')).toBe(true);
    expect(re.test('/tmp/')).toBe(false); // ? must match a non-/ char
  });

  it('consecutive *** treated as **', () => {
    const re = new RegExp(`^${pathGlobToRegex('/opt/***/run.sh')}$`);
    expect(re.test('/opt/deep/nested/run.sh')).toBe(true);
    expect(re.test('/opt/x/run.sh')).toBe(true);
  });
});
