export { DataTable } from './DataTable'
export { useTableState } from './useTableState'
export { Badge } from './components/Badge'
export { ScoreBar } from './components/ScoreBar'
export type { BadgeProps, BadgeColorEntry } from './components/Badge'
export type { ScoreBarProps } from './components/ScoreBar'
export type { ColumnDef, DataTableProps } from './types'
// Re-export core types & helpers that consumers need
export type {
  DataTableLabels,
  SortEntry,
  SortDir,
  RangeFilter,
  ColumnDefBase,
} from '@vates/data-table-core'
export { DEFAULT_LABELS } from '@vates/data-table-core'
export * from '@vates/data-table-core/locales'
