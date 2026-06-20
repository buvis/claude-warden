import type { CommandEvalDetail } from './types';
import type { AskGroup } from './audit-analyze';

export function generateAllowSnippet(details: CommandEvalDetail[]): string {
  const lines: string[] = [];
  const alwaysAllowCmds: string[] = [];
  const ruleCmds: string[] = [];

  for (const d of details) {
    if (d.decision === 'allow') continue;

    if (d.matchedRule === 'alwaysDeny' || d.matchedRule === 'default') {
      if (!alwaysAllowCmds.includes(d.command)) {
        alwaysAllowCmds.push(d.command);
      }
    } else if (d.matchedRule?.endsWith(':default') || d.matchedRule?.endsWith(':argPattern')) {
      if (!ruleCmds.includes(d.command)) {
        ruleCmds.push(d.command);
      }
    }
  }

  if (alwaysAllowCmds.length > 0) {
    lines.push('alwaysAllow:');
    for (const cmd of alwaysAllowCmds) {
      lines.push(`  - "${cmd}"`);
    }
  }

  if (ruleCmds.length > 0) {
    lines.push('rules:');
    for (const cmd of ruleCmds) {
      lines.push(`  - command: "${cmd}"`);
      lines.push('    default: allow');
    }
  }

  return lines.join('\n');
}

export function generateFullAllowSnippet(command: string): string {
  const lines = [
    'rules:',
    `  - command: "${command}"`,
    '    default: allow',
  ];
  return lines.join('\n');
}

