# YOLO Mode

YOLO mode auto-allows all commands for a limited time or full session, while still blocking always-deny commands for safety.

## Activate via slash command

```
/warden:yolo session    # Full session, no expiry
/warden:yolo 5m         # 5 minutes
/warden:yolo 15m        # 15 minutes
/warden:yolo 30m        # 30 minutes
/warden:yolo off        # Turn off
```

No arguments shows a menu.

## Activate via environment variable

For non-interactive sessions (piped prompts):

```bash
WARDEN_YOLO=true claude < prompts.txt
WARDEN_YOLO=1 claude < prompts.txt
```

!!! warning
    `WARDEN_YOLO` env var bypasses **all** checks including always-deny. The slash command is safer.

## How it works

- **Session-scoped** — state stored in `/tmp`, keyed by session ID
- **Slash command** — always-deny commands still blocked
- **Env var** — bypasses everything (like `--dangerously-skip-permissions`)
- **Expired states** auto-cleaned

## Discovery

When Warden prompts for permission (ask decision), the message includes a tip about YOLO mode.
