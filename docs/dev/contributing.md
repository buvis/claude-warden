# Contributing

## Setup

```bash
git clone https://github.com/buvis/claude-warden.git
cd claude-warden
pnpm install
pnpm run build
```

## Development

Load from local checkout instead of marketplace:

```bash
claude --plugin-dir /path/to/claude-warden
```

After changes:

1. Rebuild: `pnpm run build`
2. Reload in running session: `/reload-plugins`

Or use watch mode:

```bash
pnpm run dev
```

## Testing

```bash
pnpm run test                                    # all tests
pnpm run test -- src/__tests__/parser.test.ts    # single file
pnpm run test:watch                              # watch mode
pnpm run typecheck                               # type checking
```

### Manual testing

Pipe hook JSON to the entry point:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"},"session_id":"test","cwd":"/tmp"}' | pnpm run eval
```

## Releasing

Releases publish via CI when a GitHub release is created - not locally.

```bash
pnpm run release           # patch bump
pnpm run release:minor     # minor bump
pnpm run release:major     # major bump
```

This bumps version, updates changelog, commits, pushes, and creates a GitHub release. CI handles npm publishing.

## Safety invariant

Auto-allow features (chain variable resolution, chain rm cleanup, trusted remotes) must never override user restrictions:

1. `alwaysDeny` always checked first - no auto-allow can bypass it
2. Chain-resolved auto-allow only fires when no matching rules exist
3. Chain-local rm checks rules before allowing

Principle: auto-allow only upgrades the default "ask" - never downgrades an explicit deny.
