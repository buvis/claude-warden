import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { generateAllowSnippet, generateFullAllowSnippet, generateSubcommandSnippet, formatSystemMessage, formatSuggestionReport } from '../suggest';
import type { CommandEvalDetail } from '../types';
import type { AskGroup } from '../audit-analyze';

describe('generateAllowSnippet', () => {
  it('generates alwaysAllow for alwaysDeny match', () => {
    const details: CommandEvalDetail[] = [
      { command: 'sudo', args: ['apt', 'install'], decision: 'deny', reason: 'blocked by policy', matchedRule: 'alwaysDeny' },
    ];
    const snippet = generateAllowSnippet(details);
    expect(snippet).toContain('alwaysAllow:');
    expect(snippet).toContain('"sudo"');
  });

  it('generates alwaysAllow for default match', () => {
    const details: CommandEvalDetail[] = [
      { command: 'my-tool', args: [], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
    ];
    const snippet = generateAllowSnippet(details);
    expect(snippet).toContain('alwaysAllow:');
    expect(snippet).toContain('"my-tool"');
  });

  it('generates rules for argPattern match', () => {
    const details: CommandEvalDetail[] = [
      { command: 'npm', args: ['publish'], decision: 'ask', reason: 'modifies package registry', matchedRule: 'npm:argPattern' },
    ];
    const snippet = generateAllowSnippet(details);
    expect(snippet).toContain('rules:');
    expect(snippet).toContain('"npm"');
    expect(snippet).toContain('default: allow');
  });

  it('generates rules for command default match', () => {
    const details: CommandEvalDetail[] = [
      { command: 'docker', args: ['run', 'ubuntu'], decision: 'ask', reason: 'modifies Docker state', matchedRule: 'docker:default' },
    ];
    const snippet = generateAllowSnippet(details);
    expect(snippet).toContain('rules:');
    expect(snippet).toContain('"docker"');
  });

  it('skips allow decisions', () => {
    const details: CommandEvalDetail[] = [
      { command: 'cat', args: ['file'], decision: 'allow', reason: 'safe', matchedRule: 'alwaysAllow' },
    ];
    const snippet = generateAllowSnippet(details);
    expect(snippet).toBe('');
  });

  it('handles mixed decisions', () => {
    const details: CommandEvalDetail[] = [
      { command: 'cat', args: ['file'], decision: 'allow', reason: 'safe', matchedRule: 'alwaysAllow' },
      { command: 'my-tool', args: [], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
      { command: 'npm', args: ['publish'], decision: 'ask', reason: 'modifies package registry', matchedRule: 'npm:argPattern' },
    ];
    const snippet = generateAllowSnippet(details);
    expect(snippet).toContain('alwaysAllow:');
    expect(snippet).toContain('"my-tool"');
    expect(snippet).toContain('rules:');
    expect(snippet).toContain('"npm"');
    expect(snippet).not.toContain('"cat"');
  });

  it('deduplicates commands', () => {
    const details: CommandEvalDetail[] = [
      { command: 'my-tool', args: ['a'], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
      { command: 'my-tool', args: ['b'], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
    ];
    const snippet = generateAllowSnippet(details);
    const matches = snippet.match(/"my-tool"/g);
    expect(matches).toHaveLength(1);
  });
});

describe('generateFullAllowSnippet', () => {
  it('generates a rule with default: allow', () => {
    const snippet = generateFullAllowSnippet('npx');
    expect(snippet).toContain('rules:');
    expect(snippet).toContain('command: "npx"');
    expect(snippet).toContain('default: allow');
  });
});

describe('generateSubcommandSnippet', () => {
  it('generates argPattern rule for sub-command', () => {
    const snippet = generateSubcommandSnippet('npx', 'clawhub');
    expect(snippet).toContain('command: "npx"');
    expect(snippet).toContain('default: ask');
    expect(snippet).toContain("anyArgMatches: ['^clawhub$']");
    expect(snippet).toContain('decision: allow');
    expect(snippet).toContain('description: Allow npx clawhub');
  });

  it('escapes regex special characters in sub-command', () => {
    const snippet = generateSubcommandSnippet('npm', 'some.pkg');
    expect(snippet).toContain("anyArgMatches: ['^some\\.pkg$']");
  });
});

describe('formatSystemMessage', () => {
  it('returns compact reason for deny', () => {
    const { reason } = formatSystemMessage('deny', 'sudo apt install', [
      { command: 'sudo', args: ['apt', 'install'], decision: 'deny', reason: 'blocked by policy', matchedRule: 'alwaysDeny' },
    ]);
    expect(reason).toBe('[warden] blocked sudo: blocked by policy');
  });

  it('returns systemMessage with YAML snippet for deny', () => {
    const { systemMessage } = formatSystemMessage('deny', 'sudo rm', [
      { command: 'sudo', args: ['rm'], decision: 'deny', reason: 'blocked by policy', matchedRule: 'alwaysDeny' },
    ]);
    expect(systemMessage).toContain('alwaysAllow:');
    expect(systemMessage).toContain('"sudo"');
    expect(systemMessage).toContain('~/.claude/warden.yaml');
    expect(systemMessage).toContain('.claude/warden.yaml');
  });

  it('returns compact reason for ask with single command', () => {
    const { reason } = formatSystemMessage('ask', 'node script.js', [
      { command: 'node', args: ['script.js'], decision: 'ask', reason: 'needs review', matchedRule: 'node:default' },
    ]);
    expect(reason).toBe('[warden] node: needs review (/warden:allow node)');
  });

  it('returns systemMessage with allow hints for ask', () => {
    const { systemMessage } = formatSystemMessage('ask', 'node script.js', [
      { command: 'node', args: ['script.js'], decision: 'ask', reason: 'needs review', matchedRule: 'node:default' },
    ]);
    expect(systemMessage).toContain('/warden:allow node');
    expect(systemMessage).toContain('/warden:allow node script.js');
    expect(systemMessage).toContain('/warden:yolo');
  });

  it('uses simple format for ask without args', () => {
    const { reason } = formatSystemMessage('ask', 'my-tool', [
      { command: 'my-tool', args: [], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
    ]);
    expect(reason).toBe('[warden] my-tool: unknown command (/warden:allow my-tool)');
  });

  it('does not include subcommand hint when no args', () => {
    const { systemMessage } = formatSystemMessage('ask', 'my-tool', [
      { command: 'my-tool', args: [], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
    ]);
    // Only one line for my-tool (no subcommand variant)
    const allowLines = systemMessage!.split('\n').filter(l => l.startsWith('- Allow'));
    expect(allowLines).toHaveLength(1);
    expect(allowLines[0]).toContain('/warden:allow my-tool');
  });

  it('joins multiple flagged commands with semicolon', () => {
    const { reason } = formatSystemMessage('ask', 'node script.js | unknown-tool', [
      { command: 'node', args: ['script.js'], decision: 'ask', reason: 'needs review', matchedRule: 'node:default' },
      { command: 'unknown-tool', args: [], decision: 'ask', reason: 'unknown command', matchedRule: 'default' },
    ]);
    expect(reason).toContain('node: needs review');
    expect(reason).toContain('unknown-tool: unknown command');
    expect(reason).toContain('/warden:allow)');
  });

  it('ask format with args shows sub-command option in systemMessage', () => {
    const { systemMessage } = formatSystemMessage('ask', 'npx clawhub inspect', [
      { command: 'npx', args: ['clawhub', 'inspect'], decision: 'ask', reason: 'needs review', matchedRule: 'npx:default' },
    ]);
    expect(systemMessage).toContain('/warden:allow npx');
    expect(systemMessage).toContain('/warden:allow npx clawhub');
  });

  it('shows resolved name in ask reason when resolvedFrom is set', () => {
    const { reason } = formatSystemMessage('ask', '$ZDB init', [
      { command: 'zdb', args: ['init'], decision: 'ask', reason: 'unknown command', matchedRule: 'default', resolvedFrom: '$ZDB' },
    ]);
    expect(reason).toContain('zdb (via $ZDB)');
    expect(reason).toContain('/warden:allow zdb');
  });

  it('uses resolved command name in allow hints', () => {
    const { systemMessage } = formatSystemMessage('ask', '$ZDB init', [
      { command: 'zdb', args: ['init'], decision: 'ask', reason: 'unknown command', matchedRule: 'default', resolvedFrom: '$ZDB' },
    ]);
    expect(systemMessage).toContain('/warden:allow zdb');
  });
});

describe('formatSuggestionReport', () => {
  // Helpers to build AskGroup fixtures
  function makeGroup(overrides: Partial<AskGroup> & Pick<AskGroup, 'command' | 'argShape' | 'count'>): AskGroup {
    return {
      firstSeen: '2024-01-01T00:00:00.000Z',
      lastSeen: '2024-01-02T00:00:00.000Z',
      sampleReason: 'needs review',
      decisionSample: 'ask',
      ...overrides,
    };
  }

  // Scenario 1: mkdocs build x12, free ask (matchedRuleSample 'default') -> scoped snippet
  it('emits a scoped argPattern allow for mkdocs build (free ask, not blanket)', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 12, matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.top[0].command).toBe('mkdocs');
    expect(data.top[0].count).toBe(12);
    expect(data.snippet).toContain('command: "mkdocs"');
    expect(data.snippet).toContain("anyArgMatches: ['^build$']");
    expect(data.snippet).toContain('decision: allow');
    // Must NOT be a blanket default: allow
    expect(data.snippet).not.toMatch(/command: "mkdocs"[\s\S]*?default: allow(?!\s*\n\s*argPatterns)/);
  });

  // Scenario 2: poetry install (ask, 'default'), only one subcommand -> scoped argPatterns for install, not blanket
  it('emits scoped argPattern allow for poetry install (single subcommand, not blanket)', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'poetry', argShape: 'install', count: 5, matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('command: "poetry"');
    expect(data.snippet).toContain("anyArgMatches: ['^install$']");
    expect(data.snippet).toContain('decision: allow');
    // Single non-empty subcommand -> should NOT produce blanket default: allow
    // Blanket would appear as default: allow without argPatterns following it
    const blanketMatch = /command: "poetry"[^-]*default: allow/.test(data.snippet);
    const hasArgPatterns = data.snippet.includes('argPatterns:');
    expect(hasArgPatterns).toBe(true);
    // Not a blanket (which would have default: allow without argPatterns inside poetry's rule)
    // The scoped snippet has default: ask at the rule level
    expect(data.snippet).toContain('default: ask');
  });

  // Scenario 3 (LOAD-BEARING SAFETY): git push ask, matchedRuleSample 'git:argPattern' -> review manually, no allow for git
  it('never emits an allow rule for an argPattern-gated git push', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'git', argShape: 'push', count: 3, matchedRuleSample: 'git:argPattern' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('# review manually');
    expect(data.snippet).toContain('git');
    // Must NOT contain any allow rule for git
    expect(data.snippet).not.toContain('command: "git"');
    expect(data.snippet).not.toMatch(/\^push\$/);
    expect(data.snippet).not.toMatch(/default: allow[\s\S]*?git|git[\s\S]*?default: allow/);
  });

  // Scenario 4 (LOAD-BEARING SAFETY): sudo bare, decisionSample 'deny', matchedRuleSample 'alwaysDeny' -> review manually, no allow
  it('never emits an allow snippet for a sudo alwaysDeny entry', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'sudo', argShape: '', count: 2, decisionSample: 'deny', matchedRuleSample: 'alwaysDeny' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('# review manually');
    expect(data.snippet).toContain('sudo');
    expect(data.snippet).not.toContain('command: "sudo"');
    expect(data.snippet).not.toContain('default: allow');
  });

  // Scenario 5 (LOAD-BEARING SAFETY): find bare ask, matchedRuleSample 'find:delete' -> review manually, never blanket allow find
  it('never emits a blanket allow for a delete-gated find command', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'find', argShape: '', count: 4, decisionSample: 'ask', matchedRuleSample: 'find:delete' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('# review manually');
    expect(data.snippet).toContain('find');
    expect(data.snippet).not.toContain('command: "find"');
    expect(data.snippet).not.toContain('default: allow');
  });

  // Scenario 6: scoped-only (matchedRuleSample == `${command}:default`) -> generateSubcommandSnippet, not blanket
  it('emits a scoped subcommand snippet for a rule-bearing command (matchedRuleSample == command:default)', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mytool', argShape: 'build', count: 7, decisionSample: 'ask', matchedRuleSample: 'mytool:default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('command: "mytool"');
    expect(data.snippet).toContain("anyArgMatches: ['^build$']");
    expect(data.snippet).toContain('decision: allow');
    // Must NOT be a blanket allow
    expect(data.snippet).toContain('default: ask');
  });

  // Scenario 6b: bare free-ask command (argShape '', matchedRuleSample 'default') -> scoped command-level default: allow, never alwaysAllow
  it('emits a scoped command-level default: allow (never alwaysAllow) for a bare free-ask command', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mytool', argShape: '', count: 6, decisionSample: 'ask', matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('command: "mytool"');
    expect(data.snippet).toContain('default: allow');
    // Deliberate design choice: a bare suggestable command yields a scoped, overridable
    // rules entry, NOT alwaysAllow (which would bypass all rule evaluation).
    expect(data.snippet).not.toContain('alwaysAllow');
    // Bare command -> blanket command-level allow, no subcommand argPatterns scoping.
    expect(data.snippet).not.toContain('argPatterns');
    // A free ask IS suggestable -> not routed to the review-manually comment path.
    expect(data.snippet).not.toContain('# review manually');
  });

  // Scenario 7: snippet from ≥2 distinct suggestable commands parses as valid yaml with rules array
  it('produces a valid warden.yaml snippet parseable as yaml with a rules array (≥2 commands)', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 10, matchedRuleSample: 'default' }),
      makeGroup({ command: 'poetry', argShape: 'install', count: 8, matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    const snippet = data.snippet;
    expect(snippet).not.toBe('');
    const parsed = parse(snippet);
    expect(Array.isArray(parsed.rules)).toBe(true);
  });

  // Scenario 8: --json shape is stable with correct field values
  it('emits stable JSON with all required fields and correct computed values', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 10, firstSeen: '2024-01-01T00:00:00.000Z', lastSeen: '2024-01-05T00:00:00.000Z', matchedRuleSample: 'default' }),
      makeGroup({ command: 'poetry', argShape: 'install', count: 6, firstSeen: '2024-01-02T00:00:00.000Z', lastSeen: '2024-01-10T00:00:00.000Z', matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data).toHaveProperty('period');
    expect(data).toHaveProperty('totalAskDeny');
    expect(data).toHaveProperty('distinctGroups');
    expect(data).toHaveProperty('top');
    expect(data).toHaveProperty('snippet');
    expect(data.totalAskDeny).toBe(16);
    expect(data.distinctGroups).toBe(2);
    expect(data.period.from).toBe('2024-01-01T00:00:00.000Z');
    expect(data.period.to).toBe('2024-01-10T00:00:00.000Z');
    expect(Array.isArray(data.top)).toBe(true);
  });

  // Scenario 9: empty groups
  it('reports "no recurring asks" for empty groups in text mode', () => {
    const result = formatSuggestionReport([]);
    expect(result).toContain('No recurring ask/deny entries found.');
  });

  it('emits correct JSON for empty groups', () => {
    const result = formatSuggestionReport([], { json: true });
    const data = JSON.parse(result);
    expect(data.period.from).toBeNull();
    expect(data.period.to).toBeNull();
    expect(data.totalAskDeny).toBe(0);
    expect(data.distinctGroups).toBe(0);
    expect(data.top).toEqual([]);
    expect(data.snippet).toBe('');
  });

  // Scenario 10: determinism
  it('is deterministic - two calls with the same groups return identical strings', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 10, matchedRuleSample: 'default' }),
      makeGroup({ command: 'poetry', argShape: 'install', count: 6, matchedRuleSample: 'default' }),
    ];
    const first = formatSuggestionReport(groups);
    const second = formatSuggestionReport(groups);
    expect(first).toBe(second);
  });

  // Scenario 11: top option limits JSON top array but distinctGroups reflects total
  it('limits JSON top array by opts.top but distinctGroups counts all groups', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 10, matchedRuleSample: 'default' }),
      makeGroup({ command: 'poetry', argShape: 'install', count: 6, matchedRuleSample: 'default' }),
      makeGroup({ command: 'mytool', argShape: 'run', count: 3, matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups, { json: true, top: 2 });
    const data = JSON.parse(result);
    expect(data.top).toHaveLength(2);
    expect(data.distinctGroups).toBe(3);
  });

  // Additional text mode checks
  it('text output contains period, counts, and top section headings', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 12, matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups);
    expect(result).toContain('12');
    expect(result).toContain('mkdocs');
    expect(result).toContain('build');
  });

  it('text output contains snippet section', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'mkdocs', argShape: 'build', count: 12, matchedRuleSample: 'default' }),
    ];
    const result = formatSuggestionReport(groups);
    expect(result).toContain('command: "mkdocs"');
  });

  // Safety: trustedRemotes:* matchedRuleSample -> review manually
  it('review manually for trustedRemotes match, no allow snippet', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'ssh', argShape: '', count: 5, decisionSample: 'ask', matchedRuleSample: 'trustedRemotes:prod' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('# review manually');
    expect(data.snippet).not.toContain('command: "ssh"');
    expect(data.snippet).not.toContain('default: allow');
  });

  // Safety: targetPolicy:* matchedRuleSample -> review manually
  it('review manually for targetPolicy match, no allow snippet', () => {
    const groups: AskGroup[] = [
      makeGroup({ command: 'psql', argShape: '', count: 3, decisionSample: 'ask', matchedRuleSample: 'targetPolicy:prod-db' }),
    ];
    const result = formatSuggestionReport(groups, { json: true });
    const data = JSON.parse(result);
    expect(data.snippet).toContain('# review manually');
    expect(data.snippet).not.toContain('command: "psql"');
    expect(data.snippet).not.toContain('default: allow');
  });
});
