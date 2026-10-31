import { Show } from 'solid-js'
import type { RangeFilter } from '@vates/data-table-core'
import { computeRangeSliderGeometry, formatRangeBound } from '@vates/data-table-core/internal'
import type { ColumnDef } from '../types'

interface RangeSliderProps<TRow extends object> {
  col: ColumnDef<TRow>
  rangeFilter: RangeFilter | undefined
  bounds: { min: number; max: number } | null
  minLabel: string
  maxLabel: string
  onCommit: (min: string, max: string) => void
}

// The range control's slider: two overlapping native range inputs on one track, applying the min/max
// of both thumbs on every tick. A <Show>, not an early return: the instance survives a column switch.
export function RangeSlider<TRow extends object>(props: RangeSliderProps<TRow>) {
  const isDate = () => props.col.type === 'date'
  const geo = () =>
    computeRangeSliderGeometry(props.rangeFilter, props.bounds ?? { min: 0, max: 0 }, isDate())
  const lo = () => geo().low
  const hi = () => geo().high
  const step = () => (isDate() ? String(24 * 60 * 60 * 1000) : 'any')
  const pctLo = () => geo().pctLo
  const pctHi = () => geo().pctHi

  let thumbA: HTMLInputElement | undefined
  let thumbB: HTMLInputElement | undefined
  function handleInput(): void {
    // Both thumbs are read fresh from the DOM (not from Solid state) so a drag on either one is
    // reflected immediately regardless of which one moved.
    const vals = [thumbA, thumbB]
      .filter((t): t is HTMLInputElement => !!t)
      .map((t) => Number(t.value))
    const newLo = Math.min(...vals)
    const newHi = Math.max(...vals)
    props.onCommit(formatRangeBound(newLo, props.col), formatRangeBound(newHi, props.col))
  }

  return (
    <Show when={props.bounds && props.bounds.min < props.bounds.max}>
      <div class="dt-range-slider">
        <div class="dt-range-slider-track" />
        <div
          class="dt-range-slider-fill"
          style={{ left: `${pctLo()}%`, right: `${100 - pctHi()}%` }}
        />
        <input
          type="range"
          class="dt-range-slider-thumb"
          min={props.bounds?.min}
          max={props.bounds?.max}
          step={step()}
          value={lo()}
          aria-label={props.minLabel}
          ref={thumbA}
          onInput={handleInput}
        />
        <input
          type="range"
          class="dt-range-slider-thumb"
          min={props.bounds?.min}
          max={props.bounds?.max}
          step={step()}
          value={hi()}
          aria-label={props.maxLabel}
          ref={thumbB}
          onInput={handleInput}
        />
      </div>
    </Show>
  )
}
