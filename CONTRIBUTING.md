# Contributing

## Setup

```bash
git clone https://github.com/buvis/claude-warden.git
cd claude-warden
pnpm install
pnpm run build
```

## Development

Load the plugin from your local checkout instead of the marketplace:

```bash
claude --plugin-dir /path/to/claude-warden
```

This bypasses the marketplace cache and runs your local `dist/index.cjs` directly. The `--plugin-dir` version takes precedence over any installed marketplace version.

After making changes:

1. Rebuild: `pnpm run build`
2. Reload in a running session: `/reload-plugins`

Or use watch mode to rebuild on save:

```bash
pnpm run dev
```

## Testing

```bash
pnpm run test              # run all tests
pnpm run test -- src/__tests__/parser.test.ts  # single file
pnpm run test:watch        # watch mode
pnpm run typecheck         # type checking
```

### Manual testing

Pipe hook JSON to the built entry point:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"},"session_id":"test","cwd":"/tmp"}' | pnpm run eval
```

## Releasing

Releases are published via CI when a GitHub release is created — not locally.

```bash
pnpm run release           # patch bump
pnpm run release:minor     # minor bump
pnpm run release:major     # major bump
```

This bumps the version, updates the changelog, commits, pushes, and creates a GitHub release. The CI workflow handles npm publishing.
