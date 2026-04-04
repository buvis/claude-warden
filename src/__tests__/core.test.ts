import { describe, it, expect } from 'vitest';
import { wardenEvalWithConfig } from '../core';
import { DEFAULT_CONFIG } from '../defaults';

describe('wardenEvalWithConfig', () => {
  it('allows safe commands', () => {
    const result = wardenEvalWithConfig('ls -la', DEFAULT_CONFIG);
    expect(result.decision).toBe('allow');
  });

  it('denies dangerous commands', () => {
    const result = wardenEvalWithConfig('sudo rm -rf /', DEFAULT_CONFIG);
    expect(result.decision).toBe('deny');
  });

  it('handles pipelines', () => {
    const result = wardenEvalWithConfig('cat file | grep pattern | wc -l', DEFAULT_CONFIG);
    expect(result.decision).toBe('allow');
  });

  it('returns details for each command in pipeline', () => {
    const result = wardenEvalWithConfig('ls | grep foo', DEFAULT_CONFIG);
    expect(result.details.length).toBe(2);
  });

  it('accepts cwd parameter', () => {
    const result = wardenEvalWithConfig('ls', DEFAULT_CONFIG, '/tmp');
    expect(result.decision).toBe('allow');
  });

  it('returns reason string', () => {
    const result = wardenEvalWithConfig('ls', DEFAULT_CONFIG);
    expect(result.reason).toBeTruthy();
  });
});
