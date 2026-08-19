import {
  bucketNumericRange,
  formatNumericRange,
  bucketDatePart,
  formatDatePart,
  compareMissingLast,
} from '@vates/data-table-core'

export type { ColumnDef } from './types'
export type { DataTableLabels, TableViewState, DatePart } from '@vates/data-table-core'
export * from '@vates/data-table-core/locales'
// Ready-made groupValue/groupFormat pairs for bucketing a continuous/high-cardinality column
// (percentages, timestamps) into coarser groups — see `ColumnDefBase.groupValue` in the docs.
export { bucketNumericRange, formatNumericRange, bucketDatePart, formatDatePart }
// Ready-made compare for pinning a value (missing data, by default) last regardless of sort
// direction — see `ColumnDefBase.compare` in the docs.
export { compareMissingLast }

export { createTableState } from './createTableState'
export type { TableState, CreateTableStateOptions } from './createTableState'
export { DataTableView } from './DataTableView'
export type { DataTableViewProps } from './DataTableView'
export { DataTable } from './DataTable'
export type { DataTableProps } from './DataTable'
