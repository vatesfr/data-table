import type { JSXElement } from 'solid-js'
import type { ColumnDefBase } from '@vates/data-table-core'

// Vanilla keeps a hand-synced copy: its types can't reference this bundled package
export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Returns JSX (or a DOM node) to render for this cell instead of a string. Takes priority over `format`. */
  render?: (value: unknown, row: TRow) => JSXElement
  /**
   * Render a custom label in filter dropdown options. Not applied to `type: 'date'` columns, whose
   * tree nodes don't map to one raw value.
   */
  renderFilterLabel?: (value: string) => JSXElement
}
