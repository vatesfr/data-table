# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
