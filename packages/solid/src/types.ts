import type { ColumnDefBase } from '@vates/data-table-core'

// @vates/data-table-vanilla declares a structurally identical copy of this interface, rather
// than importing it from here — its published dist/index.d.ts must never reference a type from
// this package, since @vates/data-table-solid is bundled there as an internal implementation
// detail, not a real dependency (see that package's own types.ts for the full reasoning). Keep
// the two in sync by hand if this shape changes; nothing enforces it automatically.
export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Returns a DOM node to render for this cell instead of a string. Takes priority over `format`. */
  render?: (value: unknown, row: TRow) => Node
}
