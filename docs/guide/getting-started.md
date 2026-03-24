# Getting Started

## Install

Run these two commands inside Claude Code:

```
/plugin marketplace add buvis/claude-plugins
/plugin install warden@buvis-plugins
```

Restart Claude Code to activate the hook.

## How it works

Warden registers a PreToolUse hook that intercepts every Bash tool call. The pipeline:

1. **Parse** — splits the command into individual parts (handling pipes, chains, quotes, shell wrappers)
2. **Evaluate** — checks each part against safety rules (global deny list, allow list, argument patterns, target policies)
3. **Decide** — returns `allow` (silent), `ask` (falls through to user prompt), or `deny` (blocks with reason on stderr)

## First steps

Warden works out of the box. The built-in defaults cover 100+ common dev commands — `ls`, `cat`, `grep`, `git`, `npm`, `node`, `docker`, and many more — with argument-aware rules that distinguish safe from risky usage.

No configuration needed to start. Just install and go.

## Customize

When you want to adjust the rules, create a config file:

- **User-level** (applies everywhere): `~/.claude/warden.yaml`
- **Project-level** (applies to one repo): `.claude/warden.yaml`

Project config overrides user config, which overrides built-in defaults.

Copy the reference config as a starting point:

```bash
cp config/warden.default.yaml ~/.claude/warden.yaml
```

## Next steps

See [Configuration](configuration.md) for the full config reference.
