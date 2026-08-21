<script setup lang="ts">
import RangeSlider from './RangeSlider.vue'

// The number-range and date-range filter panels' shared shape: a pair of min/max inputs plus the
// slider below them. The two types differ only in <input type>, whether the label is a
// placeholder (number) or aria-label (date, since a native date input has no room for
// placeholder text), and the date input's own fixed-width modifier class.
defineProps<{
  isDate: boolean
  min: string
  max: string
  minLabel: string
  maxLabel: string
  slider: { min: number; max: number; low: number; high: number; step: number | 'any' } | null
}>()

const emit = defineEmits<{
  'update:min': [value: string]
  'update:max': [value: string]
  sliderChange: [low: number, high: number]
}>()
</script>

<template>
  <div class="dt__range">
    <div class="dt__range-inputs">
      <input
        :type="isDate ? 'date' : 'number'"
        :placeholder="isDate ? undefined : minLabel"
        :aria-label="isDate ? minLabel : undefined"
        :value="min"
        @input="emit('update:min', ($event.target as HTMLInputElement).value)"
        :class="['dt__range-input', { 'dt__range-input--date': isDate }]"
      />
      <span class="dt__range-sep">–</span>
      <input
        :type="isDate ? 'date' : 'number'"
        :placeholder="isDate ? undefined : maxLabel"
        :aria-label="isDate ? maxLabel : undefined"
        :value="max"
        @input="emit('update:max', ($event.target as HTMLInputElement).value)"
        :class="['dt__range-input', { 'dt__range-input--date': isDate }]"
      />
    </div>
    <RangeSlider v-if="slider" v-bind="slider" @change="(lo, hi) => emit('sliderChange', lo, hi)" />
  </div>
</template>

<style scoped>
.dt__range {
  padding: 4px 14px 8px;
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
