// Public API surface: small and deliberate; adapter-only code lives in `/internal` (see the README's "Public API surface").

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
// Locales hold only public locale objects
export * from './locales'

// Theme tokens stay on the `/theme` sub-path, out of React/Vue consumers' autocomplete.