export function generateSubcommandSnippet(command: string, subcommand: string): string {
  const lines = [
    'rules:',
    `  - command: "${command}"`,
    '    default: ask',
    '    argPatterns:',
    '      - match:',
    `          anyArgMatches: ['^${escapeRegex(subcommand)}$']`,
    '        decision: allow',
    `        description: Allow ${command} ${subcommand}`,
  ];
  return lines.join('\n');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FormattedMessage {
  reason: string;
  systemMessage?: string;
}

export function formatSystemMessage(
  decision: 'deny' | 'ask',
  rawCommand: string,
  details: CommandEvalDetail[],
  fallbackReason?: string,
): FormattedMessage {
  const relevant = details.filter(d => d.decision !== 'allow');

  if (decision === 'ask') {
    // Compact 1-line reason - use resolved name if available
    const parts = relevant.map(d => {
      const displayName = d.resolvedFrom ? `${d.command} (via ${d.resolvedFrom})` : d.command;
      return `${displayName}: ${d.reason}`;
    });
    const cmds = [...new Set(relevant.map(d => d.command))];
    const allowHint = cmds.length === 1 ? `/warden:allow ${cmds[0]}` : '/warden:allow';
    const body = parts.length > 0 ? parts.join('; ') : (fallbackReason || '');
    const reason = `[warden] ${body} (${allowHint})`;

    // Verbose help in systemMessage - use resolved command name for allow hints
    const helpLines: string[] = ['To auto-allow, add to ~/.claude/warden.yaml or .claude/warden.yaml:'];
    for (const d of relevant) {
      helpLines.push(`- Allow all \`${d.command}\` → \`/warden:allow ${d.command}\``);
      if (d.args.length > 0) {
        const sub = d.args[0];
        helpLines.push(`- Allow only \`${d.command} ${sub}\` → \`/warden:allow ${d.command} ${sub}\``);
      }
    }
    helpLines.push('- Temporarily allow all → `/warden:yolo`');

    return { reason, systemMessage: helpLines.join('\n') };
  }

  // Deny
  const parts = relevant.map(d => `${d.command}: ${d.reason}`);
  const body = parts.length > 0 ? parts.join('; ') : (fallbackReason || '');
  const reason = `[warden] blocked ${body}`;

  const snippet = generateAllowSnippet(details);
  let systemMessage: string | undefined;
  if (snippet) {
    const helpLines: string[] = [];
    const cmds = relevant.map(d => `"${d.command}"`).join(', ');
    helpLines.push(`To allow ${cmds}, add to ~/.claude/warden.yaml or .claude/warden.yaml:`);
    helpLines.push(snippet);
    systemMessage = helpLines.join('\n');
  }

  return { reason, systemMessage };
}

export interface SuggestionReportOptions {
  top?: number;
  json?: boolean;
}

function isSuggestable(g: AskGroup): boolean {
  if (g.decisionSample !== 'ask') return false;
  return (
    g.matchedRuleSample === undefined ||
    g.matchedRuleSample === 'default' ||
    g.matchedRuleSample === `${g.command}:default`
  );
}

function buildAllowlistSnippet(groups: AskGroup[]): string {
  const commentLines: string[] = [];
  const allowFragments: string[] = [];

  // Separate suggestable vs review-manually groups, preserving input order
  const suggestableByCommand = new Map<string, AskGroup[]>();
  for (const g of groups) {
    if (!isSuggestable(g)) {
      const argPart = g.argShape ? ` ${g.argShape}` : '';
      commentLines.push(`# review manually: ${g.command}${argPart} (${g.sampleReason})`);
    } else {
      const list = suggestableByCommand.get(g.command);
      if (list) {
        list.push(g);
      } else {
        suggestableByCommand.set(g.command, [g]);
      }
    }
  }

  // Build allow fragments per command in first-appearance order
  for (const [command, cGroups] of suggestableByCommand) {
    const ruleBearing = cGroups.some(g => g.matchedRuleSample === `${command}:default`);
    const hasBareSuggestable = cGroups.some(g => g.argShape === '');
    const nonEmptySubs = cGroups.filter(g => g.argShape !== '').map(g => g.argShape);
    // deduplicate while preserving order
    const subs: string[] = [];
    for (const s of nonEmptySubs) {
      if (!subs.includes(s)) subs.push(s);
    }

    if (ruleBearing) {
      if (subs.length >= 1) {
        for (const sub of subs) {
          allowFragments.push(generateSubcommandSnippet(command, sub));
        }
      } else {
        // bare ask but rule-gated: review manually comment
        commentLines.push(`# review manually: ${command} asked bare but is rule-gated`);
      }
    } else {
      if (hasBareSuggestable) {
        allowFragments.push(generateFullAllowSnippet(command));
      } else if (subs.length === 1) {
        allowFragments.push(generateSubcommandSnippet(command, subs[0]));
      } else {
        // ≥2 subs, not rule-bearing, no bare
        allowFragments.push(generateFullAllowSnippet(command));
      }
    }
  }

  if (commentLines.length === 0 && allowFragments.length === 0) return '';

  const lines: string[] = [...commentLines];
  if (allowFragments.length > 0) {
    lines.push('rules:');
    for (const frag of allowFragments) {
      const body = frag.split('\n').slice(1);
      for (const line of body) {
        lines.push(line);
      }
    }
  }

  return lines.join('\n');
}

export function formatSuggestionReport(groups: AskGroup[], opts?: SuggestionReportOptions): string {
  const topN = opts?.top ?? 10;
  const topGroups = groups.slice(0, topN);

  if (groups.length === 0) {
    if (opts?.json) {
      return JSON.stringify({ period: { from: null, to: null }, totalAskDeny: 0, distinctGroups: 0, top: [], snippet: '' });
    }
    return 'No recurring ask/deny entries found.';
  }

  let totalAskDeny = 0;
  let from: string | null = null;
  let to: string | null = null;
  for (const g of groups) {
    totalAskDeny += g.count;
    if (from === null || Date.parse(g.firstSeen) < Date.parse(from)) from = g.firstSeen;
    if (to === null || Date.parse(g.lastSeen) > Date.parse(to)) to = g.lastSeen;
  }
  const distinctGroups = groups.length;
  const snippet = buildAllowlistSnippet(topGroups);

  if (opts?.json) {
    return JSON.stringify({ period: { from, to }, totalAskDeny, distinctGroups, top: topGroups, snippet });
  }

  const lines: string[] = [];
  lines.push(`Warden suggest — ${from} .. ${to}`);
  lines.push(`${totalAskDeny} recurring ask/deny occurrences across ${distinctGroups} commands`);
  lines.push('');
  lines.push('Top repeated asks:');
  for (const g of topGroups) {
    const argPart = g.argShape ? ` ${g.argShape}` : '';
    lines.push(`  ${g.count}x  ${g.command}${argPart}   (${g.sampleReason})`);
  }
  lines.push('');
  lines.push('Suggested warden.yaml additions:');
  lines.push(snippet);

  return lines.join('\n');
}
