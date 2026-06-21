---
description: Use when warden blocks or allows a command unexpectedly, or after installing/updating the plugin - checks the full decision chain (native permissions, hook registration, binary, config, audit, version sync) and names each failure with a fix
user_invocable: true
---

# Diagnose Warden Setup

Check every link between "Claude calls Bash" and "Warden answers", and name the broken one with a concrete fix. All detection is deterministic and lives in `warden diagnose`; the model only runs the check and explains the results.

## Steps

### 1. Run the diagnostics

Run the warden CLI's `diagnose` subcommand with `--json`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" diagnose --json
```

If `warden` is on your PATH, `warden diagnose --json` (or its alias `warden doctor --json`) is equivalent. Useful flag: `--cwd DIR` to inspect a specific project's `.claude/settings.json` and `.claude/warden.yaml`.

The JSON is `{ checks: [{ id, status, detail, fix? }] }`, one entry per chain link in evaluation order: `native-permissions`, `hook-registration`, `binary`, `config-health`, `audit-writable`, `pipeline-probe`, `version-sync`. The exit code is `0` when the setup is healthy and `1` when any check is `fail` or `unknown`. These results are authoritative - do not re-derive them.

### 2. Explain the results

Status meanings:

- `pass` - link is healthy, nothing to do.
- `fail` - the link is broken and blocks correct operation. Apply the check's `fix`.
- `unknown` - the link could not be inspected (e.g. a malformed file or layout drift). Treat as a problem: surface the `detail` and `fix`; do not assume it is fine.
- `warn` - advisory; worth fixing but not blocking (e.g. version-stamp drift, a missing audit directory).
- `info` - informational (e.g. a `Bash(*)` allow entry, the recommended delegating setup).
- `skip` - the check does not apply here (e.g. version-sync outside the source tree).

For every `fail` and `unknown`, walk the user through its `detail` and `fix` in chain order - the first broken link is usually the culprit. The most common one: a `Bash(...)` entry in `permissions.deny`/`ask` of a `settings.json`, which runs before Warden's hook and shadows it (native permissions are not Warden's domain - Warden is the single authority for Bash policy). Then surface `warn` items as follow-ups.

### 3. Note the live-session caveat

A healthy report means the files on disk and the in-process probe are correct. It does not prove the currently running session loaded this binary - plugin changes apply after a Claude Code restart. If checks pass but behavior is still wrong, advise restarting Claude Code.
