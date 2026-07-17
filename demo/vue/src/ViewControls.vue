<script setup lang="ts">
import { ref } from 'vue'

// Shared by every table section in App.vue: "Copy share link" copies the whole page URL (every
// section's state round-trips through its own query param, see VIEW_KEYS in App.vue); "Reset"
// emits so the caller can clear just its own table's storageKey/paramName via resetView.
const emit = defineEmits<{ reset: [] }>()
const copied = ref(false)

function copyShareLink() {
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const btnStyle = {
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid var(--color-border-secondary)',
  cursor: 'pointer',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-secondary)',
  fontSize: '13px',
  fontFamily: 'inherit',
}
</script>

<template>
  <div style="display: flex; gap: 8px; margin-bottom: 12px">
    <button :style="btnStyle" @click="copyShareLink">
      {{ copied ? 'Copied!' : 'Copy share link' }}
    </button>
    <button :style="btnStyle" @click="emit('reset')">Reset</button>
  </div>
</template>
