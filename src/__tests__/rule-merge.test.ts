import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => '/tmp/warden-test-home' };
});

import { homedir } from 'os';
import { join } from 'path';
import { evaluate } from '../evaluator';
import { parseCommand } from '../parser';
import { loadConfig, setQuiet } from '../rules';
import { DEFAULT_CONFIG } from '../defaults';
import type { WardenConfig, ConfigLayer, ConfigWarning } from '../types';

function emptyLayer(overrides: Partial<ConfigLayer> = {}): ConfigLayer {
  return { alwaysAllow: [], alwaysDeny: [], rules: [], ...overrides };
}

function evalWith(cmd: string, overrides: Partial<WardenConfig>) {
  const config: WardenConfig = { ...structuredClone(DEFAULT_CONFIG), ...overrides };
  return evaluate(parseCommand(cmd), config);
}

describe('rule merging across layers', () => {
  it('user rule extends default rule by default', () => {
    const userLayer = emptyLayer({
      rules: [{
        command: 'npx',
        default: 'ask',
        argPatterns: [{
          match: { anyArgMatches: ['^clawhub$'] },
          decision: 'allow',
          description: 'user pattern',
        }],
      }],
    });

    const result = evalWith('npx clawhub', {
      layers: [userLayer, ...DEFAULT_CONFIG.layers],
    });
    expect(result.decision).toBe('allow');

    // Default npx patterns should still work (e.g. vitest is allowed by default)
    const result2 = evalWith('npx vitest', {
      layers: [userLayer, ...DEFAULT_CONFIG.layers],
    });
    expect(result2.decision).toBe('allow');
  });

  it('user default field overrides lower-layer default', () => {
    const userLayer = emptyLayer({
      rules: [{
        command: 'npx',
        default: 'deny',
        argPatterns: [{
          match: { anyArgMatches: ['^clawhub$'] },
          decision: 'allow',
        }],
      }],
    });

    // clawhub matches user pattern → allow
    const r1 = evalWith('npx clawhub', {
      layers: [userLayer, ...DEFAULT_CONFIG.layers],
    });
    expect(r1.decision).toBe('allow');

    // unknown-tool doesn't match any pattern → user's default: deny
    const r2 = evalWith('npx unknown-tool-xyz', {
      layers: [userLayer, ...DEFAULT_CONFIG.layers],
    });
    expect(r2.decision).toBe('deny');
  });

  it('override: true stops merging - shadows lower layers', () => {
    const userLayer = emptyLayer({
      rules: [{
        command: 'npx',
        override: true,
        default: 'deny',
        argPatterns: [{
          match: { anyArgMatches: ['^clawhub$'] },
          decision: 'allow',
        }],
      }],
    });

    // clawhub → allow (user pattern)
    const r1 = evalWith('npx clawhub', {
      layers: [userLayer, ...DEFAULT_CONFIG.layers],
    });
    expect(r1.decision).toBe('allow');

    // vitest would normally be allowed by default rules, but override stops merging
    const r2 = evalWith('npx vitest', {
      layers: [userLayer, ...DEFAULT_CONFIG.layers],
    });
    expect(r2.decision).toBe('deny');
  });

  it('3-layer merge: workspace + user + default', () => {
    const workspaceLayer = emptyLayer({
      rules: [{
        command: 'npx',
        default: 'ask',
        argPatterns: [{
          match: { anyArgMatches: ['^ws-tool$'] },
          decision: 'allow',
          description: 'workspace pattern',
        }],
      }],
    });

    const userLayer = emptyLayer({
      rules: [{
        command: 'npx',
        default: 'ask',
        argPatterns: [{
          match: { anyArgMatches: ['^user-tool$'] },
          decision: 'allow',
          description: 'user pattern',
        }],
      }],
    });

    const layers = [workspaceLayer, userLayer, ...DEFAULT_CONFIG.layers];

    // workspace pattern
    expect(evalWith('npx ws-tool', { layers }).decision).toBe('allow');
    // user pattern
    expect(evalWith('npx user-tool', { layers }).decision).toBe('allow');
    // default pattern (e.g. vitest)
    expect(evalWith('npx vitest', { layers }).decision).toBe('allow');
  });

  it('3-layer merge: workspace override stops at workspace', () => {
    const workspaceLayer = emptyLayer({
      rules: [{
        command: 'npx',
        override: true,
        default: 'deny',
        argPatterns: [{
          match: { anyArgMatches: ['^ws-only$'] },
          decision: 'allow',
        }],
      }],
    });

    const userLayer = emptyLayer({
      rules: [{
        command: 'npx',
        default: 'ask',
        argPatterns: [{
          match: { anyArgMatches: ['^user-tool$'] },
          decision: 'allow',
        }],
      }],
    });

    const layers = [workspaceLayer, userLayer, ...DEFAULT_CONFIG.layers];

    expect(evalWith('npx ws-only', { layers }).decision).toBe('allow');
    // user-tool and vitest are blocked because workspace has override: true
    expect(evalWith('npx user-tool', { layers }).decision).toBe('deny');
    expect(evalWith('npx vitest', { layers }).decision).toBe('deny');
  });

  it('no regression: single-layer rules still work identically', () => {
    // Just using DEFAULT_CONFIG - no user layers
    const r1 = evaluate(parseCommand('npx vitest'), DEFAULT_CONFIG);
    expect(r1.decision).toBe('allow');

    const r2 = evaluate(parseCommand('npx unknown-xyz'), DEFAULT_CONFIG);
    expect(r2.decision).toBe('ask');

    const r3 = evaluate(parseCommand('git status'), DEFAULT_CONFIG);
    expect(r3.decision).toBe('allow');
  });

  it('user rule for command not in defaults works standalone', () => {
    const userLayer = emptyLayer({
      rules: [{
        command: 'my-custom-tool',
        default: 'deny',
        argPatterns: [{
          match: { anyArgMatches: ['^safe-arg$'] },
          decision: 'allow',
        }],
      }],
    });

    const layers = [userLayer, ...DEFAULT_CONFIG.layers];

    expect(evalWith('my-custom-tool safe-arg', { layers }).decision).toBe('allow');
    expect(evalWith('my-custom-tool danger', { layers }).decision).toBe('deny');
  });

  it('user layer without argPatterns still merges with default patterns', () => {
    const userLayer = emptyLayer({
      rules: [{
        command: 'npx',
        default: 'deny',
        // No argPatterns - just overriding the default decision
      }],
    });

    const layers = [userLayer, ...DEFAULT_CONFIG.layers];

    // vitest still allowed via default layer's patterns
    expect(evalWith('npx vitest', { layers }).decision).toBe('allow');
    // But unmatched commands now get user's default: deny
    expect(evalWith('npx unknown-xyz', { layers }).decision).toBe('deny');
  });
});

