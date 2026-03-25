# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Claude Warden is a Claude Code plugin that provides smart command safety filtering. It intercepts Bash tool calls via a PreToolUse hook, parses shell commands into individual parts (handling pipes, chains, env prefixes), evaluates each against configurable safety rules, and returns allow/deny/ask decisions - eliminating unnecessary permission prompts while blocking dangerous commands.

## Commands

- `pnpm run build` - Build with tsup (outputs `dist/index.cjs`)
- `pnpm run test` - Run all tests with vitest
- `pnpm run test -- src/__tests__/parser.test.ts` - Run a single test file
- `pnpm run test:watch` - Vitest in watch mode
- `pnpm run typecheck` - TypeScript type checking
- `pnpm run dev` - Watch mode build
- `pnpm run eval` - Run the built hook locally (reads hook JSON from stdin)

## Architecture

**Hook entry point**: `src/index.ts` reads JSON from stdin (Claude Code hook protocol), runs the parse→evaluate pipeline, and outputs the permission decision via stdout JSON or exit code 2 (deny).

**Pipeline**: `index.ts` → `parser.ts` → `evaluator.ts` (with config from `rules.ts` + `defaults.ts`, target policies from `targets.ts`)

- `src/parser.ts` - AST-based shell command parser using unbash. Walks the AST to extract commands from pipes, chains, control flow (while/if/for/case/functions). Extracts env prefixes, normalizes command paths to basename. Recursively parses `sh -c`/`bash -c` arguments. Extracts script path from `bash/sh/zsh script.sh` invocations (evaluates script, not shell). Detects subshells, process substitutions, and heredocs. Tracks chain-scoped variable assignments (`VAR=value && ...`) and resolves `$VAR` in command position.
- `src/evaluator.ts` - Decision engine. Hierarchy: global deny patterns → alwaysDeny → alwaysAllow → chain-local auto-allow → target policies → command-specific rules with argument pattern matching → default decision. For pipelines/chains, combines per-command results (any deny → deny, any ask → ask, all allow → allow).
- `src/defaults.ts` - Built-in rules for ~100 common dev commands. Three tiers: always-allow (cat, ls, grep...), always-deny (sudo, shutdown...), conditional (node, npx, git, docker... with argument-aware patterns).
- `src/glob.ts` - Glob-to-regex conversion. `globToRegex` (general: `*`, `?`, `[...]`, `{a,b,c}`) and `pathGlobToRegex` (path-aware: `*` = single segment, `**` = any depth).
- `src/targets.ts` - Target-aware policy evaluator. Three towers: path (filesystem targets with traversal protection), database (connection string/URI parsing), endpoint (URL matching). Uses globToRegex for pattern matching. Called from evaluator after alwaysDeny/alwaysAllow checks.
- `src/rules.ts` - Loads and merges config from `~/.claude/warden.yaml` (user) and `.claude/warden.yaml` (project). User rules override defaults by command name. Config supports unified `trustedRemotes` (with `context` discriminator for ssh/docker/kubectl/sprite/fly) and `trustedContextOverrides` for context-aware filtering. Legacy separate trusted* keys auto-convert with deprecation warning.
- `src/types.ts` - All TypeScript interfaces.

## Hook Protocol

The hook communicates with Claude Code via the PreToolUse hook protocol:
- **Input**: JSON on stdin with `tool_name`, `tool_input.command`, `cwd`, etc.
- **Allow**: stdout JSON with `permissionDecision: "allow"`
- **Ask**: stdout JSON with `permissionDecision: "ask"` (falls through to user prompt)
- **Deny**: exit code 2 with reason on stderr

## Releasing

Releases are done remotely by creating a GitHub release (not by publishing locally). A CI workflow handles npm publishing via OIDC trusted publishing when a release is created.

1. Merge PR to `master`
2. `gh release create vX.Y.Z --target master --title "vX.Y.Z" --notes "..."`

**Burned npm versions:** v3.0.0 was published to npm by mistake and can never be reused. When versioning reaches v3, start from v3.0.1.

**Version bumps require explicit user approval.** Never change the major or minor version without asking first.

## Safety invariant for auto-allow features

The evaluator has features that auto-allow commands without user prompts (chain-local variable resolution, chain-local rm cleanup, trusted remote contexts). These must never override user-configured restrictions:

1. `alwaysDeny` is always checked first - no auto-allow can bypass it
2. Auto-allow for chain-resolved commands (`$VAR` → binary) only fires when the resolved command has **no matching rules**. If rules exist (which may contain deny/ask patterns for dangerous args), normal rule evaluation runs instead.
3. Chain-local rm cleanup (`rm -rf $VAR` where VAR is chain-assigned) checks rules before allowing - if any layer's rule for `rm` has `default: deny` or an argPattern that denies the specific invocation, the handler defers to normal evaluation.

When adding new auto-allow logic, always check both `alwaysDeny` AND user rules before returning allow. The principle: auto-allow only upgrades the default "ask" for unknown commands - it never downgrades a user's explicit deny or rule-based restriction.

## Plugin Structure

- `.claude-plugin/plugin.json` - Plugin metadata
- `hooks/hooks.json` - PreToolUse hook registration targeting "Bash" matcher
- `config/warden.default.yaml` - Reference config for users to copy and customize
