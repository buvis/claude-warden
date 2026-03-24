---
description: Commit, push, and release a new version (GitHub release)
user_invocable: true
---

Perform the full release workflow for claude-warden:

## Steps

1. **Check for changes**: Run `git status` and `git diff`. If there are uncommitted changes, commit them with an appropriate conventional commit message.

2. **Determine version bump**: Look at the commits since the last release tag to decide the bump type:
   - `fix:` commits → patch bump
   - `feat:` commits → minor bump
   - Breaking changes → major bump
   - If unsure, ask the user which version bump they want (patch/minor/major).

3. **Bump version**: Update `version` in `package.json` (and `.claude-plugin/plugin.json` if it has a version field). Do NOT run `npm version` — just edit the files directly.

4. **Build**: Run `pnpm run build` to produce `dist/index.cjs`.

5. **Commit version bump**: Stage all changes and commit with message `chore: release v<new-version>`.

6. **Push**: Run `git push origin master`.

7. **Create GitHub release**: Run `gh release create v<new-version> --title "v<new-version>" --notes "<changelog>"`. Generate the changelog from commits since the last release tag.

8. **Update marketplace**: Edit `~/git/src/github.com/buvis/claude-plugins/.claude-plugin/marketplace.json` — set the warden `version` field to the new version. Commit with `chore: bump warden to v<new-version>` and push.

9. **Report**: Show the user the new version and GitHub release URL.
