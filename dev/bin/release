#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"

case "$BUMP" in
  patch|minor|major) ;;
  *) echo "Usage: $0 [patch|minor|major] (default: patch)" && exit 1 ;;
esac

pnpm version "$BUMP" --no-git-tag-version
VERSION=$(jq -r .version package.json)
DATE=$(date +%Y-%m-%d)

# Move [Unreleased] entries to new version heading
if ! grep -q '## \[Unreleased\]' CHANGELOG.md; then
  echo "Error: no [Unreleased] section in CHANGELOG.md" >&2
  exit 1
fi
UNRELEASED=$(awk '/^## \[Unreleased\]/{found=1; next} /^## \[/{exit} found{print}' CHANGELOG.md)
if [ -z "$(echo "$UNRELEASED" | tr -d '[:space:]')" ]; then
  echo "Error: [Unreleased] section is empty - add changelog entries before releasing" >&2
  exit 1
fi
sed -i '' "s/^## \[Unreleased\]/## [Unreleased]\\
\\
## [$VERSION] - $DATE/" CHANGELOG.md

pnpm run sync-plugin-version
pnpm run build
pnpm run test

git add -A
git commit -m "chore: release v$VERSION"
git push

MARKETPLACE="$HOME/git/src/github.com/buvis/claude-plugins/.claude-plugin/marketplace.json"
if [ -f "$MARKETPLACE" ]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$MARKETPLACE"
  git -C "$(dirname "$MARKETPLACE")/.." add .claude-plugin/marketplace.json
  git -C "$(dirname "$MARKETPLACE")/.." commit -m "chore: bump warden to v$VERSION"
  git -C "$(dirname "$MARKETPLACE")/.." push
  echo "Marketplace updated to v$VERSION"
fi

echo "Released v$VERSION"
