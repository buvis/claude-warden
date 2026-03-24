# Target policies

Target policies evaluate commands by what they target -- a filesystem path, database connection, or HTTP endpoint -- not just the command name.

## Configuration

Add `targetPolicies` to your `~/.claude/warden.yaml` or `.claude/warden.yaml`:

```yaml
targetPolicies:
  - type: path
    path: /tmp
    decision: allow
  - type: database
    host: localhost
    decision: allow
  - type: endpoint
    pattern: "https://api.dev.example.com/*"
    decision: allow
```

Each policy requires a `type` and a `decision` (`allow`, `deny`, or `ask`).

## Path policies

Match commands that operate on filesystem paths.

```yaml
targetPolicies:
  - type: path
    path: /tmp
    decision: allow
    allowAll: true
  - type: path
    path: "{{cwd}}/node_modules"
    decision: allow
  - type: path
    path: ~/.ssh
    decision: deny
```

**Path expansion:**

- `~` expands to the user's home directory
- `{{cwd}}` expands to the current working directory

**Glob patterns** are supported in the path value: `*`, `**`, `?`, `[...]`, `{a,b,c}`. When using path globs, `*` matches a single path segment and `**` matches any depth.

**Recursive matching:** `recursive: true` (the default) matches the path and all its descendants. Set `recursive: false` to match only the exact path.

```yaml
targetPolicies:
  - type: path
    path: /etc/hosts
    decision: deny
    recursive: false    # only /etc/hosts, not /etc/hosts.bak
```

**Default commands:** `rm`, `chmod`, `chown`, `cp`, `mv`, `tee`, `mkdir`, `rmdir`, `touch`, `ln`.

Set `allowAll: true` to match any command targeting the path, not just the defaults.

Override the command list with `commands`:

```yaml
targetPolicies:
  - type: path
    path: "{{cwd}}/dist"
    decision: allow
    commands: [rm, cp, mv, mkdir]
```

## Database policies

Match commands that connect to databases.

```yaml
targetPolicies:
  - type: database
    host: localhost
    database: "test_*"
    decision: allow
  - type: database
    host: "*.prod.*"
    decision: deny
```

**Connection parsing:** Warden extracts connection info from:

- Flags: `-h host`, `-p port`, `-d database`, `--host`, `--port`, `--dbname`
- URIs: `postgresql://`, `postgres://`, `mongodb://`, `redis://`, `mysql://`, `mariadb://`

**Matching fields:**

- `host` (required) -- glob pattern matched against the target host
- `port` -- exact match
- `database` -- glob pattern matched against the database name

All specified fields must match. Unspecified fields are not checked.

**Default commands:** `psql`, `mysql`, `mariadb`, `redis-cli`, `mongosh`, `mongo`, `pg_dump`, `mysqldump`, `mongodump`.

## Endpoint policies

Match commands that make HTTP requests.

```yaml
targetPolicies:
  - type: endpoint
    pattern: "https://api.dev.example.com/*"
    decision: allow
  - type: endpoint
    pattern: "https://*.prod.*"
    decision: deny
```

**URL extraction:** Warden finds URLs from positional arguments (`http://...`, `https://...`) and `--url` flags.

**Pattern matching:** The `pattern` is a glob matched against the full URL.

**Default commands:** `curl`, `wget`, `http`, `httpie`.

## Matching behavior

**Most restrictive wins.** When multiple policies match the same command, the strictest decision applies: `deny` beats `ask` beats `allow`.

**Config merging.** Policies from user config (`~/.claude/warden.yaml`) and project config (`.claude/warden.yaml`) are concatenated. Both sets are evaluated together.

**Custom reason.** Add a `reason` field to any policy for a descriptive message in the evaluation output:

```yaml
targetPolicies:
  - type: database
    host: "*.prod.*"
    decision: deny
    reason: "Production database access blocked"
```

**Invalid patterns.** If a glob pattern fails to compile, a warning is logged to stderr and the policy is treated as no match (not as a deny).
