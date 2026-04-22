---
description: Commit, push, and release a new version (npm publish + GitHub release)
user_invocable: true
---

Perform the full release workflow for claude-warden:

## Constraints

- **Do not use `grep` or `find -name` in Bash** — use `rg` (ripgrep) or the Glob/Grep tools. A PreToolUse hook blocks these.
- **`main` is protected** — direct `git push origin main` is rejected. All changes must land via a PR.
- **npm publishing is handled by CI** — the `publish.yml` workflow triggers on `release: published` and uses OIDC trusted publishing. Do NOT run `pnpm publish` / `npm publish` locally; it will fail or conflict.

## Steps

1. **Check for changes**: Run `git status` and `git log`. If there are uncommitted changes, commit them with an appropriate conventional commit message first.

2. **Determine version bump**: Compare `git describe --tags --abbrev=0` with `git log <tag>..HEAD --oneline` to decide:
   - `fix:` / `chore:` / `docs:` only → patch bump
   - Any `feat:` commit → minor bump
   - Breaking change (`feat!:`, `BREAKING CHANGE:`) → major bump (always confirm with user first)
   - If unsure, ask the user.

3. **Bump version**: Edit `version` in both `package.json` and `.claude-plugin/plugin.json` directly with the Edit tool. Do NOT run `npm version` or `pnpm version`.

4. **Build**: Run `pnpm run build` to produce `dist/*.cjs`.

5. **Create release branch**: `main` is protected, so:
   - `git checkout -b release/v<new-version>`
   - `git add -A && git commit -m "<new-version>"` (e.g., `2.7.0`)
   - `git push -u origin release/v<new-version>`

6. **Open and merge PR**:
   - `gh pr create --base main --head release/v<new-version> --title "chore: release v<new-version>" --body "<changelog>"`
   - `gh pr merge <pr-number> --merge --admin` (use `--admin` to bypass required checks if needed)
   - `git checkout main && git fetch origin && git reset --hard origin/main`

7. **Create GitHub release**: `gh release create v<new-version> --target main --title "v<new-version>" --notes "<changelog>"`. Generate the changelog from commits since the last release tag, grouped by conventional-commit type (Features / Fixes / Docs / Other).

8. **Wait for publish CI**: The `Publish to npm` workflow auto-runs on release creation. Monitor with:
   - `gh run list --workflow=publish.yml --limit 3`
   - `gh run watch <run-id> --exit-status`

   If it fails, consult `CLAUDE.md` → "Publish workflow gotchas" (especially the `npx -y npm@11.5.1 publish` requirement and the `gh release delete --cleanup-tag` re-run procedure).

9. **Report**: Show the user the new version, GitHub release URL, and npm package URL (`https://www.npmjs.com/package/claude-warden/v/<new-version>`).
