# Claude Warden

[![GitHub license](https://img.shields.io/github/license/buvis/claude-warden)](https://github.com/buvis/claude-warden/blob/master/LICENSE)

Smart command safety filter for [Claude Code](https://claude.ai/code). Parses shell commands into AST, evaluates each against configurable safety rules, returns allow/deny/ask decisions - eliminating unnecessary permission prompts while blocking dangerous commands.

## The problem

Claude Code's permission system is all-or-nothing. Default mode prompts for **every** shell command - even `ls` and `cat`. YOLO mode disables all prompts, which is dangerous. No middle ground.

## What Warden does

Hooks into Claude Code's `PreToolUse` event. Parses every command through [unbash](https://github.com/webpro-nl/unbash), walks the AST to extract individual commands from pipes, chains, and subshells, evaluates each independently.

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

### Update

```
claude plugin update warden@buvis-plugins
```

### Alternative: install from npm

```bash
npm install -g @buvis/claude-warden
claude --plugin-dir $(npm root -g)/@buvis/claude-warden
```

### Alternative: test locally from source

```bash
git clone https://github.com/buvis/claude-warden.git
cd claude-warden && npm install && npm run build
claude --plugin-dir ./claude-warden
```

## Codex CLI

Codex supports [PreToolUse hooks](https://developers.openai.com/codex/hooks) with a wire protocol nearly identical to Claude Code's, so the **same** Warden hook binary works natively - no rule export needed.

### Setup

1. Install Warden globally so the `warden-hook` binary lands in your `PATH`:

```bash
npm install -g @buvis/claude-warden
```

2. Drop the following into `~/.codex/hooks.json` (user-wide) or `<repo>/.codex/hooks.json` (project-scoped):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "warden-hook",
            "statusMessage": "Checking Bash command with Warden"
          }
        ]
      }
    ]
  }
}
```

A ready-to-use template ships at [`.codex/hooks.json`](.codex/hooks.json). If `warden-hook` isn't on your `PATH` (e.g. non-global install), use the absolute path instead: `node /path/to/claude-warden/dist/index.cjs`.

### How it works

Codex sends the same `{tool_name, tool_input.command, cwd, session_id, ...}` payload on stdin and accepts the same `hookSpecificOutput.permissionDecision` response as Claude Code. The identical `dist/index.cjs` binary runs the full parser/evaluator pipeline - trusted hosts, YOLO mode, argument-aware rules, and all. The same `~/.claude/warden.yaml` and `.claude/warden.yaml` config files drive both.

### Known Codex limitations

- **Bash only** - Codex PreToolUse currently intercepts only shell commands; MCP, Write, and WebSearch tools are not hooked.
- **Work in progress upstream** - Codex's hook system may miss some shell invocations. Treat it as defense-in-depth, not a hard sandbox.
- **`deny` is authoritative; `allow`/`ask` fail open** - Codex currently honors `deny` (and exit code 2) but treats `allow`/`ask` as "fail open" (command proceeds). This is safe: Warden's deny list still blocks dangerous commands.
- **No undo** - hooks cannot revert a command that has already executed.

### Fallback: static rule export

For environments where the hook approach isn't viable, Warden can still export a static `execpolicy` rules file:

```bash
pnpm run codex:export-rules   # writes .codex/rules/warden.rules
```

Use `--cwd <dir>`, `--out <path>`, or `--stdout` to customize. This snapshot loses dynamic behavior (trusted hosts, YOLO, etc.) but works with older Codex setups.

## GitHub Copilot CLI

Warden supports GitHub Copilot CLI's [preToolUse hook](https://docs.github.com/en/copilot/reference/hooks-configuration) natively.

### Setup

1. Install Warden in your project:

```bash
npm install @buvis/claude-warden
```

2. Copy the hook config to your repo:

```bash
cp node_modules/@buvis/claude-warden/.github/hooks/warden.json .github/hooks/warden.json
```

3. Commit `.github/hooks/warden.json` to your default branch. Copilot CLI loads hooks from your current working directory automatically.

That's it. Copilot CLI will now evaluate bash commands through Warden's rule engine before execution.

### How it works

Copilot CLI sends a `preToolUse` event with `{"toolName": "bash", "toolArgs": "{\"command\": \"...\"}"}` on stdin. Warden's Copilot adapter (`dist/copilot.cjs`) parses this, runs the command through the same AST-based evaluation pipeline used for Claude Code, and returns `{"permissionDecision": "allow|deny|ask", "permissionDecisionReason": "..."}` on stdout.

The same `~/.claude/warden.yaml` and `.claude/warden.yaml` config files are used for both Claude Code and Copilot CLI.

## Generic CLI

Warden also provides a standalone CLI for use with any tool or shell script:

```bash
npx @buvis/claude-warden eval "ls -la"                    # -> allow
npx @buvis/claude-warden eval "shutdown -h now"            # -> deny (exit code 2)
npx @buvis/claude-warden eval --json "git push --force"    # -> JSON output
npx @buvis/claude-warden eval --cwd /path/to/project "rm -rf dist"
```

Exit codes: `0` = allow, `1` = ask, `2` = deny.

Use `--json` for machine-readable output suitable for scripting.

## Configure

Create config files to customize:

- **User-level**: `~/.claude/warden.yaml`
- **Project-level**: `.claude/warden.yaml`

Copy [`config/warden.default.yaml`](config/warden.default.yaml) as a starting point.

## Documentation

Full user and developer documentation at **[buvis.github.io/claude-warden](https://buvis.github.io/claude-warden/)**.

## License

MIT
