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

**Pipeline**: `index.ts` → `parser.ts` → `evaluator.ts` (which delegates to `remote-exec.ts` / `subcommand-runner.ts` / `script-eval.ts`, with config from `rules.ts` + `defaults.ts`, target policies from `targets.ts`)

**Command extraction split** (the principle for where logic lives): *syntactic* extraction — pipes, chains, control flow, subshells, `sh -c` quoting — happens in `parser.ts` (it needs the AST). *Semantic* delegation — which flags consume values for xargs/uv/npx, trusted-target gating for remotes — happens in the evaluator's specialized modules. Parser produces the syntactic command list; the evaluator resolves inner commands.

- `src/parser.ts` - AST-based shell command parser using unbash. Walks the AST to extract commands from pipes, chains, control flow (while/if/for/case/functions). Extracts env prefixes, normalizes command paths to basename. Recursively parses `-c` arguments for all POSIX shells in `SHELL_INTERPRETERS` (sh/bash/zsh/dash/ksh/mksh/ash). Extracts script path from `<shell> script.sh` invocations across the same set (evaluates script, not shell). Detects subshells, process substitutions, and heredocs. Tracks chain-scoped variable assignments (`VAR=value && ...`) and resolves `$VAR` in command position.
- `src/evaluator.ts` - Decision engine. The hierarchy is an explicit ordered list of `DecisionLayer` functions evaluated in `evaluateCommand` (first non-null decision wins): `PRE_LAYERS` (scopedAlwaysPolicy → targetPolicyLayer) → `AUTO_ALLOW_LAYERS` (chainResolvedBinary, localBinary, tempDirRm, chainLocalRm — skipped entirely under `defaultDecision: 'deny'`) → `RESOLVE_LAYERS` (specialized evaluators → command rules) → configured default. Chain-resolved provenance (`resolvedFrom`) is stamped uniformly on every decision. For pipelines/chains, `evaluate` combines per-command results (any deny → deny, any ask → ask, all allow → allow).
- `src/remote-exec.ts` - Trusted-remote evaluators (ssh/scp/rsync, docker, kubectl, sprite, fly). Each parses its CLI grammar to extract a target + inner command, matches the target against `trustedRemotes`, then recursively evaluates the inner command under context overrides. Entry point: `tryRemoteExec`.
- `src/subcommand-runner.ts` - Wrapper commands that delegate to an inner command: uv run, xargs, find -exec, npx/bunx/pnpx. Entry point: `trySubcommandRunner`.
- `src/script-eval.ts` - Script-safety evaluators for python/node/perl/ruby/php: inline code (`-c`/`-e`/`-r`), script files, modules, REPL. Scans content via `script-scanner.ts`. Entry point: `tryScriptEval`.
- `src/script-scanner.ts` - Content scanner: regex pattern tables per language (python/typescript/perl/ruby/php). `scanScriptCode` returns a four-way `Verdict` (`dangerous` | `cautious` | `safe` | `unknown`), checked in order: danger tables → cautious tables → evasion signals → positive safe-shape allowlist → `unknown`. **`safe` is positive evidence, never the absence of a bad match** — it requires every statement to match a recognized read-only/print/compute/stdlib-parse shape with no danger pattern and no evasion signal. Evasion signals (`getattr`, `chr(`, `globalThis[...]`, dynamic `require` with a non-literal argument) cap the verdict at `unknown`. Dangerous sinks (`importlib`/`__import__`, `new Function`, bare `eval`/`exec`, decode-then-`exec`) return `dangerous` — a stricter tier, but still resolves to ask. Anything unrecognized is `unknown`, not `safe`. Heuristic, best-effort. **Only `safe` upgrades ask→allow (this is the load-bearing security boundary: allow now requires positive evidence); `unknown`/`cautious`/`dangerous` fall through to ask. The ask path remains a nudge, not a guarantee — trivial obfuscation still resolves to `unknown` (ask), not silent allow.**
- `src/args.ts` - Shared arg helpers: `makeCommand` (build a bare ParsedCommand) and `skipLeadingFlags` (flag-walker for uv/npx).
- `src/stdin.ts` - Shared `readStdin` (size-guarded) for the `index.ts` and `copilot.ts` hook entry points.
- `src/defaults.ts` - Built-in rules for ~100 common dev commands. Three tiers: always-allow (cat, ls, grep...), always-deny (sudo, shutdown...), conditional (node, npx, git, docker... with argument-aware patterns).
- `src/glob.ts` - Glob-to-regex conversion. `globToRegex` (general: `*`, `?`, `[...]`, `{a,b,c}`) and `pathGlobToRegex` (path-aware: `*` = single segment, `**` = any depth). Both share one `globToRegexString(pattern, pathAware)` builder.
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

Use `dev/bin/release [patch|minor|major]`. The script bumps `package.json`, syncs `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, stamps `CHANGELOG.md` (replaces `[Unreleased]` heading with the version + date), builds `dist/`, commits as `chore: release vX.Y.Z`, pushes, then bumps the sibling marketplace repo at `../claude-plugins` and pushes that. CI publishes to npm via OIDC.

**Do not pre-bump versions or pre-stamp the changelog.** The release script does both. Land feature commits with the entry under `[Unreleased]` and a clean working tree, then run the script.

**Burned npm versions:** v3.0.0 was published to npm by mistake and can never be reused. When versioning reaches v3, start from v3.0.1.

**Version bumps require explicit user approval.** Never change the major or minor version without asking first.

## Safety invariant for auto-allow features

The evaluator has features that auto-allow commands without user prompts (chain-local variable resolution, local binary detection, chain-local rm cleanup, temp-dir rm cleanup). These must never override user-configured restrictions. The invariant is now **structural**, expressed by the layer ordering in `evaluateCommand` rather than scattered guards:

1. `PRE_LAYERS` (scopedAlwaysPolicy, including `alwaysDeny`) is always evaluated first — no auto-allow can bypass it.
2. The `AUTO_ALLOW_LAYERS` group is **skipped entirely** when `config.defaultDecision === 'deny'` (one gate in `evaluateCommand`, not a guard in each layer). This is why the individual auto-allow functions no longer check `defaultDecision` themselves.
3. Auto-allow for chain-resolved commands (`$VAR` → binary) only fires when the resolved command has **no matching rules** (`collectMergedRule` returns null). If rules exist (which may contain deny/ask patterns for dangerous args), the layer defers and `commandRulesLayer` runs.
4. Chain-local rm cleanup (`rm -rf $VAR`) and temp-dir rm cleanup check rules before allowing — if any layer's rule for `rm` has `default: deny` or an argPattern that denies the specific invocation, they return null and defer to `commandRulesLayer`.

When adding a new auto-allow rung, add it to `AUTO_ALLOW_LAYERS` (so it inherits the default-deny gate) and have it return null when `collectMergedRule` matches. The principle: auto-allow only upgrades the default "ask" for unknown commands — it never downgrades a user's explicit deny or rule-based restriction. Note that the **specialized evaluators** (`RESOLVE_LAYERS`) are not auto-allow defaults; they run regardless of `defaultDecision` and produce real evaluations (e.g. a safe script → allow, a dangerous one → ask).

## Plugin Structure

- `.claude-plugin/plugin.json` - Plugin metadata
- `hooks/hooks.json` - PreToolUse hook registration targeting "Bash" matcher
- `config/warden.default.yaml` - Reference config for users to copy and customize
