# FAQ

## Warden says "ok" but I still get a permission prompt

Another plugin's hook is overriding Warden's decision. When multiple PreToolUse hooks run, Claude Code uses "most restrictive wins" - any hook returning `ask` overrides another's `allow`.

Common culprit: the `github-dev` plugin ships a `git_commit_confirm.py` hook that returns ask for every git commit.

You'll see:
```
Hook PreToolUse:Bash requires confirmation for this command:
[warden] ok
```

Fix: uninstall the conflicting plugin:
```
/plugin uninstall github-dev
```

Diagnose: check installed plugins for PreToolUse hooks targeting Bash:
```
/plugin list
```

## How do I allow a command Warden keeps prompting for?

Three options:

1. Use `/warden:allow <command>` - interactive config update
2. Add it to `alwaysAllow` in your config manually
3. Add a rule with `default: allow` for fine-grained control

See [Configuration](configuration.md) for details.

## Can I use Warden with --dangerously-skip-permissions?

Yes. Warden detects this mode and exits immediately - no overhead.

## Does Warden slow down Claude Code?

Warden typically evaluates in under 50ms. The audit log records elapsed time per evaluation if you want to check.

## How do I see what Warden decided?

Enable audit logging (on by default). Check `~/.claude/warden-audit.jsonl`. Set `auditAllowDecisions: true` to also log allowed commands.

See [Notifications & Audit](notifications-audit.md) for details.

## Can I use JSON instead of YAML for config?

Yes. Both `warden.yaml` and `warden.json` are supported at both user and project levels.

## What happens with unparseable commands?

The parser uses unbash which handles virtually all bash syntax. If a command has parse errors (e.g. unterminated quotes), it gets an `ask` decision (prompts for confirmation).

## How do I temporarily allow everything?

Use YOLO mode: `/warden:yolo session` or `/warden:yolo 5m`. See [YOLO Mode](yolo-mode.md).

## Can project config override user config?

Yes. Project config (`.claude/warden.yaml`) has higher priority than user config (`~/.claude/warden.yaml`). Layers are evaluated workspace > user > default, so a project `alwaysDeny` overrides a user `alwaysAllow` for the same command.
