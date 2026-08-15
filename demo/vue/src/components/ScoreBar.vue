<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max?: number
  }>(),
  { max: 100 },
)

const pct = computed(() => Math.min(100, Math.max(0, (props.value / props.max) * 100)))
const color = computed(() =>
  pct.value >= 90 ? '#3B6D11' : pct.value >= 75 ? '#185FA5' : '#A32D2D',
)
</script>

<template>
  <div class="score-bar">
    <div class="score-bar__track">
      <div class="score-bar__fill" :style="{ width: `${pct}%`, background: color }" />
    </div>
    <span class="score-bar__label" :style="{ color }">{{ value }}</span>
  </div>
</template>

<style scoped>
.score-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.score-bar__track {
  flex: 1;
  height: 6px;
  background: #f1efe8;
  border-radius: 3px;
  overflow: hidden;
}
.score-bar__fill {
  height: 100%;
  border-radius: 3px;
}
.score-bar__label {
  font-size: 12px;
  min-width: 26px;
}
</style>
