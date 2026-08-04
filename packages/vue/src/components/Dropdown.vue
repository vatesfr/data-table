<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
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

// The menu is destroyed/recreated by v-if on every open (see template), so each open starts
// from a fresh, unclamped node — `flush: 'post'` runs this after that node is actually in the
// DOM. Mutates the node's style directly rather than through reactive state, mirroring the
// vanilla/React clamp fix. A translateX offset is used for the horizontal case instead of
// flipping left:0 -> right:0, since the overflow is relative to the viewport, not to the
// trigger.
watch(
  isOpen,
  (open) => {
    if (!open) return
    const menu = menuRef.value
    if (!menu) return
    const margin = 8
    const rect = menu.getBoundingClientRect()
    let dx = 0
    if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right
    if (rect.left + dx < margin) dx = margin - rect.left
    if (dx !== 0) menu.style.transform = `translateX(${dx}px)`
    if (rect.bottom > window.innerHeight - margin) {
      menu.style.top = 'auto'
      menu.style.marginTop = '0'
      menu.style.bottom = '100%'
      menu.style.marginBottom = '4px'
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <div ref="containerRef" class="dropdown">
    <div @click="toggle">
      <!-- Pass open state to trigger so it can style itself -->
      <slot name="trigger" :open="isOpen" />
    </div>
    <div v-if="isOpen" ref="menuRef" class="dropdown__menu">
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
