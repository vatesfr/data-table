---
name: release
description: Cut a release of the @vates/data-table-* packages — version bumps, CHANGELOG, release commit, tag and push (which publishes to npm). Use when asked to release, publish, or bump versions.
---

# Release

Pushing the tag publishes to npm — confirm with the user before step 4.

1. Pick the version; every release so far has been a minor (`0.X.0`).
2. `node scripts/release.mjs X.Y.Z --dry-run` lists the packages it would bump and why; check it makes sense, then rerun without `--dry-run`. It bumps versions and cross-package ranges, dates `## [Unreleased]` in `CHANGELOG.md` and refreshes `package-lock.json`.
3. Commit as `chore(release): X.Y.Z`; the pre-commit hook runs the full checks.
4. Tag `vX.Y.Z` and push both: `git tag vX.Y.Z && git push origin main vX.Y.Z`. `.github/workflows/publish.yml` triggers only on a pushed `v*` tag — pushing the commit alone publishes nothing.

## Version pool

- `core`/`react`/`vue`/`solid`/`vanilla` share one version-number pool; `CHANGELOG.md`'s `## [X.Y.Z]` headers cover the whole project.
- A release bumps and publishes only the packages that changed (test-only changes don't count) or depend on one that did, all to the same new number. Others keep their last published version.
- Versions therefore drift apart; a lagging package touched again jumps straight to the pool's current number, skipping the ones in between — expected.
- Cross-package dependency ranges (e.g. `"@vates/data-table-core": "^0.10.0"`) reference the dependency's actual last-published version, not the release's number.
