# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Vanilla: the filter checklist/date-tree checkbox could silently fail to visually update on a real (trusted) mouse click, though the underlying filter state changed correctly — the click-revert-correction relied on a microtask, but a genuine trusted click's native checkbox revert can itself land after that microtask, undoing the correction
- Vanilla: the filter dropdown's left column pane could scroll a column button on top of its own sticky search box (missing `z-index`, unlike the equivalent Sort/Group/Columns search row)
- Vanilla: the filter dropdown's checklist/date-tree pane couldn't scroll — it had no bounded height to scroll within, so overflow content was silently clipped by the panel instead

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
