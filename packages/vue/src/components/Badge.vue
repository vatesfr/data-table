<script setup lang="ts">
export interface BadgeColorEntry {
  bg: string
  color: string
}

const props = defineProps<{
  value: string
  colorMap?: Record<string, BadgeColorEntry>
}>()

const style = () => {
  const c = props.colorMap?.[props.value]
  return { background: c?.bg ?? '#F1EFE8', color: c?.color ?? '#444441' }
}
</script>

<template>
  <span class="badge" :style="style()">{{ value }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
</style>
