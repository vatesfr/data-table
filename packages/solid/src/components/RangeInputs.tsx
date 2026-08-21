import type { RangeFilter } from '@vates/data-table-core'
import type { ColumnDef } from '../types'
import { formatRangeBound } from './formatRangeBound'
import { RangeSlider } from './RangeSlider'

interface RangeInputsProps<TRow extends object> {
  col: ColumnDef<TRow>
  rangeFilter: RangeFilter | undefined
  bounds: { min: number; max: number } | null
  minLabel: string
  maxLabel: string
  onChange: (kind: 'min' | 'max', value: string) => void
  onSliderCommit: (min: string, max: string) => void
}

/**
 * The plain min/max inputs (+ RangeSlider below them) for a number/date range filter — the two
 * types used to be two near-identical blocks in FilterDropdown.tsx's number/date `<Show>`
 * branches, differing only in `<input type>`/`inputmode`, whether the label is a placeholder
 * (number) or aria-label (date, since a native date input has no room for placeholder text), and
 * — previously a latent inconsistency fixed by unifying the two here — the date input was
 * missing the `dt-range-input` class the number input already carried, so `styles.ts`'s
 * `.dt-range-input[type=date]` width rule never actually matched a date input in practice.
 */
export function RangeInputs<TRow extends object>(props: RangeInputsProps<TRow>) {
  const isDate = () => props.col.type === 'date'
  const valueFor = (kind: 'min' | 'max') =>
    props.rangeFilter?.[kind] ??
    (props.bounds ? formatRangeBound(props.bounds[kind], props.col) : '')

  return (
    <div style={{ padding: '4px 14px 8px' }}>
      <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
        <input
          type={isDate() ? 'date' : 'text'}
          inputmode={isDate() ? undefined : 'decimal'}
          class="dt-range-input"
          placeholder={isDate() ? undefined : props.minLabel}
          aria-label={isDate() ? props.minLabel : undefined}
          value={valueFor('min')}
          onInput={(e) => props.onChange('min', e.currentTarget.value)}
        />
        <span class="dt-range-sep">–</span>
        <input
          type={isDate() ? 'date' : 'text'}
          inputmode={isDate() ? undefined : 'decimal'}
          class="dt-range-input"
          placeholder={isDate() ? undefined : props.maxLabel}
          aria-label={isDate() ? props.maxLabel : undefined}
          value={valueFor('max')}
          onInput={(e) => props.onChange('max', e.currentTarget.value)}
        />
      </div>
      <RangeSlider
        col={props.col}
        rangeFilter={props.rangeFilter}
        bounds={props.bounds}
        onCommit={props.onSliderCommit}
      />
    </div>
  )
}
