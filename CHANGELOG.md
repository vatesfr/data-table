# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-19

### Added
- `@vates/flexi-table-core` — framework-agnostic pure-TypeScript logic: sorting, filtering, grouping, column visibility
- `@vates/flexi-table-react` — React adapter with `<DataTable>` component and `useTableState` hook; render props for custom cells and filter labels
- `@vates/flexi-table-vue` — Vue 3 adapter with `<DataTable>` component and `useTableState` composable; scoped slots for custom cells, filter labels, and group headers
- i18n via `labels` prop (defaults to French); all UI strings and pluralization functions are overridable
- Grouped columns automatically hide from the table header and reappear when grouping is cleared
- Group header values rendered with the same `render`/`format`/slot logic as table cells
