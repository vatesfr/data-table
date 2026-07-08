import type { ColumnDefBase, DataTableLabels } from '@vates/data-table-core'

// Vue uses scoped slots instead of render functions — no extra fields needed.
export type ColumnDef<TRow extends object = Record<string, unknown>> = ColumnDefBase<TRow>

export interface DataTableProps<TRow extends object = Record<string, unknown>> {
  data: TRow[]
  columns: ColumnDef<TRow>[]
  rowKey?: string
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  selectable?: boolean
}
