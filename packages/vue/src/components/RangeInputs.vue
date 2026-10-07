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
  <div class="dt__range">
    <div v-if="!isDate && presets?.length" class="dt__range-presets">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        class="dt__value-sort-btn dt__range-preset"
        :class="{ 'dt__filter-match-mode--active': preset === activePreset }"
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
    <div class="dt__range-inputs">
      <input
        :type="isDate ? 'date' : 'number'"
        :placeholder="min.placeholder"
        :aria-label="min.ariaLabel"
        :value="min.value"
        @input="emit('update:min', ($event.target as HTMLInputElement).value)"
        :class="['dt__range-input', { 'dt__range-input--date': isDate }]"
      />
      <span class="dt__range-sep">–</span>
      <input
        :type="isDate ? 'date' : 'number'"
        :placeholder="max.placeholder"
        :aria-label="max.ariaLabel"
        :value="max.value"
        @input="emit('update:max', ($event.target as HTMLInputElement).value)"
        :class="['dt__range-input', { 'dt__range-input--date': isDate }]"
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

<style scoped>
.dt__range {
  padding: 4px 14px 8px;
}
.dt__range-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.dt__range-preset {
  min-height: 24px;
}
.dt__range-inputs {
  display: flex;
  gap: 6px;
  align-items: center;
}
.dt__range-sep {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.dt__range-input {
  width: 80px;
  padding: 3px 6px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 4px;
  font-family: inherit;
  background: transparent;
  color: inherit;
}
.dt__range-input--date {
  width: 118px;
}
</style>
