<script setup lang="ts">
// The "2 inputs + a slider" range control's slider half — two overlapping native
// <input type="range"> thumbs sharing one visual track (only the thumb itself is a hit target,
// via the scoped ::-webkit-slider-thumb/::-moz-range-thumb rules below, so grabbing either one
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
}>()

const emit = defineEmits<{
  change: [low: number, high: number]
}>()

function handleThumb(raw: number, other: number): void {
  emit('change', Math.min(raw, other), Math.max(raw, other))
}
</script>

<template>
  <div class="dt__range-slider">
    <div class="dt__range-slider-track" />
    <div
      class="dt__range-slider-fill"
      :style="{
        left: `${((low - min) / (max - min)) * 100}%`,
        right: `${100 - ((high - min) / (max - min)) * 100}%`,
      }"
    />
    <input
      type="range"
      class="dt__range-slider-thumb"
      :min="min"
      :max="max"
      :step="step"
      :value="low"
      @input="handleThumb(Number(($event.target as HTMLInputElement).value), high)"
    />
    <input
      type="range"
      class="dt__range-slider-thumb"
      :min="min"
      :max="max"
      :step="step"
      :value="high"
      @input="handleThumb(Number(($event.target as HTMLInputElement).value), low)"
    />
  </div>
</template>

<style scoped>
.dt__range-slider {
  position: relative;
  height: 22px;
  margin: 8px 2px 2px;
}
.dt__range-slider-track {
  position: absolute;
  top: 50%;
  left: 7px;
  right: 7px;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: var(--color-border-secondary);
}
.dt__range-slider-fill {
  position: absolute;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: var(--color-text-info);
}
.dt__range-slider-thumb {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  width: 100%;
  height: 22px;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  pointer-events: none;
}
.dt__range-slider-thumb::-webkit-slider-runnable-track {
  background: transparent;
}
.dt__range-slider-thumb::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: auto;
  width: 14px;
  height: 14px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--color-text-info);
  border: 2px solid var(--color-background-primary);
  box-shadow: 0 0 0 1px var(--color-border-info);
  cursor: pointer;
}
.dt__range-slider-thumb::-moz-range-track {
  background: transparent;
  border: none;
}
.dt__range-slider-thumb::-moz-range-thumb {
  pointer-events: auto;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-text-info);
  border: 2px solid var(--color-background-primary);
  box-shadow: 0 0 0 1px var(--color-border-info);
  cursor: pointer;
}
</style>
