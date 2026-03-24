# Configuration

## Config files

Warden looks for config in two locations:

| Scope | Path |
|-------|------|
| User | `~/.claude/warden.yaml` (or `.json`) |
| Project | `.claude/warden.yaml` (or `.json`) |

Copy `config/warden.default.yaml` from the plugin as a starting point.

## Config priority

Three layers are evaluated in order: **project > user > built-in defaults**.

Within each layer, `alwaysDeny` is checked before `alwaysAllow`. The first layer with a matching entry wins.

**Examples:**

- Project `alwaysDeny` for `curl` overrides user `alwaysAllow` for `curl`
- User `alwaysAllow` for `sudo` overrides the built-in `alwaysDeny` for `sudo`
- Project rule for `npm` overrides the built-in rule for `npm`

## Full evaluation order

For each command in a pipeline or chain:

1. Global deny patterns (unparseable commands, subshells when `askOnSubshell` is on)
2. `alwaysDeny` — first layer match wins
3. `alwaysAllow` — first layer match wins
4. Chain-local auto-allow (resolved `$VAR` commands with no matching rules)
5. Target policies (path, database, endpoint)
6. Command-specific rules with argPattern matching
7. `defaultDecision` (fallback for unknown commands)

For pipelines and chains, per-command results are combined: any deny makes the whole chain deny, any ask makes it ask, all allow makes it allow.

## Global options

```yaml
# Default decision for commands not covered by any rule
defaultDecision: ask          # allow | deny | ask

# Trigger "ask" for commands containing $() or backticks
askOnSubshell: true

# OS notifications (macOS: terminal-notifier or osascript, Linux: notify-send)
notifyOnAsk: true
notifyOnDeny: true

# Audit logging
audit: true
auditPath: ~/.claude/warden-audit.jsonl
auditAllowDecisions: false    # also log allow decisions (default: only ask/deny)
```

## alwaysAllow / alwaysDeny

Lists of command names or glob patterns. Commands in these lists skip rule evaluation entirely.

```yaml
alwaysAllow:
  - terraform
  - flyctl
  - ~/.claude/skills/**      # glob: all scripts under this path

alwaysDeny:
  - nc
  - ncat
```

### Glob syntax

Glob patterns work in `alwaysAllow`, `alwaysDeny`, and trusted remote name matching.

| Pattern | Meaning |
|---------|---------|
| `*` | Single path segment (no `/`) |
| `**` | Any depth (crosses `/`) |
| `?` | Single character |
| `[abc]` | Character class |
| `[!abc]` | Negated character class |
| `{a,b,c}` | Alternatives |

Path-based entries (containing `/`) match the full command path. Bare names match the basename only.

```yaml
alwaysAllow:
  - ~/.claude/skills/**        # matches /Users/you/.claude/skills/foo/bar.sh
  - my-tool                    # matches "my-tool" regardless of path
  - /usr/local/bin/safe-*      # matches any command starting with safe- in that dir
```

## Rules

Per-command rules give fine-grained control with argument pattern matching.

```yaml
rules:
  - command: docker
    default: ask
    argPatterns:
      - match:
          anyArgMatches: ['^(ps|images|logs)$']
        decision: allow
        description: Read-only docker commands
      - match:
          anyArgMatches: ['^(rm|rmi)$']
        decision: deny
        reason: Destructive docker operations blocked
```

### Rule fields

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Command name to match (basename, not arguments) |
| `default` | `allow` / `deny` / `ask` | Decision when no argPattern matches |
| `argPatterns` | list | Ordered list of argument matchers (first match wins) |
| `override` | boolean | If `true`, completely replaces lower-layer rules instead of merging |

### Match conditions

Each argPattern has a `match` object with one or more conditions. All specified conditions must be true (AND logic).

| Condition | Type | Description |
|-----------|------|-------------|
| `argsMatch` | `[regex]` | Regex tested against all args joined with a space |
| `anyArgMatches` | `[regex]` | Regex tested against each arg individually; true if any matches |
| `noArgs` | `true` | Matches when the command has no arguments |
| `argCount` | `{min: N, max: N}` | Argument count constraints (both optional) |
| `not` | `true` | Negate the entire condition |

Each argPattern also carries:

| Field | Type | Description |
|-------|------|-------------|
| `decision` | `allow` / `deny` / `ask` | What to do on match |
| `description` | string | Optional, for readability |
| `reason` | string | Optional, shown to user on deny |

### Rule merging across layers

Rules for the same command are **merged** across layers by default:

- The `default` decision comes from the highest-priority layer
- `argPatterns` from all layers are concatenated in priority order (project first, then user, then built-in)
- First matching argPattern wins

If a rule has `override: true`, lower-layer rules for that command are completely ignored (no merging).

```yaml
# Project .claude/warden.yaml — override built-in npm rules entirely
rules:
  - command: npm
    default: allow
    override: true
```

