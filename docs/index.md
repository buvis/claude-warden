# Claude Warden

Claude Code's permission system is all-or-nothing. Every Bash command triggers a prompt, or you allow everything blindly. Warden sits in between — it parses each command, evaluates it against configurable safety rules, and decides automatically: allow, prompt, or deny.

## How it works

Warden hooks into Claude Code's PreToolUse event. When Claude runs a Bash command, Warden:

1. **Parses** the command into individual parts — splitting pipes, chains (`&&`, `||`, `;`), unwrapping shell wrappers (`sh -c "..."`), resolving env prefixes and subshells
2. **Evaluates** each part against argument-aware rules — `git status` is safe, `git push --force` is not
3. **Returns** a decision — allow silently, prompt the user, or deny with feedback

## Before and after

| Command | Without Warden | With Warden |
|---------|---------------|-------------|
| `ls -la` | Prompted | Auto-allowed |
| `cat file \| grep pattern \| wc -l` | Prompted | Auto-allowed (3 safe commands) |
| `npm run build && npm test` | Prompted | Auto-allowed |
| `git push --force origin main` | Prompted | Prompted (force push is risky) |
| `sudo rm -rf /` | Prompted | Auto-denied (sudo is blocked) |
| `ssh devserver cat /etc/hosts` | Prompted | Auto-allowed (trusted host + safe cmd) |

## Capabilities

- **Pipe and chain decomposition** — each command in a pipeline or chain is evaluated independently
- **Argument-aware rules** — same binary, different decisions based on arguments
- **Recursive evaluation** — remote commands via `ssh`, `docker exec`, `kubectl exec` are parsed and evaluated too
- **Shell wrapper unwrapping** — `sh -c "..."`, `bash -c "..."` are expanded and evaluated
- **Env prefix handling** — `NODE_ENV=test node app.js` evaluates `node`, not the env assignment
- **Subshell evaluation** — `$()` and backtick expressions are parsed
- **Deny feedback** — blocked commands include config hints so you know how to adjust rules
- **100+ commands** auto-approved out of the box with sensible defaults

## Get started

[Getting Started](guide/getting-started.md){ .md-button .md-button--primary }
