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
} from '@vates/flexi-table-core'
export { DEFAULT_LABELS } from '@vates/flexi-table-core'
export * from '@vates/flexi-table-core/locales'