### Important: rules match by command name

Rules match the command being executed, **not** its arguments. When Claude runs `python -c "import foo"`, warden looks up rules for `python` — not `bash` or `sh`.

Shell script invocations like `bash script.sh` are evaluated as the script (basename `script.sh`), not as `bash`. Use `alwaysAllow` with glob patterns for script paths.

## Trusted remotes

Control how commands are evaluated inside remote execution contexts (SSH, Docker, kubectl, Sprite, Fly.io).

```yaml
trustedRemotes:
  - context: ssh
    name: devserver
  - context: ssh
    name: "staging-*"           # glob pattern
  - context: docker
    name: my-app
  - context: docker
    name: dev-container
    allowAll: true              # skip all checks for this container
  - context: kubectl
    name: minikube
  - context: kubectl
    name: "dev-cluster-*"
    overrides:                  # per-target rule overrides
      alwaysAllow: [sudo]
  - context: sprite
    name: my-sprite
  - context: fly
    name: my-fly-app
```

| Field | Type | Description |
|-------|------|-------------|
| `context` | `ssh` / `docker` / `kubectl` / `sprite` / `fly` | Remote type |
| `name` | string | Target name (supports glob `*` wildcards) |
| `allowAll` | boolean | Skip all checks for this target |
| `overrides` | object | Layer overrides (`alwaysAllow`, `alwaysDeny`, `rules`) for this target |

Commands on trusted remotes are recursively parsed and evaluated through normal warden rules.

### trustedContextOverrides

Global overrides applied as the highest-priority layer when evaluating any remote command.

```yaml
trustedContextOverrides:
  alwaysAllow:
    - sudo
    - apt
    - apt-get
  alwaysDeny: []
  rules: []
```

!!! note "Legacy keys"
    `trustedSSHHosts`, `trustedDockerContainers`, `trustedKubectlContexts`, `trustedSprites`, and `trustedFlyApps` still work but emit a deprecation warning. Migrate to `trustedRemotes` with the `context` field.

## Target policies

Evaluate commands by their targets — filesystem paths, database connections, or HTTP endpoints — not just command names.

```yaml
targetPolicies:
  - type: path
    path: /tmp
    decision: allow
  - type: path
    path: "{{cwd}}/node_modules"
    decision: allow
  - type: path
    path: ~/.ssh
    decision: deny
  - type: database
    host: localhost
    database: "test_*"
    decision: allow
  - type: database
    host: "*.prod.*"
    decision: deny
  - type: endpoint
    pattern: "https://api.dev.example.com/*"
    decision: allow
  - type: endpoint
    pattern: "https://*.prod.*"
    decision: deny
```

When multiple policies match, the most restrictive wins (deny > ask > allow).

### Path policies

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | required | Filesystem path (supports `~`, `{{cwd}}`, globs) |
| `decision` | `allow` / `deny` / `ask` | required | |
| `recursive` | boolean | `true` | Match subdirectories |
| `allowAll` | boolean | `false` | Any command targeting this path |
| `commands` | `[string]` | all | Restrict policy to specific commands |
| `reason` | string | | Shown to user on deny |

### Database policies

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | required | Hostname (supports globs) |
| `database` | string | | Database name (supports globs) |
| `port` | number | | Port number |
| `decision` | `allow` / `deny` / `ask` | required | |
| `commands` | `[string]` | all | Restrict policy to specific commands |
| `reason` | string | | Shown to user on deny |

### Endpoint policies

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pattern` | string | required | URL pattern (supports globs) |
| `decision` | `allow` / `deny` / `ask` | required | |
| `commands` | `[string]` | all | Restrict policy to specific commands |
| `reason` | string | | Shown to user on deny |

## Complete example

```yaml
defaultDecision: ask
askOnSubshell: true
notifyOnAsk: true
notifyOnDeny: true
audit: true

alwaysAllow:
  - terraform
  - flyctl
  - ~/.claude/skills/**

alwaysDeny:
  - nc

trustedRemotes:
  - context: ssh
    name: devserver
  - context: docker
    name: dev-container
    allowAll: true

trustedContextOverrides:
  alwaysAllow: [sudo, apt]

targetPolicies:
  - type: path
    path: "{{cwd}}/node_modules"
    decision: allow
  - type: path
    path: ~/.ssh
    decision: deny

rules:
  - command: npx
    default: allow
  - command: docker
    default: ask
    argPatterns:
      - match:
          anyArgMatches: ['^(ps|images|logs)$']
        decision: allow
        description: Read-only docker commands
  - command: python
    default: ask
    argPatterns:
      - match:
          anyArgMatches: ['^-c$']
        decision: allow
        description: Allow inline scripts
      - match:
          noArgs: true
        decision: allow
        description: Allow bare REPL
```
