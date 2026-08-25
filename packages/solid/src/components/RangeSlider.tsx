import { Show } from 'solid-js'
import {
  computeRangeSliderGeometry,
  formatRangeBound,
  type RangeFilter,
} from '@vates/data-table-core'
import type { ColumnDef } from '../types'

interface RangeSliderProps<TRow extends object> {
  col: ColumnDef<TRow>
  rangeFilter: RangeFilter | undefined
  bounds: { min: number; max: number } | null
  onCommit: (min: string, max: string) => void
}

// "2 inputs + a slider" range control (see CLAUDE.md's "type: 'number'/'type: 'date' range
// filters get a slider") — two overlapping native <input type="range"> thumbs sharing one visual
// track (styles.ts makes only the thumb itself a hit target). Both thumbs share one onInput:
// the actual applied min/max is always Math.min/Math.max of both thumbs' live values, so dragging
// one thumb past the other just swaps their visual roles instead of needing cross-clamping.
//
// Unlike the old vanilla code (which had to split range-slider handling across `input`/`change`
// events specifically to avoid destroying the dragged thumb mid-drag via a full innerHTML
// rebuild), Solid's controlled inputs update the same DOM node in place — dragging is never
// disturbed by a state-driven re-render, so every tick can commit directly. Same simplification
// React/Vue's own equivalents already got for free.
//
// The "no bounds" (or degenerate min>=max) case is a reactive <Show>, not an early `return null`
// in the setup body — this component's props can change identity (switching the active filter
// column between two number/date columns) while the JSX position that renders it stays the same,
// so Solid keeps this same instance mounted rather than remounting a fresh one; an early return
// evaluated once at setup time would freeze on whatever the first column's bounds happened to be.
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
          aria-label="min"
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
          aria-label="max"
          ref={thumbB}
          onInput={handleInput}
        />
      </div>
    </Show>
  )
}
