# Trusted remotes

Trusted remotes auto-allow connections to known hosts, containers, and contexts. The remote command is extracted and recursively evaluated through Warden's full rule pipeline.

## Configuration

Add a `trustedRemotes` array to your `~/.claude/warden.yaml` or `.claude/warden.yaml`:

```yaml
trustedRemotes:
  - context: ssh
    name: devserver
  - context: ssh
    name: "*.internal.company.com"
  - context: docker
    name: my-app
  - context: docker
    name: dev-container
    allowAll: true
  - context: kubectl
    name: minikube
  - context: kubectl
    name: dev-cluster-*
    overrides:
      alwaysAllow: [sudo]
  - context: sprite
    name: my-sprite
  - context: fly
    name: my-fly-app
```

Each entry has a `context` (the remote type) and a `name` (the target to match).

## Supported contexts

| Context    | Commands handled                | Name matches against       |
|------------|--------------------------------|----------------------------|
| `ssh`      | `ssh`, `scp`, `rsync`          | Hostname                   |
| `docker`   | `docker exec`                  | Container name             |
| `kubectl`  | `kubectl exec`                 | `--context` flag value     |
| `sprite`   | `sprite exec`                  | Sprite name                |
| `fly`      | `fly ssh console`              | App name                   |

## How it works

1. Warden recognizes the remote command (e.g. `ssh devserver ls -la`).
2. The connection target is matched against `trustedRemotes` entries for that context.
3. If matched, the connection itself is auto-allowed.
4. The remote command (`ls -la`) is extracted and recursively parsed and evaluated through Warden's normal rule pipeline.

This means the connection is trusted, but the remote command still goes through deny/allow/rule checks.

## Name patterns

Names support glob patterns:

- `*` -- matches any characters
- `?` -- matches a single character
- `[abc]` -- matches any character in the set
- `{dev,staging}` -- matches any alternative

```yaml
trustedRemotes:
  - context: ssh
    name: "*.internal.company.com"
  - context: docker
    name: "{frontend,backend}-dev"
  - context: kubectl
    name: dev-cluster-*
```

## allowAll

Set `allowAll: true` to skip all rule evaluation for commands on that target. The remote command is allowed without further checks.

```yaml
trustedRemotes:
  - context: docker
    name: dev-container
    allowAll: true    # any command on this container is allowed
```

Use sparingly -- this bypasses all safety checks for the remote command.

## Per-target overrides

Add `overrides` to inject rules that apply only when evaluating commands on that target:

```yaml
trustedRemotes:
  - context: kubectl
    name: minikube
    overrides:
      alwaysAllow: [sudo, apt-get]
      rules:
        - command: rm
          default: allow
```

Overrides are prepended as the highest-priority config layer during remote command evaluation. They can add `alwaysAllow`, `alwaysDeny`, and `rules`.

## Global context overrides

`trustedContextOverrides` applies to all remote command evaluation, regardless of target:

```yaml
trustedContextOverrides:
  alwaysAllow: [whoami, hostname]
  alwaysDeny: [reboot]
```

These are merged into the config as the top layer whenever any trusted remote command is evaluated. Per-target overrides take priority over global context overrides.

## Context-specific notes

**SSH** -- covers `ssh`, `scp`, and `rsync`. For `scp` and `rsync`, Warden extracts the host from `[user@]host:path` arguments. If the host is trusted and no remote command is present (file transfer only), the command is allowed.

**kubectl** -- requires an explicit `--context` flag in the command. Without it, Warden cannot determine which context is being used and will not match any trusted remote entry.

**fly** -- only handles `fly ssh console`. Other `fly` subcommands fall through to regular rule evaluation.

## Legacy configuration

The following keys still work but are deprecated:

| Legacy key                   | Replacement                         |
|------------------------------|-------------------------------------|
| `trustedSSHHosts`            | `trustedRemotes` with `context: ssh` |
| `trustedDockerContainers`    | `trustedRemotes` with `context: docker` |
| `trustedKubectlContexts`     | `trustedRemotes` with `context: kubectl` |
| `trustedSprites`             | `trustedRemotes` with `context: sprite` |
| `trustedFlyApps`             | `trustedRemotes` with `context: fly` |

Legacy keys accept the same formats (string or object with `name`, `allowAll`, `overrides`) and are auto-converted internally. A deprecation warning is logged to stderr when they are used.
