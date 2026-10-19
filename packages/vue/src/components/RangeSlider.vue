<script setup lang="ts">
// The "2 inputs + a slider" range control's slider half — two overlapping native
// <input type="range"> thumbs sharing one visual track (only the thumb itself is a hit target,
// via core's ::-webkit-slider-thumb/::-moz-range-thumb rules in DT_STYLES, so grabbing either one
// works regardless of z-order) plus a colored fill between them. `min`/`max` are the column's
// actual data bounds (see computeValueBounds); `low`/`high` are already sorted by the caller.
// `change` always receives already-sorted (low, high) — dragging one thumb past the other just
// swaps their visual roles on the next render rather than needing cross-clamping, the standard
// behavior for this two-native-inputs trick.
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
