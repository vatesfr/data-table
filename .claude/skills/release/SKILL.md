---
name: release
description: Cut a release of the @vates/data-table-* packages — version bumps, CHANGELOG, release commit, tag and push (which publishes to npm). Use when asked to release, publish, or bump versions.
---

# Release

Pushing the tag publishes to npm — confirm with the user before step 5.

1. Pick the version and the packages to bump (see Version pool below). Bump `version` in each affected `package.json`, plus any cross-package `@vates/data-table-*` `dependencies`/`devDependencies` ranges that reference a bumped package.
2. In `CHANGELOG.md`, turn `## [Unreleased]` into `## [X.Y.Z] - <today>` and add a fresh empty `## [Unreleased]` above it.
3. `npm install` (refreshes `package-lock.json`), then `npm run build && npm run test && npm run type-check`.
4. Commit as `chore(release): X.Y.Z`. The pre-commit hook re-runs lint-staged/type-check/test/build/size.
5. Tag `vX.Y.Z` and push both: `git tag vX.Y.Z && git push origin main vX.Y.Z`. `.github/workflows/publish.yml` triggers only on a pushed `v*` tag — pushing the commit alone publishes nothing.

## Version pool

- `core`/`react`/`vue`/`solid`/`vanilla` share one version-number pool; `CHANGELOG.md`'s `## [X.Y.Z]` headers cover the whole project.
- A release bumps and publishes only the packages that changed, all to the same new number. Others keep their last published version.
- Versions therefore drift apart; a lagging package touched again jumps straight to the pool's current number, skipping the ones in between — expected.
- Cross-package dependency ranges (e.g. `"@vates/data-table-core": "^0.10.0"`) reference the dependency's actual last-published version, not the release's number.
- `solid` had its own count (from `0.1.0`) until `0.10.0` folded it into the pool.
