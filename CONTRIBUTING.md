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

npm publishing happens via CI when a GitHub release is created. The version bump itself runs locally through the shared release script in [buvis/claude-plugins](https://github.com/buvis/claude-plugins) (`scripts/release-plugin`), so clone that repo beside this one first:

```bash
git clone git@github.com:buvis/claude-plugins.git ../claude-plugins
```

```bash
pnpm run release           # patch bump
pnpm run release:minor     # minor bump
pnpm run release:major     # major bump
```

This runs the checks, bumps the version, updates the changelog, builds `dist/`, commits, tags `vX.Y.Z`, pushes, and bumps warden's entry in the central marketplace. Then create a GitHub release manually:

```bash
gh release create vX.Y.Z --target master --title "vX.Y.Z" --notes "..."
```

CI publishes to npm when the release is created.
