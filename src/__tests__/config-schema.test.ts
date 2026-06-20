import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => '/tmp/warden-cfgschema-home' };
});

import {
  editDistance, nearestKey,
  KNOWN_COMMAND_RULE_KEYS, KNOWN_ARG_PATTERN_KEYS, KNOWN_MATCH_CONDITION_KEYS,
  KNOWN_LAYER_KEYS, KNOWN_TRUSTED_REMOTE_KEYS, KNOWN_TRUSTED_TARGET_KEYS,
  KNOWN_TARGET_POLICY_BASE_KEYS, KNOWN_PATH_POLICY_KEYS, KNOWN_DATABASE_POLICY_KEYS,
  KNOWN_ENDPOINT_POLICY_KEYS, LEGACY_TOP_LEVEL_KEYS, KNOWN_TOP_LEVEL_KEYS,
  WARDEN_CONFIG_FIELD_ORIGIN,
} from '../config-schema';
import { loadConfig, setQuiet } from '../rules';
import type { ConfigWarning } from '../types';

// Compare a ReadonlySet<string> to an expected list, order-independent.
function expectSetEquals(set: ReadonlySet<string>, expected: string[]) {
  expect([...set].sort()).toEqual([...expected].sort());
}

describe('editDistance', () => {
  it('identical strings have distance 0', () => {
    expect(editDistance('context', 'context')).toBe(0);
  });

  it('substitution: editDistance("cat", "cot") === 1', () => {
    expect(editDistance('cat', 'cot')).toBe(1);
  });

  it('deletion: editDistance("cat", "ct") === 1', () => {
    expect(editDistance('cat', 'ct')).toBe(1);
  });

  it('insertion: editDistance("cat", "cart") === 1', () => {
    expect(editDistance('cat', 'cart')).toBe(1);
  });

  it('empty string distances', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });

  it('symmetry: editDistance("kitten", "sitting") === 3', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('sitting', 'kitten')).toBe(3);
  });
});

describe('nearestKey', () => {
  it('suggests alwaysAllow for alwaysAlow', () => {
    expect(nearestKey('alwaysAlow', KNOWN_TOP_LEVEL_KEYS)).toBe('alwaysAllow');
  });

  it('suggests default for defualt', () => {
    expect(nearestKey('defualt', KNOWN_COMMAND_RULE_KEYS)).toBe('default');
  });

  it('suggests context for contxt', () => {
    expect(nearestKey('contxt', KNOWN_TRUSTED_REMOTE_KEYS)).toBe('context');
  });

  it('beyond threshold returns undefined', () => {
    expect(nearestKey('zzzzzzzzzz', KNOWN_LAYER_KEYS)).toBeUndefined();
  });

  it('deterministic lexicographic tie-break regardless of insertion order', () => {
    expect(nearestKey('aa', ['ab', 'ba'])).toBe('ab');
    expect(nearestKey('aa', ['ba', 'ab'])).toBe('ab');
  });

  it('respects maxDistance', () => {
    expect(nearestKey('ab', ['abcd'], 2)).toBe('abcd');
    expect(nearestKey('ab', ['abcd'], 1)).toBeUndefined();
  });
});

describe('known-key tables mirror the types.ts interfaces (guard)', () => {
  it('KNOWN_COMMAND_RULE_KEYS', () => {
    expectSetEquals(KNOWN_COMMAND_RULE_KEYS, [
      'command', 'default', 'argPatterns', 'override',
    ]);
  });

  it('KNOWN_ARG_PATTERN_KEYS', () => {
    expectSetEquals(KNOWN_ARG_PATTERN_KEYS, [
      'description', 'decision', 'reason', 'match',
    ]);
  });

  it('KNOWN_MATCH_CONDITION_KEYS', () => {
    expectSetEquals(KNOWN_MATCH_CONDITION_KEYS, [
      'argsMatch', 'anyArgMatches', 'noArgs', 'argCount', 'not',
    ]);
  });

  it('KNOWN_LAYER_KEYS', () => {
    expectSetEquals(KNOWN_LAYER_KEYS, [
      'alwaysAllow', 'alwaysDeny', 'rules',
    ]);
  });

  it('KNOWN_TRUSTED_REMOTE_KEYS', () => {
    expectSetEquals(KNOWN_TRUSTED_REMOTE_KEYS, [
      'name', 'context', 'allowAll', 'overrides',
    ]);
  });

  it('KNOWN_TRUSTED_TARGET_KEYS', () => {
    expectSetEquals(KNOWN_TRUSTED_TARGET_KEYS, [
      'name', 'allowAll', 'overrides',
    ]);
  });

  it('KNOWN_TARGET_POLICY_BASE_KEYS', () => {
    expectSetEquals(KNOWN_TARGET_POLICY_BASE_KEYS, [
      'type', 'decision', 'reason', 'commands', 'allowAll',
    ]);
  });

  it('KNOWN_PATH_POLICY_KEYS', () => {
    expectSetEquals(KNOWN_PATH_POLICY_KEYS, [
      'type', 'path', 'recursive', 'decision', 'reason', 'commands', 'allowAll',
    ]);
  });

  it('KNOWN_DATABASE_POLICY_KEYS', () => {
    expectSetEquals(KNOWN_DATABASE_POLICY_KEYS, [
      'type', 'host', 'port', 'database', 'decision', 'reason', 'commands', 'allowAll',
    ]);
  });

  it('KNOWN_ENDPOINT_POLICY_KEYS', () => {
    expectSetEquals(KNOWN_ENDPOINT_POLICY_KEYS, [
      'type', 'pattern', 'decision', 'reason', 'commands', 'allowAll',
    ]);
  });

  it('LEGACY_TOP_LEVEL_KEYS', () => {
    expectSetEquals(LEGACY_TOP_LEVEL_KEYS, [
      'trustedSSHHosts', 'trustedDockerContainers', 'trustedKubectlContexts',
      'trustedSprites', 'trustedFlyApps',
    ]);
  });
});

