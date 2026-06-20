<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const containerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function onMousedown(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onMousedown))
</script>

<template>
  <div ref="containerRef" class="dropdown">
    <div @click="toggle">
      <!-- Pass open state to trigger so it can style itself -->
      <slot name="trigger" :open="isOpen" />
    </div>
    <div v-if="isOpen" class="dropdown__menu">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
}
.dropdown__menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  margin-top: 4px;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 220px;
  padding: 4px 0;
}
</style>
