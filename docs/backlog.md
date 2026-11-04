# Backlog

<!-- check-docs-ignore: vflow optimize ORDER compareInOrder keepOnly parseFr colgroup -->

Code health items (simplicity, duplication, maintainability, dev loop) from `vflow:optimize` reviews; UX items live in [improvements](improvements.md). A fix closes its item in one commit naming its `B<n>`, and removes it here. Line counts are reviewer estimates.

## Open

- **B14 · S** — dropdown drag-reorder row lookup (`react/src/hooks/useDropdownReorder.ts`, `vue/src/composables/useDropdownReorder.ts`, `solid/src/dragReorder.ts`) still copied 3×. A core `resolveDropdownDragRow(root, {target, clientY}, attr)` measured core +64 B against adapters −42 to −66 B gzip, so the Vue, Solid and vanilla totals grew. Direction: retry only with a more compact signature, measured with `node scripts/size-diff.mjs`.
- **B24 · S** — root `package.json` `test` runs 5 vitest processes in sequence. A root `vitest.config.ts` with `projects: ['packages/*/vitest.config.ts']` ran the test step in 12 s instead of 15–17 s with the same 2,063 tests, but stage 1 of `check.mjs --staged` stayed at 15–17 s, bound by its other parallel steps. Direction: retry once type-check or build gets faster.

- **B46** — vanilla has no single-field setters: an outside search box calls `setViewState({ ...getViewState(), searchQuery })`, since `setViewState` resets every field the view leaves out.
- **B47** — `currentRow` and `focus` match rows by object identity only: after a refetch or live update the open row loses its mark unless the app looks it up again by id, and keyboard focus drops to `<body>` on every update (showcase infra: ↓ stops working after a 2 s tick); `getRowId` covers only the selection.
- **B48** — two tables persisted to the URL with the same `paramName` (default `view`) overwrite each other silently; nothing warns.
- **B50** — shift-click range selection ignores `getRowId`: `selectRange` finds the anchor with `indexOf`, so after any `setData` the stale anchor misses and only the clicked row is selected (showcase infra, live updates on: check row 1, wait a tick, shift-click row 6 → "2 selected"). Pass `getRowId` through and match by id.
- **B51** — Solid's `ColumnDef.render`/`renderFilterLabel` are typed `Node`, so every JSX cell needs `as HTMLElement` (25 casts in the showcase). Type them as `JSXElement`, like `toolbarEnd`; vanilla keeps its own copy.
- **B52** — no helper for an ordinal `compare` (`Bronze < Silver < Gold`): 4 of 6 showcase pages hand-roll `ORDER.indexOf(a as X) - ORDER.indexOf(b as X)`. A `compareInOrder(order)` next to `compareMissingLast()`.
- **B53** — "show only these values" on an exclude-only (single-value) column means writing the complement into `excludeFilters` (showcase catalog's chips: 20 lines of branching), and `setViewState`/`initialViewState` silently accept include `filters` there, which the checklist never shows (showcase users' views first did this: Filter → Status showed every value ticked while one was kept). A `filter.keepOnly(key, values)`, and normalize or warn on include filters for such columns.
- **B54** — `rowKey` (view) and `getRowId` (state) name the same identity twice; let `getRowId` drive the DOM key too.
- **B55** — the group bucketers don't see the column's `parseDate`: a non-ISO date column passes it twice (`parseDate: parseFr` and `bucketDatePart('month', parseFr)`). Default bucketing to the column's `parseDate`.
- **B56** — the theme never sets `color-scheme`, so on a dark table (forced `data-theme="dark"`, or the OS dark preference) checkboxes, selects, scrollbars and date-input icons stay light; the Solid demo shows it too. Set `color-scheme: dark` in the dark rules (the showcase's dark pages set it themselves).
- **B57** — after "Clear all" the URL keeps `?view=e30` (an empty view) instead of dropping the parameter.

## Showcase limits

What `demo/showcase` pages wanted and the public API couldn't give. Each page marks the spot with a `Limit: B<n>` comment: once an item ships, update those spots and remove the item.

- **B25** — the font tokens (`--font-size-md`, `--font-weight-medium`…) and the danger colors (`--color-text-danger`…) are read by the table but missing from the documented token table (vanilla README "Theming"). Pages: infra, logs, catalog, sports, users.
- **B26** — no token for cell padding or row height: a console or log viewer wants dense rows, a catalog airy ones. Pages: infra, logs, catalog.
- **B27** — no token for the header row (background, text color, weight, case): it shares `--color-background-tertiary` and `--font-weight-medium` with the rest of the table. Pages: catalog, sports.
- **B28** — no way to hide the toolbar, the header menus and the pager, e.g. for a printed report. Page: ledger.
- **B29** — no hook to style group header and aggregate rows (e.g. as report section breaks). Page: ledger (no comment: nothing in the page would change).
- **B30** — no public way to build a share link for a view that isn't applied (`encodeViewState` is internal), so saved searches are buttons, not links. Page: logs.
- **B31** — date grouping stops at the day (`DatePart`); a log viewer wants hour or minute buckets. Page: logs.
- **B32** — the filter checklist's per-value counts print unformatted ("10010"), and the default `rowCount` label doesn't group digits ("100000 / 100000 rows"). Page: logs.
- **B33** — `datePartGroup('month')` and the date filter tree name months in the browser's locale, not the table's labels; a French table in an English browser mixes languages. Page: ledger.
- **B36** — a column header can't carry a description or tooltip, which abbreviated headers (GP, G, A) need. Page: sports.
- **B37** — groups order only by their key, never by an aggregate (e.g. clubs by total points). Page: sports.
- **B38** — `numericRangeGroup`'s unit is only a suffix ("50–100 €", never "€50–€100"). Page: catalog.
- **B39** — no public per-value counts under the current search and filters, for an app's own facet chips. Page: catalog.
- **B40** — no setter for an exact sort (key and direction) in one call; an app's own sort control calls `replace` then `toggleDir`. Page: catalog.
- **B41** — the toolbar can't render without the table body, so a headless view (cards) can't reuse the Sort/Filter controls. Page: catalog.
- **B42** — no public way to compare two views; telling which saved view is active means serializing `getViewState()` with sorted keys. Pages: users, logs.
- **B43** — each column header is two Tab stops (sort, menu): from the search box, 19 Tabs reach the first row of a 9-column table. Page: users (a "Jump to rows" link with `focus.moveTo`).
- **B44** — `group.clear()` leaves the sort entries grouping added, so leaving a grouped view also needs `sort.remove`. Page: sports.
- **B49** — a column `width` is only set on its `<th>` under automatic table layout, so it's a hint: a 190 px Name column renders ~99 px and wraps (the Solid demo's 160 px Name renders ~98 px). Make it hold (`<colgroup>`, or a minimum width) or document it as a hint. Page: infra (one-line cell renders).
- **B45** — an `initialViewState` sort counts as user state: its chip and "Clear all" show on first load, and "Clear all" drops it instead of returning to the initial view. Page: logs (no comment).

## Declined

- **B18** — splitting React's `DataTableView.tsx` and Vue's `DataTableView.vue` into per-dropdown components like Solid's. Reviewers estimated 30–80 B gzip per component (~150–300 B per adapter, against ~100 B of budget headroom); it moves no logic out, only adds props and a focus-restore effect per component, and the coupled areas (Filter, ActiveBar, TableBody: chip→dropdown focus, Vue's dynamic `cell-*`/`group-*`/`filter-*` slots) would need imperative handles. The duplicated logic it aimed at now lives in core (B8–B14). Revisit if a view becomes hard to change.
