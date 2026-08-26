# Write-Scope Fence

An unattended run (an autopilot batch) has nobody watching, so its blast radius has to be bounded by construction. The write-scope fence denies any Bash command that would write outside the session's scope while a batch is armed. Reads are never touched.

It is the Bash half of a two-point fence. The other half, `~/.claude/hooks/enforce_write_scope.py`, gates the structured edit tools (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`) with the same arming contract, the same root set, and the same deny wording. A parity test beside that hook fails when the two drift.

## Arming

The fence reads three environment variables and nothing from `warden.yaml`:

| State | `CLAUDE_UNATTENDED` | `_AUTOPILOT_WRITE_SCOPE` | Effect |
|---|---|---|---|
| interactive | unset or not `1` | any | inert, silent |
| disarmed batch | `1` | `off` | inert, prints `[warden] write-scope fence disarmed by _AUTOPILOT_WRITE_SCOPE=off` on stderr for every command |
| armed batch | `1` | anything else | enforce |

The autopilot loop exports `CLAUDE_UNATTENDED=1` for every session it spawns. Set `_AUTOPILOT_WRITE_SCOPE=off` for one batch to disarm it; widen the scope instead with `_AUTOPILOT_WRITE_SCOPE_EXTRA`.

## Allowed roots

Every root is realpath'd (so a symlinked `dev/local` resolves to its target), `$HOME` and its ancestors never grant scope, and duplicates are dropped. In order:

1. The session repo: the nearest ancestor of the session cwd that holds `dev/local/autopilot`, searched below `$HOME` only; the cwd itself when none does.
2. `<repo>/dev/local`
3. `$TMPDIR`, when set
4. `/tmp`
5. Each `:`-joined entry of `_AUTOPILOT_WRITE_SCOPE_EXTRA` (`~` expands)

A write target is resolved the same way (`~` expanded, relative paths anchored at the cwd the chain reached, realpath'd) and must land inside one root. The deny reason names the resolved path and every root:

```
BLOCKED: autopilot write-scope fence: '/Users/me/other-repo/x.py' is outside the allowed scope ('/Users/me/repo', '/Users/me/repo/dev/local', '/private/tmp'). Write inside the session's repo, its dev/local, or a temp dir; add a root via _AUTOPILOT_WRITE_SCOPE_EXTRA, or set _AUTOPILOT_WRITE_SCOPE=off to disarm.
```

## Covered write vectors

Coverage is a named list. Anything not on it is a known gap, not a covered case.

- Redirects on any command: `>`, `>>`, `>|`, `&>`, `&>>`, `<>`, `>&file`, including fd-numbered forms (`2> file`). Fd duplications (`2>&1`, `>&-`) and `/dev/*` targets are not writes. A redirect on a compound statement (`{ ...; } > f`, `for ...; done > f`) counts for every command inside it, and `bash -c "..."` bodies are inspected.
- Every positional argument of `tee`, `mkdir`, `touch`, `rm`, `rmdir`.
- The destination of `cp`, `mv`, `ln`, `install` (the last positional, or `-t DIR`; every positional for `install -d`).
- The files of `sed -i` / `sed --in-place`, in both the BSD (`-i ''`) and GNU (`-i.bak`, `-e`) spellings. The script argument is never treated as a file.
- `dd of=FILE`.

A write target that still contains a shell expression after `$VAR` expansion from the environment (`$(...)`, an unset variable, backticks) is denied as unresolvable rather than guessed at. Use literal paths in a batch.

### Known gaps

These write paths are gated by neither half of the fence:

- Interpreter programs: `python3 script.py`, `python3 -c ...`, `node -e ...`, and anything else that opens a file from inside a program (warden's script scanner judges danger, not location).
- `git` writing to another repo (`git -C /other commit`), `gh`, and other tools that write through their own path arguments.
- Archive and sync tools: `tar -C`, `unzip -d`, `rsync`, `zip`, `patch`.
- In-place editors other than `sed`: `perl -i`, `ruby -i`, `awk -i inplace`.
- `curl -o` / `wget -O` output files.
- Anything reached through an MCP tool rather than Bash or the four edit tools.

## Where it sits

The fence is evaluated before every allowlist, so an `echo`, `cp`, or `sed` in `alwaysAllow` is still fenced. It is a scope bound, not a permission: `/warden:yolo` does not lift it, and `WARDEN_UNATTENDED` is a separate knob (it turns `ask` into `deny`; see [YOLO Mode](yolo-mode.md) for the opposite direction).
