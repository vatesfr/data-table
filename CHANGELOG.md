# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Filter dropdown redesigned as a searchable master-detail panel — left pane lists all filterable columns, right pane shows the selected column's controls — replacing the old single stacked checklist that didn't scale to high-cardinality columns
- Per-value row counts shown in filter checklists, computed as facets over every other active filter
- Year › Month › Day filter tree for date columns, replacing a min/max range
- Filter checklist value sorting (alphabetical/count, ascending/descending)
- Column reordering via drag-and-drop on headers and ▲▼ buttons in the Columns panel
- Shift-click range selection for table rows and filter checklist values — extends or shrinks the selection between the last-clicked item and the shift-clicked one
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
