## Summary

<!-- What does this PR change and why? -->

## Checklist

- [ ] Changes that affect user-facing behaviour are reflected in React, Vue, and Solid (`packages/vanilla` wraps `packages/solid`, so a Solid-level change already covers it — no separate vanilla change needed unless it's specific to the imperative wrapper)
- [ ] Any new UI string is covered by `DataTableLabels` (no hardcoded text)
- [ ] Changes are documented in `CHANGELOG.md` under `[Unreleased]`
- [ ] CI passes (`lint`, `format:check`, `test`, `type-check`, `build`)
