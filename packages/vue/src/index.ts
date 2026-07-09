export { default as DataTable } from './DataTable.vue'
export { default as Badge } from './components/Badge.vue'
export { default as ScoreBar } from './components/ScoreBar.vue'
export { useTableState } from './useTableState'
export { usePersistedView, useUrlView } from './persistence'
export type { ViewStateApi, UseUrlViewOptions } from './persistence'
export type { ColumnDef, DataTableProps } from './types'
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
