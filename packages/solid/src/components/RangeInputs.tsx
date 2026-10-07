import type { RangeFilter } from '@vates/data-table-core'
import {
  matchingRangePreset,
  rangeInputProps,
  rangePresetFilter,
} from '@vates/data-table-core/internal'
import { For, Show } from 'solid-js'
import type { ColumnDef } from '../types'
import { RangeSlider } from './RangeSlider'

interface RangeInputsProps<TRow extends object> {
  col: ColumnDef<TRow>
  rangeFilter: RangeFilter | undefined
  bounds: { min: number; max: number } | null
  minLabel: string
  maxLabel: string
  onChange: (kind: 'min' | 'max', value: string) => void
  onSetRange: (min: string, max: string) => void
}

/**
 * The min/max inputs (+ RangeSlider below them) for a number/date range filter. Value,
 * placeholder and name come from core's `rangeInputProps`.
 */
export function RangeInputs<TRow extends object>(props: RangeInputsProps<TRow>) {
  const isDate = () => props.col.type === 'date'
  const min = () =>
    rangeInputProps(props.col, 'min', props.rangeFilter, props.bounds, props.minLabel)
  const max = () =>
    rangeInputProps(props.col, 'max', props.rangeFilter, props.bounds, props.maxLabel)

  return (
    <div style={{ padding: '4px 14px 8px' }}>
      <Show when={!isDate() && props.col.rangePresets?.length}>
        <div class="dt-range-presets">
          <For each={props.col.rangePresets}>
            {(preset) => {
              const pressed = () => matchingRangePreset(props.col, props.rangeFilter) === preset
              return (
                <button
                  type="button"
                  class="dt-value-sort-btn dt-range-preset"
                  classList={{ 'dt-filter-match-mode--active': pressed() }}
                  aria-pressed={pressed()}
                  onClick={() => {
                    const range = pressed() ? { min: '', max: '' } : rangePresetFilter(preset)
                    props.onSetRange(range.min, range.max)
                  }}
                >
                  {preset.label}
                </button>
              )
            }}
          </For>
        </div>
      </Show>
      <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
        <input
          type={isDate() ? 'date' : 'text'}
          inputmode={isDate() ? undefined : 'decimal'}
          class="dt-range-input"
          placeholder={min().placeholder}
          aria-label={min().ariaLabel}
          value={min().value}
          onInput={(e) => props.onChange('min', e.currentTarget.value)}
        />
        <span class="dt-range-sep">–</span>
        <input
          type={isDate() ? 'date' : 'text'}
          inputmode={isDate() ? undefined : 'decimal'}
          class="dt-range-input"
          placeholder={max().placeholder}
          aria-label={max().ariaLabel}
          value={max().value}
          onInput={(e) => props.onChange('max', e.currentTarget.value)}
        />
      </div>
      <RangeSlider
        col={props.col}
        rangeFilter={props.rangeFilter}
        bounds={props.bounds}
        minLabel={min().ariaLabel}
        maxLabel={max().ariaLabel}
        onCommit={props.onSetRange}
      />
    </div>
  )
}
