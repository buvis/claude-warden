# Claude Warden

[![GitHub license](https://img.shields.io/github/license/buvis/claude-warden)](https://github.com/buvis/claude-warden/blob/master/LICENSE)

Smart command safety filter for [Claude Code](https://claude.ai/code). Parses shell commands into AST, evaluates each against configurable safety rules, returns allow/deny/ask decisions — eliminating unnecessary permission prompts while blocking dangerous commands.

## The problem

Claude Code's permission system is all-or-nothing. Default mode prompts for **every** shell command — even `ls` and `cat`. YOLO mode disables all prompts, which is dangerous. No middle ground.

## What Warden does

Hooks into Claude Code's `PreToolUse` event. Parses every command through [bash-parser](https://github.com/vorpaljs/bash-parser), walks the AST to extract individual commands from pipes, chains, and subshells, evaluates each independently.

| Command | Without Warden | With Warden |
|---------|---------------|-------------|
| `ls -la` | Prompted | Auto-allowed |
| `cat file \| grep pattern \| wc -l` | Prompted | Auto-allowed (3 safe commands) |
| `npm run build && npm test` | Prompted | Auto-allowed |
| `git push --force origin main` | Prompted | Prompted (force push is risky) |
| `sudo rm -rf /` | Prompted | Auto-denied (sudo is blocked) |
| `ssh devserver cat /etc/hosts` | Prompted | Auto-allowed (trusted host + safe cmd) |

## Install

Two commands inside Claude Code:

```
/plugin marketplace add buvis/claude-plugins
/plugin install warden@buvis-plugins
```

Restart Claude Code and Warden is active. Works out of the box with sensible defaults.

## Configure

Create config files to customize:

- **User-level**: `~/.claude/warden.yaml`
- **Project-level**: `.claude/warden.yaml`

Copy [`config/warden.default.yaml`](config/warden.default.yaml) as a starting point.

## Documentation

Full user and developer documentation at **[buvis.github.io/claude-warden](https://buvis.github.io/claude-warden/)**.

## License

MIT
