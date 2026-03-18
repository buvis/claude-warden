import { describe, it, expect } from 'vitest';
import { generateAllowSnippet, generateFullAllowSnippet, generateSubcommandSnippet, formatSystemMessage } from '../suggest';
import type { CommandEvalDetail } from '../types';

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
});
