import type { ColumnDef } from '../types'

/** Converts a bound (epoch ms for `type: 'date'`, a plain number otherwise) back into the string
 * shape `RangeFilter.min`/`.max` expects. Shared by RangeSlider.tsx (the slider thumbs' commit)
 * and FilterDropdown.tsx (the plain min/max inputs' default-to-bounds display) — both consumers
 * of a column's numeric/date bounds, so they'd otherwise drift out of sync with each other. */
export function formatRangeBound<TRow extends object>(n: number, col: ColumnDef<TRow>): string {
  return col.type === 'date' ? new Date(n).toISOString().slice(0, 10) : String(n)
}