describe('WARDEN_CONFIG_FIELD_ORIGIN classifies every WardenConfig field', () => {
  it('matches the exact classification object', () => {
    expect(WARDEN_CONFIG_FIELD_ORIGIN).toEqual({
      layers: 'layer',
      warnings: 'runtime',
      trustedRemotes: 'raw',
      targetPolicies: 'raw',
      trustedContextOverrides: 'raw',
      defaultDecision: 'raw',
      askOnSubshell: 'raw',
      notifyOnAsk: 'raw',
      notifyOnDeny: 'raw',
      audit: 'raw',
      auditPath: 'raw',
      auditAllowDecisions: 'raw',
      sessionGuidance: 'raw',
      tempScriptDir: 'raw',
    });
  });
});

describe('KNOWN_TOP_LEVEL_KEYS is the union of layer + raw + legacy keys', () => {
  it('re-derived union equals KNOWN_TOP_LEVEL_KEYS', () => {
    const rawKeys = Object.entries(WARDEN_CONFIG_FIELD_ORIGIN)
      .filter(([, origin]) => origin === 'raw')
      .map(([k]) => k);
    const expected = new Set([...KNOWN_LAYER_KEYS, ...rawKeys, ...LEGACY_TOP_LEVEL_KEYS]);
    expectSetEquals(KNOWN_TOP_LEVEL_KEYS, [...expected]);
  });

  it('matches the concrete full list', () => {
    expectSetEquals(KNOWN_TOP_LEVEL_KEYS, [
      'alwaysAllow', 'alwaysDeny', 'rules', 'trustedRemotes', 'targetPolicies',
      'trustedContextOverrides', 'defaultDecision', 'askOnSubshell', 'notifyOnAsk',
      'notifyOnDeny', 'audit', 'auditPath', 'auditAllowDecisions', 'sessionGuidance',
      'tempScriptDir', 'trustedSSHHosts', 'trustedDockerContainers',
      'trustedKubectlContexts', 'trustedSprites', 'trustedFlyApps',
    ]);
  });
});

describe('all-raw-fields round-trip', () => {
  beforeEach(() => setQuiet(true));
  afterEach(() => setQuiet(true));

  it('every raw WardenConfig field round-trips with zero unknown-key warnings', () => {
    const fs = require('fs');
    const tmpDir = '/tmp/warden-cfgschema-roundtrip';
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, `
defaultDecision: deny
askOnSubshell: false
notifyOnAsk: false
notifyOnDeny: false
audit: false
auditPath: /tmp/warden-roundtrip-audit.jsonl
auditAllowDecisions: true
sessionGuidance: false
tempScriptDir: /tmp/warden-roundtrip-scripts
trustedRemotes:
  - context: ssh
    name: rt-host
targetPolicies:
  - type: path
    path: /tmp/rt-path
    decision: allow
trustedContextOverrides:
  alwaysAllow:
    - rt-allow-cmd
  alwaysDeny: []
  rules: []
`);
    try {
      const config = loadConfig(tmpDir);

      // (a) zero unknown-key warnings
      const unknownKeyWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message.startsWith('unknown key'),
      );
      expect(unknownKeyWarnings).toEqual([]);

      // (b) every raw field actually merged onto the config
      expect(config.defaultDecision).toBe('deny');
      expect(config.askOnSubshell).toBe(false);
      expect(config.notifyOnAsk).toBe(false);
      expect(config.notifyOnDeny).toBe(false);
      expect(config.audit).toBe(false);
      expect(config.auditPath).toBe('/tmp/warden-roundtrip-audit.jsonl');
      expect(config.auditAllowDecisions).toBe(true);
      expect(config.sessionGuidance).toBe(false);
      expect(config.tempScriptDir).toBe('/tmp/warden-roundtrip-scripts');
      expect(config.trustedRemotes).toHaveLength(1);
      expect(config.trustedRemotes[0]).toMatchObject({ name: 'rt-host', context: 'ssh' });
      expect(config.targetPolicies).toHaveLength(1);
      expect(config.targetPolicies[0].type).toBe('path');
      expect(config.trustedContextOverrides).toBeDefined();
      expect(config.trustedContextOverrides!.alwaysAllow).toContain('rt-allow-cmd');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
