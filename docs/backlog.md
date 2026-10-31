# Backlog

<!-- check-docs-ignore: vflow optimize resolveDropdownDragRow -->

Code health items (simplicity, duplication, maintainability, dev loop) from `vflow:optimize` reviews; UX items live in [improvements](improvements.md). A fix closes its item in one commit naming its `B<n>`, and removes it here. Line counts are reviewer estimates.

## Open

- **B14 · S** — dropdown drag-reorder row lookup (`react/src/hooks/useDropdownReorder.ts`, `vue/src/composables/useDropdownReorder.ts`, `solid/src/dragReorder.ts`) still copied 3×. A core `resolveDropdownDragRow(root, {target, clientY}, attr)` measured core +64 B against adapters −42 to −66 B gzip, so the Vue, Solid and vanilla totals grew. Direction: retry only with a more compact signature, measured with `node scripts/size-diff.mjs`.
- **B18 · L** — `packages/react/src/DataTableView.tsx` (1,836 lines) and `packages/vue/src/DataTableView.vue` (1,975 lines) still hold every toolbar dropdown; `FilterPane` already moved out in React. Direction: per-dropdown components along Solid's (`ColumnsDropdown`, `SortDropdown`, `GroupDropdown`, `FilterDropdown`, `ActiveBar`, `TableBody`), one pure move per commit.
- **B21 · M** — multi-paragraph history comments remain outside `logic.ts` and the two big views (e.g. `packages/core/src/types.ts`, `dropdownDomUtils.ts`, Solid components) against the one-line comment rule. Direction: cut file by file, linking the doc that holds the story.
- **B24 · S** — root `package.json` `test` runs 5 vitest processes in sequence. A root `vitest.config.ts` with `projects: ['packages/*/vitest.config.ts']` (not `packages/*`, which picks up `vite.theme.config.mts`) ran the test step in 12 s instead of 15–17 s with the same 2,063 tests, but stage 1 of `check.mjs --staged` stayed at 15–17 s, bound by its other parallel steps. Direction: retry once type-check or build gets faster.
