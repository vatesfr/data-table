<script setup lang="ts">
defineProps<{
  active?: boolean
  // True when an adjoining × clear button (see Dropdown's `extra-trigger` slot) is rendered
  // right after this one — squares off the right edge and drops the right border so the pair
  // reads as one merged pill instead of two separate buttons with a seam.
  grouped?: boolean
}>()
</script>

<template>
  <button
    class="toolbar-btn"
    :class="{ 'toolbar-btn--active': active, 'toolbar-btn--grouped': grouped }"
  >
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
.toolbar-btn--grouped {
  border-radius: 6px 0 0 6px;
  border-right: none;
}
</style>
