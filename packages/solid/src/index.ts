import {
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
} from '@vates/data-table-core'

export type { ColumnDef } from './types'
export type {
  DataTableLabels,
  SortEntry,
  RangeFilter,
  TableViewState,
  DatePart,
  GetRowId,
  LogRangeOptions,
} from '@vates/data-table-core'
export { DEFAULT_LABELS } from '@vates/data-table-core'
export * from '@vates/data-table-core/locales'
// Ready-made groupValue/groupFormat pairs for bucketing a continuous/high-cardinality column
// (percentages, timestamps) into coarser groups — see `ColumnDefBase.groupValue` in the docs.
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
}
// Ready-made compare for pinning a value (missing data, by default) last regardless of sort
// direction — see `ColumnDefBase.compare` in the docs.
export { compareMissingLast }

export { createTableState } from './createTableState'
export type { TableState, CreateTableStateOptions } from './createTableState'
export { DataTableView } from './DataTableView'
export type { DataTableViewProps } from './DataTableView'
export { DataTable } from './DataTable'
export type { DataTableProps } from './DataTable'
export { usePersistedView, useUrlView, resetView, usePersistence } from './persistence'
export type {
  ViewStateApi,
  UseUrlViewOptions,
  ResetViewOptions,
  UsePersistenceOptions,
} from './persistence'
