# Notifications & Audit

## Notifications

Warden sends OS notifications when commands are blocked or flagged.

```yaml
notifyOnAsk: true    # default
notifyOnDeny: true   # default
```

### Platform support

- **macOS**: terminal-notifier (preferred, click opens terminal) or osascript fallback
- **Linux**: notify-send

### Terminal detection (macOS)

iTerm2, Terminal.app, Alacritty, WezTerm — click notification activates the correct terminal.

Notifications run in background. Failures silently ignored.

## Audit Logging

Warden logs decisions to a JSONL file for review.

```yaml
audit: true                                    # default
auditPath: ~/.claude/warden-audit.jsonl        # default
auditAllowDecisions: false                     # default: only log deny/ask
```

### Log entry format

```json
{
  "ts": "2025-03-24T10:30:45.123Z",
  "sid": "abc123def456",
  "cmd": "npm run build",
  "decision": "allow",
  "reason": "ok",
  "details": [],
  "yolo": false,
  "elapsed_ms": 45
}
```

| Field | Description |
|-------|-------------|
| `sid` | First 12 chars of session ID |
| `cmd` | Truncated to 500 chars |
| `details` | Only populated for deny/ask decisions |

Log rotation at 5MB (keeps one backup).
