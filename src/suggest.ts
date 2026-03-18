import type { CommandEvalDetail } from './types';

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
): FormattedMessage {
  const relevant = details.filter(d => d.decision !== 'allow');

  if (decision === 'ask') {
    // Compact 1-line reason — use resolved name if available
    const parts = relevant.map(d => {
      const displayName = d.resolvedFrom ? `${d.command} (via ${d.resolvedFrom})` : d.command;
      return `${displayName}: ${d.reason}`;
    });
    const cmds = [...new Set(relevant.map(d => d.command))];
    const allowHint = cmds.length === 1 ? `/warden:allow ${cmds[0]}` : '/warden:allow';
    const reason = `[warden] ${parts.join('; ')} (${allowHint})`;

    // Verbose help in systemMessage — use resolved command name for allow hints
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
  const reason = `[warden] blocked ${parts.join('; ')}`;

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
