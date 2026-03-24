# Codex Export

Export Warden rules to Codex CLI's approval system (`.rules` files).

## Usage

```bash
pnpm run build
pnpm run codex:export-rules
```

Options:

- `--cwd <dir>` — workspace config to load (default: current directory)
- `--out <path>` — output path (default: `<cwd>/.codex/rules/warden.rules`)
- `--stdout` — print to stdout instead of file

Example:

```bash
node dist/codex-export.cjs --cwd . --out .codex/rules/warden.rules
```

## Output format

Starlark `prefix_rule` statements:

```
prefix_rule(pattern = ["npm"], decision = "allow", justification = "Warden: safe package manager command")
prefix_rule(pattern = ["sudo"], decision = "forbidden", justification = "Warden: always denied")
prefix_rule(pattern = ["python"], decision = "prompt", justification = "Warden: unknown command")
```

Decision mapping: allow → allow, ask → prompt, deny → forbidden.

## Limitations

- Exports command-level decisions only (no argument patterns)
- Target policies not exported
- Trusted remotes not exported
- Represents a snapshot of the effective config at export time
