<script setup lang="ts">
defineProps<{
  // Squares off the right edge so the button merges with its adjoining × clear button (see
  // Dropdown's `extra-trigger` slot), shown whenever the dropdown has anything active.
  active?: boolean
}>()
</script>

<template>
  <button type="button" class="dt-btn" :class="{ 'dt-btn--active dt-btn--grouped': active }">
    <slot />
  </button>
</template>
