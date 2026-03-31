# Hook Protocol

Warden communicates with Claude Code via the PreToolUse hook protocol.

## Input

JSON on stdin:

```json
{
  "session_id": "abc123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm run build && npm test"
  },
  "cwd": "/path/to/project",
  "permission_mode": "default"
}
```

Warden only processes `tool_name: "Bash"`. Other tools are ignored (exit 0).

## Output

### Allow

stdout JSON:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "[warden] ok"
  }
}
```

### Ask

stdout JSON (same format, decision "ask"):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "[warden] python: unknown command"
  },
  "systemMessage": "To auto-allow, add to config..."
}
```

Falls through to Claude Code's built-in permission prompt.

### Deny

Exit code 2, reason on stderr:

```
[warden] blocked sudo: always denied (sudo)
```

## System messages

For ask/deny decisions, Warden includes a `systemMessage` with:

- Why the command was blocked/flagged
- YAML config snippet showing how to allow it
- Links to `/warden:allow` and `/warden:yolo`

## Size limit

Stdin capped at 1MB. Larger inputs get an `ask` decision.

## Special commands

YOLO activation/deactivation commands (`echo __WARDEN_YOLO_*`) are intercepted before normal evaluation.
