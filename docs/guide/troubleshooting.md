# Troubleshooting

When Warden blocks or allows a command unexpectedly, the cause is usually a broken link in the chain between "Claude calls Bash" and "Warden answers" - and most of those links live outside Warden itself.

Run the diagnostics first:

```bash
/warden:diagnose
```

or, from a shell:

```bash
warden diagnose          # human-readable checklist
warden diagnose --json   # machine-readable, for scripts
```

It checks every link below in order and names the broken one with a fix. Exit code is `0` when healthy, `1` when any check fails or cannot be inspected. The sections below explain each link in the same order the chain runs, so work top to bottom - the first failure is usually the culprit.

!!! warning "A clean report is not proof a live session uses this binary"
    Plugin changes apply only after a Claude Code restart. If every check passes but behavior is still wrong, restart Claude Code and try again.

## 1. Native permissions shadow Warden

**The most common and most expensive trap.** Claude Code's own permissions in a `settings.json` run *before* any PreToolUse hook. A `Bash(...)` entry in `permissions.deny` or `permissions.ask` blocks or prompts for a command before Warden ever sees it - no Warden evaluation, no audit entry, no clue why.

Warden is meant to be the single authority for Bash policy, so native Bash rules should not exist at all.

`warden diagnose` reports `native-permissions` as **fail** and names the offending file and entry. It checks:

- `~/.claude/settings.json`
- `<project>/.claude/settings.json`
- `<project>/.claude/settings.local.json`

**Fix:** remove the named `Bash(...)` entry from `permissions.deny`/`permissions.ask`. A `Bash(*)` entry in `permissions.allow` is fine and recommended - it delegates all Bash policy to Warden, and diagnose reports it as info, not a failure.

## 2. The hook is not registered

After installing or updating the plugin, its PreToolUse Bash hook may not be registered - so Warden never runs.

`warden diagnose` reports `hook-registration` as **fail** when the plugin is found but its `hooks/hooks.json` has no `PreToolUse` entry with a `Bash` matcher pointing at `dist/index.cjs`, and **unknown** when `hooks.json` cannot be parsed. When run from a dev checkout it inspects the local source tree and says so.

**Fix:** reinstall or repair the plugin so the Bash hook is registered, then restart Claude Code.

## 3. The binary is missing or stale

The hook runs `dist/index.cjs`. If that file is missing or empty, every Bash command falls through with no evaluation.

`warden diagnose` reports `binary` as **fail** when `dist/index.cjs` is absent or zero bytes.

**Fix:** in a dev checkout, run `pnpm run build`. For an installed plugin, reinstall it.

## 4. The config cannot be parsed

In hook mode Warden is quiet, so an unparseable `warden.yaml` fails silently - the bad config is dropped and you get default behavior with no warning.

`warden diagnose` reports `config-health` as **fail** on a parse error (naming the file and message) and **warn** on non-fatal problems like unknown keys (with "did you mean" suggestions). Other checks still run regardless.

**Fix:** correct the YAML/JSON syntax in the reported file. For a deeper config audit, run [`warden validate`](configuration.md).

## 5. The audit log is not writable

Warden silently drops audit entries it cannot write, so a misconfigured `auditPath` leaves you with no record of decisions.

`warden diagnose` reports `audit-writable` as **fail** when the audit directory exists but is not writable, **warn** when it does not exist, and **unknown** when writability cannot be determined.

**Fix:** make the directory writable, create it, or correct `auditPath` in your config. See [Notifications & Audit](notifications-audit.md).

## 6. The pipeline does not answer

An in-process probe runs a known-safe command (`echo ...`) against Warden's default config and expects `allow`. If it returns anything else or throws, the parser/evaluator/defaults chain is broken.

`warden diagnose` reports `pipeline-probe` as **fail** in that case.

**Fix:** this indicates a broken or corrupt install - reinstall the plugin (or rebuild in a dev checkout).

## 7. Version stamps drift

The version in `package.json`, `.claude-plugin/plugin.json`, and the marketplace repo can fall out of sync - usually a half-finished release.

`warden diagnose` reports `version-sync` as **warn** when reachable stamps disagree, **unknown** when a stamp file is present but unparseable, and **skip** outside the source tree (so it never warns on a user's machine).

**Fix:** resync the stamps. The release script `dev/bin/release` does this as part of cutting a release.

## Still stuck?

See the [FAQ](faq.md) for hook-conflict and prompt-override issues that sit outside this chain - for example, another plugin's PreToolUse hook overriding Warden's `allow` with an `ask`.
