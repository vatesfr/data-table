import type { ColumnDefBase } from '@vates/data-table-core'

export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Returns a DOM node to render for this cell instead of a string. Takes priority over `format`. */
  render?: (value: unknown, row: TRow) => Node
}
