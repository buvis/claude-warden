# Architecture

## Pipeline

```
stdin (JSON) → index.ts → parser.ts → evaluator.ts → stdout (JSON) / exit code 2
                              ↑              ↑
                           unbash     rules.ts + defaults.ts + targets.ts
```

## Modules

### index.ts - Entry point
Reads hook JSON from stdin, runs parse→evaluate pipeline, outputs decision. Handles YOLO mode activation/deactivation, stdin size limits (1MB), and --dangerously-skip-permissions detection.

### parser.ts - Command parser
AST-based shell command parser using [unbash](https://github.com/webpro-nl/unbash). Walks the AST to:

- Extract commands from pipes, chains, control flow (while, if, for, case, functions)
- Extract env prefixes (`VAR=value`)
- Normalize command paths to basename
- Recursively parse `sh -c` / `bash -c` arguments
- Extract script paths from `bash/sh/zsh script.sh` invocations
- Detect subshells (`$()`, backticks), process substitutions, and heredocs
- Track chain-scoped variable assignments (`VAR=value && $VAR`)
- Detect `$(cat <<MARKER)` string interpolation idiom

### evaluator.ts - Decision engine
Evaluation hierarchy (first match wins):

1. Parse errors → ask
2. Empty command → allow
3. Subshell extraction and recursive evaluation
4. Layer-scoped alwaysDeny/alwaysAllow (project > user > default)
5. Target policies (path, database, endpoint)
6. Chain-local variable resolution (auto-allow if no rules match)
7. Chain-local rm cleanup
8. Remote command whitelisting (SSH, Docker, kubectl, Sprite, Fly)
9. Package runner subcommand evaluation (npx, bunx, pnpx, uv run)
10. Script safety scanning (Python, Node, Perl)
11. Command rules with argPattern matching
12. Default decision (`config.defaultDecision`)

For pipelines/chains: any deny → deny, any ask → ask, all allow → allow.

### defaults.ts - Built-in rules
Three tiers: always-allow (~60 commands), always-deny (~20 commands), conditional (~50 commands with argument-aware patterns).

### rules.ts - Config loader
Loads and merges YAML/JSON config from project (`.claude/warden.yaml`) and user (`~/.claude/warden.yaml`) levels. Handles legacy config migration, validation, and layer merging.

### targets.ts - Target policy evaluator
Three policy types: path (filesystem with traversal protection), database (connection string/URI parsing), endpoint (URL matching). Uses glob-to-regex conversion. Most restrictive policy wins.

### glob.ts - Pattern matching
Two functions: `globToRegex` (general: `*`, `?`, `[...]`, `{a,b,c}`) and `pathGlobToRegex` (path-aware: `*` = single segment, `**` = any depth).

### suggest.ts - Feedback system
Generates YAML config snippets and help messages when commands are blocked/flagged. Shows `/warden:allow` and `/warden:yolo` hints.

### notify.ts - OS notifications
macOS (terminal-notifier/osascript) and Linux (notify-send). Background, fire-and-forget.

### audit.ts - Audit logging
JSONL output with 5MB rotation. Configurable path and verbosity.

### yolo.ts - YOLO mode
Session-scoped auto-allow with time limits. State in `/tmp` files keyed by session ID.

### script-scanner.ts - Script safety scanning
Language-specific pattern detection for Python, TypeScript/JavaScript, and Perl. Two levels: dangerous (shell exec, eval, rmtree) and cautious (file writes, network).

### codex-export.ts - Codex rules export
Converts Warden config to Codex CLI `.rules` format (Starlark `prefix_rule` statements).

## Plugin structure

- `.claude-plugin/plugin.json` - Plugin metadata
- `hooks/hooks.json` - PreToolUse hook registration (Bash matcher)
- `config/warden.default.yaml` - Reference config for users
- `commands/*.md` - Slash command definitions
