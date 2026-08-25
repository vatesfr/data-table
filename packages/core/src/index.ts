// Public API surface for `@vates/data-table-core` — small and deliberate, for a consumer using
// this package directly. The bulk of core's logic exists purely so the adapter packages
// (`@vates/data-table-react`/`-vue`/`-solid`/`-vanilla`) can build their own `useTableState`/
// `createTableState`/persistence implementations, and lives instead in
// `@vates/data-table-core/internal` — NOT part of this barrel. See `internal.ts`'s own top
// comment and this package's README ("Public API surface") for the full reasoning.

export type {
  DataTableLabels,
  SortEntry,
  RangeFilter,
  ColumnDefBase,
  ValueSort,
  AggregateType,
} from './types'

export type { DatePart, LogRangeOptions, GetRowId } from './logic'

export {
  bucketNumericRange,
  formatNumericRange,
  numericRangeGroup,
  bucketDatePart,
  formatDatePart,
  datePartGroup,
  bucketLogRange,
  formatLogRange,
  logRangeGroup,
  compareMissingLast,
} from './logic'

export type { TableViewState } from './view'

export { LABELS_EN as DEFAULT_LABELS } from './locales'
// Locales module only contains public locale objects (no internal helpers), so a wildcard
// re-export here is safe and matches this barrel's pre-existing behavior.
export * from './locales'

// `theme` (LIGHT_THEME/DARK_THEME/renderThemeCss) is vanilla-adapter-only plumbing — it injects a
// <style> tag since vanilla has no CSS-in-JS/scoped-style mechanism of its own (React/Vue theme
// via inline styles / scoped CSS instead, see "Visual hierarchy" in the docs). Deliberately not
// re-exported from the main barrel so React/Vue consumers importing this package directly don't
// see irrelevant theme APIs in their autocomplete; it's still reachable via the dedicated
// `@vates/data-table-core/theme` sub-path export, same pattern as `/locales`.
