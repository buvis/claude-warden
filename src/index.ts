import { parseCommand } from './parser';
import { evaluate } from './evaluator';
import { loadConfig } from './rules';
import { formatSystemMessage } from './suggest';
import { sendNotification } from './notify';
import { logDecision } from './audit';
import { getYoloState, activateYolo, deactivateYolo, parseYoloCommand } from './yolo';
import type { HookInput, HookOutput } from './types';

const MAX_STDIN_SIZE = 1024 * 1024; // 1MB

async function main() {
  const startTime = Date.now();
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > MAX_STDIN_SIZE) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: '[warden] Input exceeds size limit',
        },
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }
  }

  let input: HookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    // Can't parse input — don't interfere
    process.exit(0);
  }

  if (input.tool_name !== 'Bash') {
    process.exit(0);
  }

  // Auto-allow when running with --dangerously-skip-permissions
  if (input.permission_mode === 'dangerously-skip-permissions') {
    process.exit(0);
  }

  // Auto-allow when WARDEN_YOLO env var is set
  if (process.env.WARDEN_YOLO === 'true' || process.env.WARDEN_YOLO === '1') {
    process.exit(0);
  }

  const command = input.tool_input?.command;
  if (!command || typeof command !== 'string') {
    process.exit(0);
  }

  // Handle YOLO activation/deactivation commands
  const yoloCmd = parseYoloCommand(command);
  if (yoloCmd) {
    let msg: string;
    if (yoloCmd.action === 'activate') {
      const state = activateYolo(input.session_id, yoloCmd.durationMinutes);
      const expiryInfo = state.expiresAt
        ? `until ${new Date(state.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'full session';
      msg = `[warden] yolo on (${expiryInfo}). Blocked commands still denied.`;
    } else if (yoloCmd.action === 'deactivate') {
      deactivateYolo(input.session_id);
      msg = '[warden] yolo off';
    } else {
      const state = getYoloState(input.session_id);
      if (state) {
        const expiryInfo = state.expiresAt
          ? `until ${new Date(state.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'full session';
        msg = `[warden] yolo on (${expiryInfo})`;
      } else {
        msg = '[warden] yolo off';
      }
    }
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: msg,
      },
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  const config = loadConfig(input.cwd);

  // Check YOLO mode — evaluate once here, reuse result below if deny falls through
  let yoloActive = false;
  const yoloState = getYoloState(input.session_id);
  if (yoloState) {
    yoloActive = true;
    const parsed = parseCommand(command);
    const result = evaluate(parsed, config, 0, input.cwd);

    // In YOLO mode, only block alwaysDeny commands (unless bypassDeny is set)
    if (result.decision === 'deny' && !yoloState.bypassDeny) {
      // Fall through to deny handling below — reuse this result
      const elapsed = Date.now() - startTime;
      logDecision(config, input, result, elapsed, true);
      if (config.notifyOnDeny) {
        const truncated = command.length > 80 ? command.slice(0, 77) + '...' : command;
        sendNotification('Claude Warden', `Blocked: ${truncated}`, config);
      }
      const { reason, systemMessage } = formatSystemMessage('deny', command, result.details);
      const output: HookOutput = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
        systemMessage,
      };
      process.stdout.write(JSON.stringify(output));
      process.stderr.write(`${reason}\n`);
      process.exit(2);
    } else {
      logDecision(config, input, result, Date.now() - startTime, true);
      const expiryInfo = yoloState.expiresAt
        ? `until ${new Date(yoloState.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'full session';
      const output: HookOutput = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: `[warden] yolo (${expiryInfo})`,
        },
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }
  }

  const parsed = parseCommand(command);
  const result = evaluate(parsed, config, 0, input.cwd);
  const elapsed = Date.now() - startTime;

  if (result.decision === 'allow') {
    logDecision(config, input, result, elapsed, false);
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: '[warden] ok',
      },
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  if (result.decision === 'deny') {
    logDecision(config, input, result, elapsed, false);
    if (config.notifyOnDeny) {
      const truncated = command.length > 80 ? command.slice(0, 77) + '...' : command;
      sendNotification('Claude Warden', `Blocked: ${truncated}`, config);
    }
    const { reason, systemMessage } = formatSystemMessage('deny', command, result.details);
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
      systemMessage,
    };
    process.stdout.write(JSON.stringify(output));
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }

  // decision === 'ask' — provide feedback via systemMessage
  logDecision(config, input, result, elapsed, false);
  if (config.notifyOnAsk) {
    const truncated = command.length > 80 ? command.slice(0, 77) + '...' : command;
    sendNotification('Claude Warden', `Permission needed: ${truncated}`, config);
  }
  const { reason, systemMessage } = formatSystemMessage('ask', command, result.details);
  const output: HookOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
    systemMessage,
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[warden] fatal: ${err?.message ?? err}\n`);
  process.exit(0);
});
