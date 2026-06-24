import { describe, it, expect } from 'vitest';
import { DANGEROUS_EXEC_ENV, matchesDangerousEnv, DANGEROUS_EXEC_ENV_PATTERN } from '../env-danger';

describe('DANGEROUS_EXEC_ENV', () => {
  it('contains LD_PRELOAD (library-injection family)', () => {
    expect(DANGEROUS_EXEC_ENV.has('LD_PRELOAD')).toBe(true);
  });

  it('contains GIT_PAGER (git-exec family)', () => {
    expect(DANGEROUS_EXEC_ENV.has('GIT_PAGER')).toBe(true);
  });

  it('contains BASH_ENV (shell-init family)', () => {
    expect(DANGEROUS_EXEC_ENV.has('BASH_ENV')).toBe(true);
  });

  it('contains exactly 16 names', () => {
    expect(DANGEROUS_EXEC_ENV.size).toBe(16);
  });

  it('contains all 16 required names', () => {
    const required = [
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
    ];
    for (const name of required) {
      expect(DANGEROUS_EXEC_ENV.has(name), `expected set to contain ${name}`).toBe(true);
    }
  });
});

describe('matchesDangerousEnv', () => {
  it('returns var name for GIT_PAGER=x', () => {
    expect(matchesDangerousEnv('GIT_PAGER=x')).toBe('GIT_PAGER');
  });

  it('returns var name for LD_PRELOAD=/a/b', () => {
    expect(matchesDangerousEnv('LD_PRELOAD=/a/b')).toBe('LD_PRELOAD');
  });

  it('returns var name when value contains = (splits on first = only)', () => {
    expect(matchesDangerousEnv('GIT_SSH_COMMAND=ssh -o X=Y')).toBe('GIT_SSH_COMMAND');
  });

  it('returns null for safe var NODE_ENV=production', () => {
    expect(matchesDangerousEnv('NODE_ENV=production')).toBeNull();
  });

  it('returns null for ENVISIONED=x — ENV prefix must not match longer name', () => {
    expect(matchesDangerousEnv('ENVISIONED=x')).toBeNull();
  });

  it('returns null for bare word with no = sign', () => {
    expect(matchesDangerousEnv('git')).toBeNull();
  });

  it('returns var name for BASH_ENV=/tmp/x', () => {
    expect(matchesDangerousEnv('BASH_ENV=/tmp/x')).toBe('BASH_ENV');
  });

  it('returns var name for GIT_EDITOR=vim', () => {
    expect(matchesDangerousEnv('GIT_EDITOR=vim')).toBe('GIT_EDITOR');
  });

  it('returns var name for PAGER=less', () => {
    expect(matchesDangerousEnv('PAGER=less')).toBe('PAGER');
  });

  it('returns var name for ENV= (empty value)', () => {
    expect(matchesDangerousEnv('ENV=')).toBe('ENV');
  });

  it('returns null for token that is only =', () => {
    expect(matchesDangerousEnv('=')).toBeNull();
  });
});

describe('DANGEROUS_EXEC_ENV_PATTERN', () => {
  it('matches GIT_PAGER=cat', () => {
    const re = new RegExp(DANGEROUS_EXEC_ENV_PATTERN);
    expect(re.test('GIT_PAGER=cat')).toBe(true);
  });

  it('matches LD_PRELOAD=x', () => {
    const re = new RegExp(DANGEROUS_EXEC_ENV_PATTERN);
    expect(re.test('LD_PRELOAD=x')).toBe(true);
  });

  it('does not match NODE_ENV=x', () => {
    const re = new RegExp(DANGEROUS_EXEC_ENV_PATTERN);
    expect(re.test('NODE_ENV=x')).toBe(false);
  });

  it('does not match ENVISIONED=x — ENV prefix must be bounded by =', () => {
    const re = new RegExp(DANGEROUS_EXEC_ENV_PATTERN);
    expect(re.test('ENVISIONED=x')).toBe(false);
  });

  it('pattern requires = immediately after the var name', () => {
    const re = new RegExp(DANGEROUS_EXEC_ENV_PATTERN);
    expect(re.test('PAGER')).toBe(false);
  });
});
