<script setup lang="ts">
import { ref } from 'vue'
import {
  computeSubmenuPosition,
  ddNavFocusables,
  rovingFocusTarget,
  viewportWidth,
} from '@vates/data-table-core/internal'

// Hover-intent delays: no flicker-open on a passing pointer, room to travel diagonally into the flyout (docs/columns.md's "Column categories")
const OPEN_DELAY = 100
const CLOSE_DELAY = 250

// A fixed, non-teleported flyout with its own ↑/↓ nav (docs/columns.md's "Column categories")

const props = defineProps<{
  name: string
  // Controlled: the parent's single open-category value closes any sibling
  isOpen: boolean
  /** Names the flyout as a group (the header menu's filter controls) */
  groupLabel?: string
  /** Extra class on the flyout */
  submenuClass?: string
}>()
// `icon`: shown before `name` (the header menu's Filter item)
defineSlots<{ default?: () => unknown; icon?: () => unknown }>()
const emit = defineEmits<{ open: []; close: [] }>()

const left = ref(0)
const top = ref(0)
const triggerRef = ref<HTMLButtonElement | null>(null)
const submenuRef = ref<HTMLDivElement | null>(null)
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

function cancelOpen(): void {
  if (openTimer) {
    clearTimeout(openTimer)
    openTimer = undefined
  }
}
function cancelClose(): void {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

function focusFirstRow(): void {
  queueMicrotask(() => {
    const el = submenuRef.value
    if (!el) return
    // A flyout without rows (the header menu's filter pane) starts on its first text field
    ;(
      ddNavFocusables(el)[0] ??
      el.querySelector<HTMLElement>('input[type=text]') ??
      el.querySelector<HTMLElement>('input, button')
    )?.focus()
  })
}
function openNow(focusFirst: boolean): void {
  cancelOpen()
  cancelClose()
  if (!props.isOpen) {
    if (triggerRef.value) {
      // Initial guess, corrected once the submenu is measured
      const rect = triggerRef.value.getBoundingClientRect()
      left.value = rect.right
      top.value = rect.top
    }
    emit('open')
  }
  if (focusFirst) focusFirstRow()
}
function closeNow(focusTrigger: boolean): void {
  cancelOpen()
  cancelClose()
  if (props.isOpen) emit('close')
  if (focusTrigger) triggerRef.value?.focus()
}
function scheduleOpen(): void {
  cancelClose()
  if (props.isOpen || openTimer) return
  openTimer = setTimeout(() => {
    openTimer = undefined
    openNow(false)
  }, OPEN_DELAY)
}
function scheduleClose(): void {
  cancelOpen()
  if (closeTimer) return
  closeTimer = setTimeout(() => {
    closeTimer = undefined
    closeNow(false)
  }, CLOSE_DELAY)
}

// Measures a tick later: the ref callback fires before the slotted rows are appended
function onSubmenuMounted(el: Element | null): void {
  submenuRef.value = el as HTMLDivElement | null
  if (!submenuRef.value) return
  queueMicrotask(() => {
    if (!submenuRef.value || !triggerRef.value) return
    const triggerRect = triggerRef.value.getBoundingClientRect()
    const rect = submenuRef.value.getBoundingClientRect()
    const pos = computeSubmenuPosition(
      triggerRect,
      { width: rect.width, height: rect.height },
      viewportWidth(),
      window.innerHeight,
    )
    left.value = pos.left
    top.value = pos.top
  })
}

function onSubmenuKeydown(e: KeyboardEvent): void {
  // ← in a text field moves its caret instead
  const inText = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox'
  if (e.key === 'Escape' || (e.key === 'ArrowLeft' && !inText)) {
    e.preventDefault()
    e.stopPropagation()
    closeNow(true)
    return
  }
  if (!submenuRef.value) return
  const target = rovingFocusTarget(e.key, ddNavFocusables(submenuRef.value), document.activeElement)
  if (!target) return
  e.preventDefault()
  e.stopPropagation()
  target.focus()
}

defineExpose({ triggerRef })
</script>

<template>
  <div class="dt-dd-category">
    <button
      ref="triggerRef"
      type="button"
      class="dt-dd-item dt-dd-item--click dt-dd-category-trigger"
      data-dd-row
      :data-category-name="props.name"
      :aria-expanded="props.isOpen"
      @mouseenter="scheduleOpen"
      @mouseleave="scheduleClose"
      @click="openNow(true)"
      @keydown="
        (e: KeyboardEvent) => {
          if (e.key === 'ArrowRight' && !props.isOpen) {
            e.preventDefault()
            openNow(true)
          }
        }
      "
    >
      <slot name="icon" />
      <span class="dt-flex1">{{ props.name }}</span>
      <span class="dt-dd-category-arrow">▸</span>
    </button>
    <div
      v-if="props.isOpen"
      :ref="(el) => onSubmenuMounted(el as Element | null)"
      :class="['dt-dd-submenu', props.submenuClass]"
      data-category-submenu
      :role="props.groupLabel ? 'group' : undefined"
      :aria-label="props.groupLabel"
      :style="{ position: 'fixed', left: `${left}px`, top: `${top}px` }"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
      @keydown="onSubmenuKeydown"
    >
      <slot />
    </div>
  </div>
</template>
