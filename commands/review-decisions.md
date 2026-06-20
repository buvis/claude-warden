---
description: Use when user wants to review warden audit log for misclassified decisions - dangerous commands that were allowed or safe commands that were needlessly blocked
user_invocable: true
---

# Review Warden Decisions

Find misclassified warden decisions: safe commands needlessly asked/denied, and (when logged) dangerous commands that were allowed. The recurring ask/deny analysis is done deterministically by `warden suggest`; the model is reserved for the one fuzzy call code can't make - whether an *allowed* command was actually dangerous.

## Steps

### 1. Check prerequisites

Read `~/.claude/warden.yaml` (if it exists) to check `auditAllowDecisions`.

- If `auditAllowDecisions` is false or missing, warn: "Allow decisions are not logged. Only deny/ask analysis is available. To enable full audit, add `auditAllowDecisions: true` to `~/.claude/warden.yaml`."
- No need to check that the log file exists - `warden suggest` handles a missing or empty log and prints "No recurring ask/deny entries found."

### 2. Aggregate recurring ask/deny entries (deterministic - no manual counting)

Run the warden CLI's `suggest` subcommand. It reads the configured audit log (`~/.claude/warden-audit.jsonl` by default, plus the rotated `.1`), ranks recurring ask/deny commands by frequency then recency, and emits a ready-to-paste `warden.yaml` snippet - all in code, with no model call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" suggest --json
```

If `warden` is on your PATH, `warden suggest --json` is equivalent. Useful flags: `--top N` (limit the list), `--since 7d` (only recent entries), `--cwd DIR` (load a project's `.claude/warden.yaml` for its `auditPath`).

The JSON has `period {from, to}`, `totalAskDeny`, `distinctGroups`, `top[]` (each `{command, argShape, count, sampleReason, ...}`), and `snippet` (the suggested `warden.yaml` additions). These are authoritative - do not recount or regroup them.

The snippet is safety-first: only un-gated recurring asks become allow rules. Commands gated by a rule, denied, or resolved by a specialized evaluator are emitted as `# review manually` comments, never allow snippets - so a frequently-asked-but-dangerous command is flagged, not auto-allowed.

### 3. Judge allowed commands for danger (the model's job)

Skip this section when allow decisions are not logged (the warning in step 1) - `warden suggest` deliberately covers only ask/deny recurrence, never allow-danger detection.

When allows ARE logged, scan them for dangerous commands that slipped through. Pre-filter with grep:

```bash
grep '"decision":"allow"' ~/.claude/warden-audit.jsonl | grep -iE 'rm -rf|chmod 777|--force|--hard|\bdd\b|mkfs|eval |curl.*\|.*sh|wget.*\|.*sh|> /(etc|usr|var|sys)|sudo|shutdown|reboot'
```

For each match, judge (this is the fuzzy call that needs the model, not code):

- **Dangerous allow** - should have been blocked or prompted (e.g. `rm -rf /` allowed, curl piped to shell). Suggest adding to `alwaysDeny`, or an argPattern with `decision: deny`.
- **False alarm** - the pattern matched but the command is safe in context.

### 4. Present report

```
## Warden Audit Report

**Period:** {from} - {to} | **Recurring ask/deny:** {totalAskDeny} across {distinctGroups} commands

### Safe commands unnecessarily flagged (from `warden suggest`)
[The top[] groups with their counts, then the suggested `warden.yaml` snippet - or "None found"]

### Dangerous commands allowed
[Allow-danger findings from step 3 with suggested deny config - or "None found", or "allow logging disabled"]
```

If neither category has anything, say "No misclassifications detected."
