<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <button class="toolbar-btn" :class="{ 'toolbar-btn--active': active }">
    <slot />
  </button>
</template>

<style scoped>
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-primary);
  font-family: inherit;
  white-space: nowrap;
}
.toolbar-btn--active {
  background: var(--color-background-secondary);
}
</style>
