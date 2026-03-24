# Slash Commands

## /warden:yolo

Enable/disable YOLO mode. See [YOLO Mode](yolo-mode.md) for details.

## /warden:allow

Allow a previously blocked or flagged command by updating your config.

Usage:

- `/warden:allow npx` — allow all npx commands
- `/warden:allow npx clawhub` — choose between allowing all npx or just npx clawhub

When called with multiple words, you choose:

- **Option A**: Allow all `<command>` (sets `default: allow`)
- **Option B**: Allow only `<command> <subcommand>` (adds `argPattern`)

Config scope: you choose project (`.claude/warden.yaml`) or user (`~/.claude/warden.yaml`).

The command merges into existing config — appends to `alwaysAllow` or merges `argPatterns` into existing rules without duplicates.

## Feedback messages

When Warden blocks or flags a command, it includes:

1. Why the command was blocked/flagged
2. A ready-to-use YAML snippet showing how to allow it
3. Links to `/warden:allow` and `/warden:yolo`
