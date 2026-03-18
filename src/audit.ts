import { appendFileSync, statSync, renameSync } from 'fs';
import type { WardenConfig, HookInput, EvalResult } from './types';

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CMD_LENGTH = 500;

export function logDecision(
  config: WardenConfig,
  input: HookInput,
  result: EvalResult,
  elapsedMs: number,
  yoloActive: boolean,
): void {
  if (!config.audit) return;
  if (!config.auditAllowDecisions && result.decision === 'allow') return;

  const cmd = input.tool_input?.command;
  const entry = {
    ts: new Date().toISOString(),
    sid: input.session_id.slice(0, 12),
    cmd: typeof cmd === 'string' ? cmd.slice(0, MAX_CMD_LENGTH) : '',
    decision: result.decision,
    reason: result.reason,
    details: result.decision !== 'allow' ? result.details : [],
    yolo: yoloActive,
    elapsed_ms: elapsedMs,
  };

  try {
    rotateIfNeeded(config.auditPath);
    appendFileSync(config.auditPath, JSON.stringify(entry) + '\n');
  } catch {
    // Audit logging must never crash the hook
  }
}

function rotateIfNeeded(logPath: string): void {
  try {
    const stat = statSync(logPath);
    if (stat.size >= MAX_LOG_SIZE) {
      renameSync(logPath, logPath + '.1');
    }
  } catch {
    // File doesn't exist yet — nothing to rotate
  }
}
