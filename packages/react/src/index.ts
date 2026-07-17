export { DataTable } from './DataTable'
export { DataTableView } from './DataTableView'
export { useTableState } from './useTableState'
export type { TableState } from './useTableState'
export { usePersistedView, useUrlView, resetView } from './persistence'
export type { ViewStateApi, UseUrlViewOptions, ResetViewOptions } from './persistence'
export { Badge } from './components/Badge'
export { ScoreBar } from './components/ScoreBar'
export type { BadgeProps, BadgeColorEntry } from './components/Badge'
export type { ScoreBarProps } from './components/ScoreBar'
export type { ColumnDef, DataTableProps, DataTableViewProps } from './types'
// Re-export core types & helpers that consumers need
export type {
  DataTableLabels,
  SortEntry,
  SortDir,
  RangeFilter,
  ColumnDefBase,
  TableViewState,
} from '@vates/data-table-core'
export { DEFAULT_LABELS } from '@vates/data-table-core'
export * from '@vates/data-table-core/locales'
