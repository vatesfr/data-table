<script setup lang="ts">
// The range control's slider: two overlapping native range inputs on one track; `change` gets sorted (low, high)
defineProps<{
  min: number
  max: number
  low: number
  high: number
  step: number | 'any'
  minLabel: string
  maxLabel: string
}>()

const emit = defineEmits<{
  change: [low: number, high: number]
}>()

function handleThumb(raw: number, other: number): void {
  emit('change', Math.min(raw, other), Math.max(raw, other))
}
</script>

<template>
  <div class="dt-range-slider">
    <div class="dt-range-slider-track" />
    <div
      class="dt-range-slider-fill"
      :style="{
        left: `${((low - min) / (max - min)) * 100}%`,
        right: `${100 - ((high - min) / (max - min)) * 100}%`,
      }"
    />
    <input
      type="range"
      class="dt-range-slider-thumb"
      :min="min"
      :max="max"
      :step="step"
      :value="low"
      :aria-label="minLabel"
      @input="handleThumb(Number(($event.target as HTMLInputElement).value), high)"
    />
    <input
      type="range"
      class="dt-range-slider-thumb"
      :min="min"
      :max="max"
      :step="step"
      :value="high"
      :aria-label="maxLabel"
      @input="handleThumb(Number(($event.target as HTMLInputElement).value), low)"
    />
  </div>
</template>
