---
description: Use when user wants to review warden audit log for misclassified decisions - dangerous commands that were allowed or safe commands that were needlessly blocked
user_invocable: true
---

# Audit Warden Decisions

Analyze `~/.claude/warden-audit.jsonl` to find misclassified command decisions: dangerous commands allowed, safe commands denied/asked.

## Steps

### 1. Check prerequisites

Read `~/.claude/warden.yaml` (if it exists) to check `auditAllowDecisions` setting.

- If `auditAllowDecisions` is false or missing, warn: "Allow decisions are not logged. Only deny/ask analysis is available. To enable full audit, add `auditAllowDecisions: true` to `~/.claude/warden.yaml`."
- Check that `~/.claude/warden-audit.jsonl` exists. If missing, stop with error.

### 2. Gather stats

Run these commands to get overview:
- `wc -l ~/.claude/warden-audit.jsonl` - total entries
- `grep -c '"decision":"allow"'` / `"ask"` / `"deny"` - breakdown
- `head -1` and `tail -1` to get date range from `ts` field

Report summary: "X entries (Y allow, Z ask, W deny) from DATE to DATE"

### 3. Analyze deny/ask entries (safe commands wrongly flagged)

Extract all deny and ask entries:
```
grep '"decision":"ask"\|"decision":"deny"' ~/.claude/warden-audit.jsonl
```

Read the output. Deduplicate by command + reason (ignore repeated identical entries).

For each unique entry, classify:
- **False positive** - command is clearly safe: read-only operations, standard dev tools (mkdocs, maturin, poetry, etc.), benign flags
- **Correct** - command genuinely warrants review: destructive ops, registry publish, force push, system modifications
- **Borderline** - depends on context

For false positives, provide the fix:
- If the command should always be allowed: suggest adding to `alwaysAllow` in `~/.claude/warden.yaml`
- If only certain subcommands are safe: suggest a rule with argPatterns
- Or suggest: `/warden:allow <command>`

### 4. Analyze allow entries (dangerous commands wrongly passed)

Skip this section if no allow entries exist (print the warning from step 1 again).

Pre-filter allows for suspicious patterns using grep:
```
grep '"decision":"allow"' ~/.claude/warden-audit.jsonl | grep -iE 'rm -rf|chmod 777|--force|--hard|\bdd\b|mkfs|eval |curl.*\|.*sh|wget.*\|.*sh|> /(etc|usr|var|sys)|sudo|shutdown|reboot'
```

Read the filtered results. For each match, classify:
- **Dangerous allow** - should have been blocked or prompted (e.g., `rm -rf /` allowed, curl piped to shell allowed)
- **False alarm** - pattern matched but command is safe in context (e.g., `--force` in a safe context)

For dangerous allows, suggest adding to `alwaysDeny` or adding an argPattern with `decision: deny`.

### 5. Present report

Format as:

```
## Warden Audit Report

**Period:** DATE - DATE | **Entries:** X (Y allow, Z ask, W deny)

### Dangerous commands allowed
[List with command, timestamp, and suggested fix - or "None found"]

### Safe commands unnecessarily flagged
[List grouped by command, with occurrence count and suggested fix - or "None found"]

### Suggested config changes
[Ready-to-copy yaml snippets for ~/.claude/warden.yaml]
```

If no issues found in either category, say "No misclassifications detected."