describe('legacy trusted* config conversion', () => {
  it('trustedSSHHosts auto-converts to trustedRemotes with context: ssh', () => {
    setQuiet(false);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const fs = require('fs');
    const tmpDir = '/tmp/warden-test-legacy-remotes';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, `
trustedSSHHosts:
  - devserver
  - name: prod-bastion
    allowAll: true
`);

    const config = loadConfig(tmpDir);

    expect(config.trustedRemotes).toHaveLength(2);
    expect(config.trustedRemotes[0]).toEqual({ name: 'devserver', context: 'ssh' });
    expect(config.trustedRemotes[1]).toEqual({ name: 'prod-bastion', context: 'ssh', allowAll: true });

    const warnings = stderrSpy.mock.calls.map(c => String(c[0]));
    expect(warnings.some(w => w.includes('trustedSSHHosts is deprecated'))).toBe(true);

    stderrSpy.mockRestore();
    setQuiet(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('trustedRemotes works directly without deprecation warning', () => {
    setQuiet(false);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const fs = require('fs');
    const tmpDir = '/tmp/warden-test-unified-remotes';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, `
trustedRemotes:
  - context: docker
    name: my-app
    allowAll: true
`);

    const config = loadConfig(tmpDir);

    expect(config.trustedRemotes).toHaveLength(1);
    expect(config.trustedRemotes[0]).toEqual({ name: 'my-app', context: 'docker', allowAll: true });

    const warnings = stderrSpy.mock.calls.map(c => String(c[0]));
    expect(warnings.some(w => w.includes('deprecated'))).toBe(false);

    stderrSpy.mockRestore();
    setQuiet(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('config.warnings collection', () => {
  it('collects a warning for an invalid rule decision in verbose mode and also prints to stderr', () => {
    setQuiet(false);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const fs = require('fs');
    const tmpDir = '/tmp/warden-test-warnings-verbose';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, `
rules:
  - command: git
    default: banana
`);

    const config = loadConfig(tmpDir);

    // warning must be collected regardless of quiet mode
    expect(Array.isArray(config.warnings)).toBe(true);
    expect(config.warnings!.length).toBeGreaterThan(0);

    const w = config.warnings![0] as ConfigWarning;
    // file must be an absolute path pointing to the config file we wrote
    expect(w.file).toContain(tmpDir);
    // path must reference the offending rule location
    expect(w.path).toBeTruthy();
    expect(w.path).toMatch(/rule/i);
    // message must describe the invalid value, not be empty
    expect(w.message).toBeTruthy();
    expect(w.message).toContain('banana');

    // verbose mode: warning must also have been printed to stderr
    const stderrLines = stderrSpy.mock.calls.map(c => String(c[0]));
    expect(stderrLines.some(l => l.includes('banana'))).toBe(true);

    stderrSpy.mockRestore();
    setQuiet(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('collects a warning for an invalid rule decision in quiet mode without printing to stderr', () => {
    setQuiet(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const fs = require('fs');
    const tmpDir = '/tmp/warden-test-warnings-quiet';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, `
rules:
  - command: git
    default: banana
`);

    const config = loadConfig(tmpDir);

    // warning must be collected even in quiet mode
    expect(Array.isArray(config.warnings)).toBe(true);
    expect(config.warnings!.length).toBeGreaterThan(0);

    const w = config.warnings![0] as ConfigWarning;
    expect(w.file).toContain(tmpDir);
    expect(w.path).toBeTruthy();
    expect(w.path).toMatch(/rule/i);
    expect(w.message).toBeTruthy();
    expect(w.message).toContain('banana');

    // quiet mode: stderr must NOT have been written to at all
    expect(stderrSpy).not.toHaveBeenCalled();

    stderrSpy.mockRestore();
    setQuiet(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('yields an empty warnings array when the config is valid', () => {
    setQuiet(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const fs = require('fs');
    const tmpDir = '/tmp/warden-test-warnings-valid';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, `
rules:
  - command: git
    default: allow
`);

    const config = loadConfig(tmpDir);

    // warnings must always be present and be an array
    expect(Array.isArray(config.warnings)).toBe(true);
    // a valid config produces zero warnings
    expect(config.warnings).toHaveLength(0);

    stderrSpy.mockRestore();
    setQuiet(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// Helper: write a workspace config and return the cwd used.
function writeWorkspaceConfig(label: string, yaml: string): string {
  const fs = require('fs');
  const tmpDir = `/tmp/warden-test-unknownkeys-${label}`;
  fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
  fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, yaml);
  return tmpDir;
}

describe('config.warnings — unknown-key detection', () => {
  beforeEach(() => setQuiet(true));
  afterEach(() => setQuiet(true));

  it('top-level typo emits one unknown-key warning with suggestion and drops the key', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('toplevel-typo', `
alwaysAlow:
  - foo
`);
    try {
      const config = loadConfig(tmpDir);
      const unknownWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message === 'unknown key "alwaysAlow"',
      );
      expect(unknownWarnings).toHaveLength(1);
      const w = unknownWarnings[0] as ConfigWarning & { suggestion?: string };
      expect(w.path).toBe('alwaysAlow');
      expect(w.suggestion).toBe('alwaysAllow');
      // The misspelled key must not affect the effective allow list
      const effectiveAllow = config.layers.flatMap(l => l.alwaysAllow);
      expect(effectiveAllow).not.toContain('foo');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rule-field typo emits an unknown-key warning with correct path and suggestion', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('rule-field-typo', `
rules:
  - command: git
    defualt: deny
`);
    try {
      const config = loadConfig(tmpDir);
      const unknownWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message === 'unknown key "defualt"',
      );
      expect(unknownWarnings).toHaveLength(1);
      const w = unknownWarnings[0] as ConfigWarning & { suggestion?: string };
      expect(w.path).toBe('rules[0].defualt');
      expect(w.suggestion).toBe('default');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('argPattern match-level typo emits an unknown-key warning with correct path and suggestion', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('match-level-typo', `
rules:
  - command: git
    default: ask
    argPatterns:
      - match:
          anyArgMatchs:
            - "^status$"
        decision: allow
`);
    try {
      const config = loadConfig(tmpDir);
      const unknownWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message === 'unknown key "anyArgMatchs"',
      );
      expect(unknownWarnings).toHaveLength(1);
      const w = unknownWarnings[0] as ConfigWarning & { suggestion?: string };
      expect(w.path).toBe('rules[0].argPatterns[0].match.anyArgMatchs');
      expect(w.suggestion).toBe('anyArgMatches');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('trustedRemotes entry typo emits an unknown-key warning with correct path and suggestion', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('trustedremotes-typo', `
trustedRemotes:
  - name: devserver
    contxt: ssh
`);
    try {
      const config = loadConfig(tmpDir);
      const unknownWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message === 'unknown key "contxt"',
      );
      expect(unknownWarnings).toHaveLength(1);
      const w = unknownWarnings[0] as ConfigWarning & { suggestion?: string };
      expect(w.path).toBe('trustedRemotes[0].contxt');
      expect(w.suggestion).toBe('context');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('legacy trustedSSHHosts emits a deprecation warning but NOT an unknown-key warning, and converts to trustedRemotes', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('legacy-deprecation', `
trustedSSHHosts:
  - name: devserver
    allowAll: true
`);
    try {
      const config = loadConfig(tmpDir);
      const unknownWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message === 'unknown key "trustedSSHHosts"',
      );
      expect(unknownWarnings).toHaveLength(0);

      const deprecationWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message.includes('trustedSSHHosts is deprecated'),
      );
      expect(deprecationWarnings.length).toBeGreaterThan(0);

      // Legacy entry must still be converted to a trustedRemotes ssh entry
      const sshEntries = config.trustedRemotes.filter(r => r.context === 'ssh');
      expect(sshEntries).toHaveLength(1);
      expect(sshEntries[0].name).toBe('devserver');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('shipping reference config warden.default.yaml produces zero warnings', () => {
    const fs = require('fs');
    const tmpDir = `/tmp/warden-test-unknownkeys-defaultyaml`;
    fs.mkdirSync(`${tmpDir}/.claude`, { recursive: true });
    // Copy the reference config into the workspace position
    const referenceYaml = fs.readFileSync(
      join(__dirname, '../../config/warden.default.yaml'),
      'utf-8',
    );
    fs.writeFileSync(`${tmpDir}/.claude/warden.yaml`, referenceYaml);
    try {
      const config = loadConfig(tmpDir);
      expect(config.warnings ?? []).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rich valid config with nested constructs and all targetPolicy types produces zero warnings', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('rich-valid', `
trustedContextOverrides:
  alwaysAllow:
    - sudo
  alwaysDeny: []
  rules: []
trustedRemotes:
  - context: ssh
    name: devserver
    overrides:
      alwaysAllow: [systemctl]
      alwaysDeny: []
      rules: []
targetPolicies:
  - type: path
    path: /tmp
    decision: allow
    recursive: true
  - type: database
    host: localhost
    port: 5432
    database: testdb
    decision: allow
  - type: endpoint
    pattern: "https://api.example.com/*"
    decision: allow
rules:
  - command: git
    default: ask
    override: true
    argPatterns:
      - match:
          argsMatch:
            - "^status"
          anyArgMatches:
            - "^--short$"
          noArgs: false
          argCount:
            min: 1
          not: false
        decision: allow
        description: allow git status variants
        reason: safe read-only
`);
    try {
      const config = loadConfig(tmpDir);
      expect(config.warnings ?? []).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('two config files with distinct typos each produce a warning attributed to the correct file', () => {
    const fs = require('fs');
    const userConfigPath = join(homedir(), '.claude', 'warden.yaml');

    const tmpDir = writeWorkspaceConfig('two-file-attribution', `
alwaysAlow:
  - proj-tool
`);

    try {
      // Write a typo'd user config under the mocked home (never touches real ~/.claude)
      fs.mkdirSync(join(homedir(), '.claude'), { recursive: true });
      fs.writeFileSync(userConfigPath, `
alwaysDny:
  - dangerous-tool
`);

      const config = loadConfig(tmpDir);

      const userWarning = (config.warnings ?? []).find(
        (w: ConfigWarning) => w.message === 'unknown key "alwaysDny"',
      ) as (ConfigWarning & { suggestion?: string }) | undefined;
      expect(userWarning).toBeDefined();
      expect(userWarning!.file).toBe(userConfigPath);
      expect(userWarning!.suggestion).toBe('alwaysDeny');

      const wsWarning = (config.warnings ?? []).find(
        (w: ConfigWarning) => w.message === 'unknown key "alwaysAlow"',
      ) as (ConfigWarning & { suggestion?: string }) | undefined;
      expect(wsWarning).toBeDefined();
      expect(wsWarning!.file).toContain(tmpDir);
      expect(wsWarning!.suggestion).toBe('alwaysAllow');
    } finally {
      fs.rmSync(join(homedir(), '.claude'), { recursive: true, force: true });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('targetPolicy with unknown type does not produce unknown-key warnings for sibling fields', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('bad-policy-type', `
targetPolicies:
  - type: pth
    path: /tmp
    decision: allow
    recursive: true
`);
    try {
      const config = loadConfig(tmpDir);
      // May produce a warning about unknown targetPolicy type "pth"
      // but must NOT produce unknown-key warnings for "path", "decision", "recursive", etc.
      const unexpectedUnknownKeys = (config.warnings ?? []).filter(
        (w: ConfigWarning) =>
          w.message === 'unknown key "path"' ||
          w.message === 'unknown key "decision"' ||
          w.message === 'unknown key "recursive"' ||
          w.message === 'unknown key "allowAll"' ||
          w.message === 'unknown key "commands"' ||
          w.message === 'unknown key "reason"',
      );
      expect(unexpectedUnknownKeys).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('legacy-list entry typo emits an unknown-key warning for the misspelled field plus deprecation warning for the list', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('legacy-entry-typo', `
trustedSSHHosts:
  - name: devserver
    allwAll: true
`);
    try {
      const config = loadConfig(tmpDir);

      const unknownWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message === 'unknown key "allwAll"',
      );
      expect(unknownWarnings).toHaveLength(1);
      const w = unknownWarnings[0] as ConfigWarning & { suggestion?: string };
      expect(w.path).toBe('trustedSSHHosts[0].allwAll');
      expect(w.suggestion).toBe('allowAll');

      const deprecationWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.message.includes('trustedSSHHosts is deprecated'),
      );
      expect(deprecationWarnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('argPattern without a match key produces zero match-level warnings and no crash', () => {
    const fs = require('fs');
    const tmpDir = writeWorkspaceConfig('no-match-key', `
rules:
  - command: git
    default: ask
    argPatterns:
      - decision: allow
        description: no match condition
`);
    try {
      const config = loadConfig(tmpDir);
      const matchLevelWarnings = (config.warnings ?? []).filter(
        (w: ConfigWarning) => w.path.includes('.match.'),
      );
      expect(matchLevelWarnings).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
