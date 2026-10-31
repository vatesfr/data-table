# Backlog

<!-- check-docs-ignore: vflow optimize -->

Code health items (simplicity, duplication, maintainability, dev loop) from `vflow:optimize` reviews; UX items live in [improvements](improvements.md). A fix closes its item in one commit naming its `B<n>`, and removes it here. Line counts are reviewer estimates.

## Open

- **B14 · S** — dropdown drag-reorder row lookup (`react/src/hooks/useDropdownReorder.ts`, `vue/src/composables/useDropdownReorder.ts`, `solid/src/dragReorder.ts`) still copied 3×. A core `resolveDropdownDragRow(root, {target, clientY}, attr)` measured core +64 B against adapters −42 to −66 B gzip, so the Vue, Solid and vanilla totals grew. Direction: retry only with a more compact signature, measured with `node scripts/size-diff.mjs`.
- **B24 · S** — root `package.json` `test` runs 5 vitest processes in sequence. A root `vitest.config.ts` with `projects: ['packages/*/vitest.config.ts']` (not `packages/*`, which picks up `vite.theme.config.mts`) ran the test step in 12 s instead of 15–17 s with the same 2,063 tests, but stage 1 of `check.mjs --staged` stayed at 15–17 s, bound by its other parallel steps. Direction: retry once type-check or build gets faster.

## Declined

- **B18** — splitting React's `DataTableView.tsx` and Vue's `DataTableView.vue` into per-dropdown components like Solid's. Reviewers estimated 30–80 B gzip per component (~150–300 B per adapter, against ~100 B of budget headroom); it moves no logic out, only adds props and a focus-restore effect per component, and the coupled areas (Filter, ActiveBar, TableBody: chip→dropdown focus, Vue's dynamic `cell-*`/`group-*`/`filter-*` slots) would need imperative handles. The duplicated logic it aimed at now lives in core (B8–B14). Revisit if a view becomes hard to change.
