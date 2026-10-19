<script setup lang="ts">
import type { ColumnDefBase, RangeFilter } from '@vates/data-table-core'
import { rangePresetFilter, type rangeInputProps } from '@vates/data-table-core/internal'
import RangeSlider from './RangeSlider.vue'

type InputProps = ReturnType<typeof rangeInputProps>
type RangePreset = NonNullable<ColumnDefBase['rangePresets']>[number]

// The number-range and date-range filter panels' shared shape: a pair of min/max inputs plus the
// slider below them; value, placeholder and name come from core's rangeInputProps.
defineProps<{
  isDate: boolean
  min: InputProps
  max: InputProps
  presets: RangePreset[] | undefined
  activePreset: RangePreset | undefined
  slider: { min: number; max: number; low: number; high: number; step: number | 'any' } | null
}>()

const emit = defineEmits<{
  'update:min': [value: string]
  'update:max': [value: string]
  sliderChange: [low: number, high: number]
  setRange: [range: RangeFilter]
}>()
</script>

<template>
  <div style="padding: 4px 14px 8px">
    <div v-if="!isDate && presets?.length" class="dt-range-presets">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        class="dt-value-sort-btn dt-range-preset"
        :class="{ 'dt-filter-match-mode--active': preset === activePreset }"
        :aria-pressed="preset === activePreset"
        @click="
          emit(
            'setRange',
            preset === activePreset ? { min: '', max: '' } : rangePresetFilter(preset),
          )
        "
      >
        {{ preset.label }}
      </button>
    </div>
    <div style="display: flex; gap: 6px; align-items: center">
      <input
        :type="isDate ? 'date' : 'number'"
        :placeholder="min.placeholder"
        :aria-label="min.ariaLabel"
        :value="min.value"
        @input="emit('update:min', ($event.target as HTMLInputElement).value)"
        class="dt-range-input"
      />
      <span class="dt-range-sep">–</span>
      <input
        :type="isDate ? 'date' : 'number'"
        :placeholder="max.placeholder"
        :aria-label="max.ariaLabel"
        :value="max.value"
        @input="emit('update:max', ($event.target as HTMLInputElement).value)"
        class="dt-range-input"
      />
    </div>
    <RangeSlider
      v-if="slider"
      v-bind="slider"
      :min-label="min.ariaLabel"
      :max-label="max.ariaLabel"
      @change="(lo, hi) => emit('sliderChange', lo, hi)"
    />
  </div>
</template>
