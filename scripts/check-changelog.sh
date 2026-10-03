#!/usr/bin/env bash
# Fails the commit if source changes aren't accompanied by a CHANGELOG.md update.
# Bypass for a genuinely changelog-exempt commit with `SKIP_CHANGELOG=1 git commit`.
set -euo pipefail

[ -n "${SKIP_CHANGELOG:-}" ] && exit 0

staged=$(git diff --cached --name-only --diff-filter=ACMR)

if echo "$staged" | grep -q '^CHANGELOG\.md$'; then
  exit 0
fi

if echo "$staged" | grep -E '^(packages|demo)/[^/]+/src/' | grep -qv '/__tests__/'; then
  echo ""
  echo "error: source files changed but CHANGELOG.md wasn't updated."
  echo "Add an entry under '## [Unreleased]' in CHANGELOG.md, or commit with SKIP_CHANGELOG=1 if this change genuinely doesn't need one."
  echo ""
  exit 1
fi
