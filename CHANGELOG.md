# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `bucketLogRange(options?)`/`formatLogRange(options?, unit?, missingLabel?)` (core, re-exported from every adapter) — a ready-made `groupValue`/`groupFormat` pair for bucketing a `type: 'number'` column on a logarithmic scale, for a right-skewed column spanning several orders of magnitude (review counts, hours played, file sizes) where any single linear `bucketNumericRange` step is either too coarse for the long tail or too fine for the low end. `LogRangeOptions` (`{ base?, divisions?, min? }`) generalizes to a plain order-of-magnitude scale (`base: 10`, default `divisions: [1]`), octaves/binary doublings (`base: 2`), a half-decade "1-3-10" grid (`divisions: [1, 3]`), or any other per-`base`-cycle split (#18)
- `numericRangeGroup(step, unit?, missingLabel?)`/`datePartGroup(part, parseDate?, missingLabel?)`/`logRangeGroup(options?, unit?, missingLabel?)` (core, re-exported from every adapter) — each bundles a bucketer with its matching formatter into one `{ groupValue, groupFormat }` pair from a single set of arguments, spreadable directly into a column def (`{ key: 'hoursPlayed', ...logRangeGroup({ divisions: [1, 3] }) }`), removing the config-divergence risk of passing the same `step`/`unit`/`part`/`options` to both halves separately (#18)

### Fixed

- `bucketNumericRange`/`bucketDatePart` now return `null` for a missing (`null`/`undefined`) value instead of silently coercing it — `bucketNumericRange` previously read `Number(null) === 0`, merging "no value" into the same group as a real, confirmed `0`; `bucketDatePart` previously read `String(null) === "null"`, surfacing the literal text `"null"` as a group header. `bucketNumericRange` also now returns `null` (rather than `NaN`) for a non-numeric value, since `NaN` previously flowed through to a group key that stringified to the literal visible text `"NaN"`. `formatNumericRange`/`formatDatePart` each gained a 3rd `missingLabel = '(none)'` parameter rendered for that group (#18)

## [0.10.0] - 2026-08-21

### Added

- **New package: `@vates/data-table-solid`** — the Solid.js implementation (`createTableState`/`DataTableView` and all toolbar/dropdown components) that used to live entirely inside `@vates/data-table-vanilla` is now its own standalone adapter package, for projects already using Solid. `solid-js` is a `peerDependency` there (never bundled), so it shares the consuming app's own Solid instance instead of a second, non-interoperable copy — Solid's reactivity tracking is module-scoped, so two separate bundled copies of `solid-js` wouldn't just cost bytes, a signal from one copy is invisible to a computation running in the other. `@vates/data-table-vanilla`'s public API (`createDataTable(container, options)`) is unchanged; it's now a thin wrapper around `@vates/data-table-solid`, still bundling both `solid-js` and `@vates/data-table-solid` internally so non-Solid consumers never install either. Comes with its own demo app (`demo/solid`).
- `@vates/data-table-solid`: a `<DataTable>` convenience component, matching React's/Vue's own — builds a `createTableState` internally and renders `DataTableView`, for the common case that doesn't need view persistence or an imperative selection API.
- `@vates/data-table-solid`: `createTableState`'s `data`/`columns` parameters now also accept a Solid `Accessor` (mirroring Vue's `useTableState`, which already accepts `MaybeRefOrGetter`) — tracked reactively for the table's whole lifetime, with no `createEffect` to write by hand. `<DataTable>` is built on this.
- `@vates/data-table-solid`: `usePersistedView`/`useUrlView`/`resetView`/`usePersistence` — the view-persistence helpers React/Vue/vanilla already had, promoted from a hand-rolled equivalent that used to live only in the demo.
- All adapters: `getRowId?: (row: TRow) => string | number` construction option — an opt-in escape hatch for row selection, which normally tracks rows by object identity (a `Set<TRow>`). With `getRowId` set, selection matches and survives by id instead, so a refetch/re-map of `data` that produces new-but-equivalent row objects no longer silently drops the current selection. Purely additive; behavior is unchanged for anyone who doesn't set it. Known limitation: shift-click range selection still matches its anchor/target by reference, so a data refresh between a plain click and a later shift-click can fall back to selecting just the target.
- React/Vue/vanilla: `usePersistence`/`persistView` — a combined persistence helper wiring `localStorage` + URL sync from one `{ storageKey?, paramName? }` object instead of passing the same values separately to the storage/URL/reset helpers (previously a typo'd or forgotten key at one of those call sites was a silent bug).
- Vue: `<DataTable>` gained `v-model:page` and `v-model:search-query`, syncing `table.pagination.page`/`table.search.query` two-way — Vue was the one adapter with no `v-model` anywhere despite it being the idiomatic pattern for this. No `v-model:selection`: `selectionChange`/`onSelectionChange` already covers observing it, and "set it from outside" is an awkward fit for a `Set<TRow>`-by-object-identity model.
- Vanilla: `onSelectionChange(cb): () => void` subscribe/unsubscribe API on `DataTableInstance`, mirroring `onViewChange` — a listener can now be attached after construction, not just passed to the constructor.
- Vanilla: `setRowKey`/`setSelectable`/`setOnRowClick`/`setLabels`/`setDefaultGroupsCollapsed`/`setGetRowId` post-construction setters on `DataTableInstance` — all six of these options used to be frozen at construction time.
- Solid/vanilla: `ColumnDef.renderFilterLabel?: (value: string) => Node` — the Filter dropdown checklist can now render a custom node (e.g. a colored badge) per value, matching React's `renderFilterLabel`/Vue's `#filter-{key}` slot.
- Core: `countActiveSorts`/`countActiveGroups`, alongside the existing `countActiveFilters`, for a toolbar/active-bar badge count that reads the same way for all three concerns.

### Changed

- **BREAKING (React, Vue, Solid):** `useTableState`/`createTableState`'s returned `TableState` is now namespaced by concern instead of one flat ~45-field object — `table.columns`, `table.sort`, `table.filter`, `table.group`, `table.selection`, `table.pagination`, `table.search`, each holding that area's own state/actions with the redundant prefix dropped (e.g. `toggleSort` → `sort.toggle`, `moveGroupBy` → `group.moveBy`). `processedData`/`pagedData`/`groupedData`/`visibleItems`/`labels`/`getViewState`/`setViewState`/`clearAll` stay top-level. See `CLAUDE.md`'s "Namespaced TableState" section for the full field mapping. No compatibility shim — pre-1.0, so this ships as a hard cut. `@vates/data-table-vanilla` is unaffected, since it always exposed its own distinct `DataTableInstance` method names rather than `TableState` directly.
- **BREAKING (Solid):** `TableState.labels` is now an `Accessor` (call it as `table.labels()`), not a plain object, since it must itself react to a changed `labels` option now that `labels`/`defaultGroupsCollapsed`/`getRowId` are live options on `createTableState` (previously frozen at construction — the one adapter where they were, unlike React/Vue).
- **BREAKING (core):** `calcTotalPages` renamed to `computeTotalPages`, and `selectedRowsOf` renamed to `getSelectedRows` — naming-consistency fixes (`calc*` was the only outlier among `compute*`-prefixed helpers; `selectedRowsOf` broke the verb-first convention its siblings use). Pure renames, same signature and behavior.
- **BREAKING (core):** `columns` is now a required parameter of `processData`, `groupData`, and `sortWithinGroups` (previously optional, defaulting to `[]`) — for consistency with sibling functions that already required it, and because silently treating a missing `columns` as "no columns known" was a footgun that dropped computed/`value`/`groupValue` column support with no error. Every adapter already passes `columns` at every call site, so this only affects direct core callers relying on the old default.
- Vue: internal state (`visibleCols`, `columnOrder`, `sorts`, `filters`, `excludeFilters`, `rangeFilters`, `groupBy`, `collapsedGroups`) switched from `ref` to `shallowRef`, matching `selection`'s existing usage — these are always replaced wholesale, never mutated in place, so the deep-reactive Proxy wrapping `ref` added was pure overhead. No behavior change.

### Fixed

- All four adapters: `visibleCols` was never reconciled against a replaced column set — Solid/vanilla via `setColumns`/`table.setColumns` (the imperative "change the schema without rebuilding the table" API), React/Vue via the `columns` argument itself changing across renders (no explicit setter needed there to hit it). Swapping to a fully disjoint set of column keys (e.g. switching to a different object type while reusing the same table instance/component) made every column filter out as "not visible" and the table silently render with none at all. A column that already existed keeps whatever visibility it had; a genuinely new column now starts visible by default. Fixed via a new shared core function, `reconcileVisibleColumns`, used identically by all three adapters that needed it (vanilla gets it for free through Solid).
- Vanilla: the filter checklist/date-tree checkbox could silently fail to visually update on a real (trusted) mouse click, though the underlying filter state changed correctly — the click-revert-correction relied on a microtask, but a genuine trusted click's native checkbox revert can itself land after that microtask, undoing the correction
- Vanilla: the filter dropdown's left column pane could scroll a column button on top of its own sticky search box (missing `z-index`, unlike the equivalent Sort/Group/Columns search row)
- Vanilla: the filter dropdown's checklist/date-tree pane couldn't scroll — it had no bounded height to scroll within, so overflow content was silently clipped by the panel instead
- Vanilla: `render()`'s own mounted subtree leaked a listener on every `destroy()` — `solid-js/web`'s `render()` creates its own nested `createRoot` never registered in the outer root's `.owned`, so the outer `dispose()` never reached it, leaving each `Dropdown`'s document-level `click` listener (and its closure over the disposed table's state) registered forever. `destroy()` now also disposes `render()`'s own returned disposer.
- React/Vue/vanilla: `usePersistedView`/`persistViewToLocalStorage` always wrote to `localStorage` even once the view was back at its construction-time defaults, unlike `useUrlView`/`syncViewToUrl`, which already removes its query param in that case — in React specifically this meant `resetView`'s own `localStorage.removeItem` could be immediately undone by the next save effect. Now matches the URL helpers' existing empty-view handling.
- Vue: `DataTable`/`DataTableView`'s clickable-row styling (from self-detecting an `onRowClick` listener) was frozen at whatever was true on first render — attaching or removing the listener later never updated it. Now re-derived after every re-render.
- Vue: pagination rendered above the table instead of below, unlike React/Solid/vanilla.
- Fix various stale/incorrect documentation across every package's README and `CLAUDE.md`/`docs/*.md` (missing exports, stale types, stale Solid/vanilla attribution left over from the Solid extraction, a broken example) — no code changes.

## [0.9.0] - 2026-08-18

### Changed

- **Internal:** `@vates/data-table-vanilla` is now implemented with [Solid](https://www.solidjs.com/) + TSX instead of a hand-rolled `innerHTML`-string-rebuilding renderer. `solid-js` is bundled (not a published dependency — never installed by consumers). The public API (`createDataTable(container, options)`, its options, and its returned instance shape) is unchanged; bundle size grew from ~16.3 kB to ~24 kB gzip (still well under a React/Vue-based alternative's ~40 kB+), in exchange for structurally eliminating a class of bugs the old renderer's manual DOM-diffing bookkeeping was prone to (see Fixed below)

### Fixed

- Vanilla: the numeric/date range filter's min/max inputs reversed digit order while typing (e.g. typing "8" then "5" produced "58" instead of "85") — a `type="number"` input doesn't support the selection APIs the old focus-restore mechanism relied on; fixed (ahead of the Solid rewrite) by switching to `type="text" inputmode="decimal"`
- Vanilla: an array (multi-value) column's cell rendered via a bare comma-join ("Action,RPG") instead of ", "-joined, unlike React/Vue
- Vanilla: a custom `col.render` on an aggregate column was silently ignored (fell back to `format`/stringify) — `render` now applies uniformly to data, group-header, and aggregate cells, matching React/Vue
- Vanilla: Home/End keyboard navigation on table rows and group headers was entirely unimplemented
- Vanilla: Shift+ArrowUp/Down didn't extend row selection to the target the way Shift+click already did
- Vanilla: collapsing/expanding a group via Enter could drop keyboard focus to the page body
- Vanilla: opening one toolbar dropdown while another was already open could spuriously close the open one
- Vanilla: the header and per-group "select all" checkboxes could visually get stuck showing "checked" immediately after clearing a partial selection to zero
- Vanilla: shift-range **deselection** in the filter checklist/date-tree could clear an unrelated exclude flag on a value swept by the range
- Vanilla: the Filter dropdown's left column pane had no search box and wasn't alphabetized, unlike the Sort/Group dropdowns' equivalent lists
- Vanilla: the Filter dropdown's date-column detail pane was missing its select-all checkbox and value-search box entirely
- Vanilla: a date filter tree's month/day nodes rendered a raw zero-padded key ("05") instead of a localized month name ("May")
- Vanilla: the date range filter's min/max inputs didn't default to the column's actual data bounds, unlike the numeric range filter's equivalent inputs

## [0.8.0] - 2026-08-15

### Added

- Columns/Sort/Group/Filter dropdowns gained a search box to narrow long column lists, roving Up/Down/Home/End keyboard navigation in visual order, Escape-to-clear-then-close, and focus-follows-open. The Filter dropdown's left column pane and right detail pane are now keyboard-navigable together (Left/Right crosses between them), and its column list behaves like a listbox (focus alone selects, no separate activation step)
- Active-bar chips (sort/group/filter) are now actionable, not just removable: a sort chip toggles direction in place, a group chip opens the Group dropdown focused on that entry, and a filter chip opens the Filter dropdown focused on that column
- Numeric/date range filter's min/max inputs now default to the column's actual data bounds instead of sitting blank, matching the adjacent slider's own default
- Exclude filters: a checklist value for a multi-value column (tags) can now mean "rows without this", not just "rows with this" — click cycles a value neutral → include → exclude → neutral, rendered as a native tri-state checkbox. `TableViewState.excludeFilters` persists/shares alongside `filters`
- `ColumnDefBase.defaultSortDir` — a column can opt into descending as the starting direction for a fresh sort (e.g. a "last modified" date or a score column), instead of always starting ascending
- `ColumnDefBase.defaultValueSort` — a column's filter checklist/date-tree can default to a sort order other than alpha-ascending (e.g. most-common-first for a tag column, most-recent-first for a date column's tree)
- Vanilla: `DataTableInstance.getSelection()`/`setSelection()`/`clearSelection()` give imperative access to selection, matching what React/Vue already exposed reactively via `table.selection`/`table.clearSelection()`

### Fixed

- `calcTotalPages`/`paginateData` (core) now guard against a non-finite `page`/`pageSize` (e.g. an unvalidated input forwarded to `setPageSize`), which previously collapsed the table to a silently empty page instead of falling back sanely; React/Vue's `setPage`/`setPageSize` also now no-op on non-finite input rather than storing it
- `@vates/data-table-core`'s main entry no longer re-exports vanilla-only theme internals (`LIGHT_THEME`/`DARK_THEME`/`renderThemeCss`) that had no relevance to React/Vue consumers — still reachable via the `@vates/data-table-core/theme` sub-path, same pattern as `/locales`

### Removed

- **BREAKING:** `Badge`/`ScoreBar` (React/Vue) and `createScoreBar`/`ScoreBarOptions` (vanilla) are no longer exported from the published packages — they were demo-only presentational components with no theming/accessibility contract. Copy the component from `demo/*/src/components` if you were using it
- **BREAKING:** `toggleFilter` (core export, and `TableState.toggleFilter` in React/Vue) is removed — it was dead in every adapter's own UI code and unsafe to call directly (it never kept the `excludeFilters` invariant in sync). Use `cycleFilterValue` instead

### Changed

- **BREAKING:** `useTableState` in `@vates/data-table-react` now takes a 3rd `options` object (`{ defaultVisibleColumns?, labels?, defaultPageSize?, defaultGroupsCollapsed? }`) instead of 4 trailing positional parameters, matching Vue's existing shape. Replace `useTableState(data, columns, visible, labels, pageSize, collapsed)` with `useTableState(data, columns, { defaultVisibleColumns: visible, labels, defaultPageSize: pageSize, defaultGroupsCollapsed: collapsed })`
- **BREAKING:** core's `setSort` export (and `TableState.setSort` in React/Vue) is renamed `replaceSort` for clarity, since `setSort`/`toggleSort`/`appendOrToggleSort` sounded like near-synonyms despite very different effects. Same signature and behavior, pure rename
- `rowKey` (React/Vue/vanilla) is now documented as a rendering-identity hint only (React `key`/Vue `:key`/vanilla DOM key), not a selection identifier — selection has always been tracked by object identity regardless of `rowKey`. Docs only, no behavior change

## [0.7.0] - 2026-08-14

### Added

- `ColumnDefBase.compare` — a custom `(a, b, dir) => number` comparator for a column whose natural order is neither numeric nor alphabetical (e.g. an enum/tier column). Applied everywhere a column's values are ordered: row sort, group order (for a groupBy column), and the filter checklist's default and explicit (`sortFilterValues`) ordering. The 3rd `dir` argument only matters for a value that must stay pinned to one end regardless of direction (impossible to express as a plain return value, since that gets sign-flipped for `desc` the same way the default comparison does) — ignore it for an ordinary comparator (#15)
- `compareMissingLast(compare?, isMissing?)` (core, re-exported from all three adapters) — a ready-made `compare` built on the `dir` argument above, pinning a value (missing data, by default) last regardless of sort direction (#15)

## [0.6.0] - 2026-08-13

### Added

- `ColumnDefBase.groupValue`/`groupFormat` let a column bucket into a coarser group key instead of grouping on its exact value — useful for a continuous or high-cardinality column (a percentage, price, or raw timestamp) where exact-value grouping puts every row in its own group. `bucketNumericRange`/`formatNumericRange` and `bucketDatePart`/`formatDatePart` (core, re-exported from all three adapters) are ready-made pairs for numeric-range and date-part bucketing
- Numeric and date range filters gained a slider (two overlapping thumbs sharing one track) alongside their existing min/max inputs. For date columns, the range now also narrows the Year › Month › Day tree itself (and its facet counts), the same way the search box already does, instead of only being ANDed onto the final row set

### Fixed

- The filter checklist/date-tree now fills the detail pane's actual height instead of a hardcoded 260px, which used to leave dead space below a short checklist (vanilla) or let the date tree overflow past the panel onto the page entirely (all three adapters) whenever the column list was taller than the old default (#13, #14)
- The filter column list's active-filter dot only checked `rangeFilters` for `type: 'number'`, so a date column's own range filter never lit it; unified to check the checklist size OR the range bounds for every column type
- The active state bar never rendered a chip for a range filter at all; it now does, and the chip's `×` clears the range too

## [0.5.0] - 2026-08-11

### Added

- Sort and Group toolbar dropdowns redesigned: an "Active" section lists current entries, each draggable or reorderable with Alt+ArrowUp/Alt+ArrowDown; a Sort entry's direction toggles by clicking (or Enter/Space) the row itself, and a single `×` removes it. An "add" section below lists the remaining columns as real, keyboard-reachable buttons
- Columns panel rows get the same drag-and-drop + Alt+ArrowUp/Alt+ArrowDown reordering, replacing the old ▲▼ buttons
- The search input gained an inline `×` button that clears just the query and returns focus to the input
- `moveSortBy`/`reorderSort` core primitives, and `reorderColumn`/`reorderSort` gained an `after` param for drag-and-drop reordering
- Toolbar reorganized into two clusters — Columns/Sort/Group ("shape" the view) and Search/Filter ("narrow" it) — separated by a divider, with "Clear all" pinned alone at the far right
- An always-visible active state bar below the toolbar shows one removable chip per active sort entry, group column, and filter column, plus the row/group-count stats — replacing the old bare count badges on the Sort/Filter/Group toolbar buttons
- Each Sort/Group/Filter toolbar button grew an adjoining `×` button (shown only when that state is non-empty) that clears it without opening the dropdown, replacing the dropdowns' old in-panel "Clear sorts"/"Clear groups"/"Clear filters" footer row

### Fixed

- Dropdown panels (Columns/Sort/Filter/Group) now clamp themselves to stay within the viewport instead of rendering partly or fully off-screen near an edge
- Dragging a row to the very end of the Sort/Group/Columns dropdown lists now works — previously a drop past the last row, or onto its bottom half, was silently rejected or could only ever insert before it
- Removed a redundant "× " prefix baked into the `clearSorts`/`clearGroups`/`clearFilters` labels, left over from when they were visible footer text rather than tooltip/aria-label-only text next to a button that already shows its own `×` glyph

## [0.4.0] - 2026-08-04

### Added

- `ColumnDefBase.searchable` flag (defaults to `true`) excludes a column from global search — useful for a column whose underlying value isn't user-facing text (e.g. an image URL rendered via `render`)

### Fixed

- Vanilla: table scroll position no longer resets to the top on every re-render (sort, filter, page change, `setData`) — preserved the same way focus already was
- Sorting and grouping by the same multi-value column (e.g. tags) now sorts correctly: a secondary sort key applies within each group instead of being starved by an incidental whole-array comparison, and the groups themselves are ordered by their own value instead of an arbitrary order

## [0.3.0] - 2026-08-04

### Added

- Full keyboard navigation for table rows and group headers: a roving tabindex moves one row (or group header) at a time with arrow keys, crosses page boundaries at the edges, Home/End jump to the current page's ends (Ctrl/Cmd+Home/End jump across all pages), Space toggles selection (Shift+Arrow/Home/End extends the range), and Enter fires row click or toggles a group's collapsed state
- `defaultGroupsCollapsed` option (defaults to `true`) — groups now start collapsed unless overridden
- `ColumnDefBase.parseDate` override for `type: 'date'` columns, so a column can plug in its own date parser when `new Date(v)` guesses an ambiguous format wrong
- Filter checklist virtualized (windowed rendering) — columns with thousands of distinct values no longer mount one row per value regardless of scroll position
- `resetView` helper (React/Vue/vanilla) puts a table back to its construction-time defaults and clears any persisted localStorage/URL state in one call

### Fixed

- `type: 'date'` and numeric-string `type: 'number'` columns now sort chronologically/numerically instead of falling back to alphabetical string comparison
- Pagination counts group header rows toward `pageSize`, so a page never renders more rows than configured; the "Rows per page" dropdown now shows the correct value even when `pageSize` isn't one of the hardcoded options
- Vanilla: an open toolbar dropdown no longer stays visibly open after clicking a row
- Visual hierarchy improved between the table header, group header rows, and the odd-row stripe (header gets a stronger anchor, group rows read as bold section dividers, stripes are more subtle)
- Global search and the filter checklist search are now diacritic-insensitive (e.g. "ooo" matches "Öoo")

### Changed

- Select-all checkboxes (header, group headers, filter checklist) now clear the selection when clicked in an indeterminate or fully-checked state, and only select all when nothing is selected — matching Gmail's convention instead of always escalating to select-all

### Internal

- Filter facet-count computation scoped to only the currently open column (was every filterable column on every change) — ~15-17x faster at 500k rows/7 columns; date-column sort now precomputes comparable values once instead of per comparison — ~4x faster
- Added a Vitest benchmark suite (`npm run bench -w packages/core`) for core logic at 10k/100k/500k rows
- Demo apps: added a 200k-row "Huge dataset" showcase section (realistic e-commerce data, two groupable columns), extended view persistence/sharing to every table, fixed a dark-mode button contrast bug and a GitHub Pages duplicate-React bundling bug
- Bumped CI actions to v5 and the Vite toolchain to fix an esbuild vulnerability

## [0.2.0] - 2026-07-14

### Added

- Filter dropdown redesigned as a searchable master-detail panel — left pane lists all filterable columns, right pane shows the selected column's controls — replacing the old single stacked checklist that didn't scale to high-cardinality columns
- Per-value row counts shown in filter checklists, computed as facets over every other active filter
- Year › Month › Day filter tree for date columns, replacing a min/max range
- Filter checklist value sorting (alphabetical/count, ascending/descending)
- Column reordering via drag-and-drop on headers and ▲▼ buttons in the Columns panel
- Shift-click range selection for table rows, filter checklist values, and the date filter tree — extends or shrinks the selection between the last-clicked item and the shift-clicked one
- `DataTableView` (React/Vue): render layer split out from `DataTable` so external code (e.g. `usePersistedView`/`useUrlView`, or a fully custom layout) can access the underlying `useTableState` value directly

### Fixed

- Dark theme contrast improved across the vanilla, React, and Vue adapters
- Vue: aggregate row no longer renders when no grouping is active

### Changed

- Theme palette single-sourced in core and shared by vanilla, React, and Vue

### Internal

- npm publish switched to trusted publishing (OIDC)
- Demo docs cross-linked and reorganized (sticky nav, Row click/Aggregation docs, locale switcher fix)

## [0.1.0] - 2026-07-09

### Added

- `@vates/data-table-core` — framework-agnostic pure-TypeScript logic: sorting, filtering, grouping, pagination, aggregation, global search, column visibility, i18n
- `@vates/data-table-react` — React adapter with `<DataTable>` component and `useTableState` hook; render props for custom cells and filter labels
- `@vates/data-table-vue` — Vue 3 adapter with `<DataTable>` component and `useTableState` composable; scoped slots for custom cells, filter labels, and group headers
- `@vates/data-table-vanilla` — framework-free adapter (`createDataTable`) for use without React or Vue
- i18n via a `labels` prop/option (defaults to English); built-in locales for English, French, Spanish, German, and Portuguese, all overridable
- Client-side pagination (`defaultPageSize`, `page`, `pageSize`, `numPages`, `setPage`, `setPageSize`)
- Row selection: opt-in checkbox column with header and group select-all (including indeterminate state), `onSelectionChange`/`selectionChange`/`selection` for headless usage
- Row click callback (`onRowClick`/`rowClick`) with hover highlighting, skipping group headers, the aggregate row, and the selection checkbox
- Global text search across all columns
- Group header aggregation (`sum`, `count`, `avg`, `min`, `max`, or a custom function) rendered in a secondary row below each group header
- Array-valued (multi) columns for filtering, grouping, and display
- Computed columns via a `value` accessor function, decoupling a column's cell value from its `key`
- Grouped columns automatically hide from the table header and reappear when grouping is cleared
- View persistence and sharing: `getViewState`/`setViewState` snapshot sort/filter/group/page/search state; `usePersistedView`/`persistViewToLocalStorage` and `useUrlView`/`syncViewToUrl` helpers for localStorage and shareable-URL persistence
