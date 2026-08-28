<script setup lang="ts">
import { ref } from 'vue'
import { computeSubmenuPosition, ddNavFocusables } from '@vates/data-table-core/internal'

// Hover-intent delays (see CLAUDE.md's "Column categories") — a native OS/app-menu-style flyout
// opens on hover once its parent menu is already open. OPEN_DELAY avoids a flicker-open while the
// pointer merely sweeps across a category row on its way to something else; CLOSE_DELAY is
// longer, giving the pointer room to travel diagonally from the trigger into the submenu itself
// without the gap between them (however narrow) closing it prematurely. Click still opens/closes
// immediately (no delay), as do ArrowRight/Enter/Escape — matches Solid/React's identical
// component.
const OPEN_DELAY = 100
const CLOSE_DELAY = 250

// Vue's dropdown markup uses class-based row selectors, not the `data-dd-row` attribute React/
// Solid render (see DD_NAV_SELECTOR's own doc comment, core) — mirrors Dropdown.vue's own
// `DEFAULT_ROW_SELECTOR` (only the `button.dt__dd-item--clickable` part is reachable from inside
// a category submenu; the other row kinds it also matches never appear here).
const SUBMENU_ROW_SELECTOR = 'button.dt__dd-item--clickable'

const props = defineProps<{
  name: string
  // Controlled, not self-managed: the parent (Sort/Group/Columns' own DataTableView.vue block)
  // owns one shared "which category is open" value across every CategorySubmenu in its list, so
  // opening one always closes any other that was open in the same dropdown.
  isOpen: boolean
}>()
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
    if (submenuRef.value) ddNavFocusables(submenuRef.value, SUBMENU_ROW_SELECTOR)[0]?.focus()
  })
}
function openNow(focusFirst: boolean): void {
  cancelOpen()
  cancelClose()
  if (!props.isOpen) {
    if (triggerRef.value) {
      // Initial guess (right of the trigger, top-aligned) — corrected by the position-fixing
      // watcher below once the submenu's real size is known. Avoids a 0,0-positioned flash before
      // that measurement lands.
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

// Corrects the initial guess above once the portaled submenu's real size is known — a ref
// callback fires before this div's own children (the slotted rows) are appended, so the
// measurement needs to wait a tick, same as Dropdown.vue's own viewport-clamp watcher.
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
      window.innerWidth,
      window.innerHeight,
    )
    left.value = pos.left
    top.value = pos.top
  })
}

function onSubmenuKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'ArrowLeft') {
    e.preventDefault()
    e.stopPropagation()
    closeNow(true)
    return
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
  if (!submenuRef.value) return
  const focusables = ddNavFocusables(submenuRef.value, SUBMENU_ROW_SELECTOR)
  const active = document.activeElement as HTMLElement | null
  const idx = active ? focusables.indexOf(active) : -1
  if (idx === -1) return
  e.stopPropagation()
  if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault()
    ;(e.key === 'Home' ? focusables[0] : focusables[focusables.length - 1])?.focus()
    return
  }
  const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
  if (nextIdx < 0 || nextIdx >= focusables.length) return
  e.preventDefault()
  focusables[nextIdx]?.focus()
}

defineExpose({ triggerRef })
</script>

<template>
  <div class="dt__dd-category">
    <button
      ref="triggerRef"
      type="button"
      class="dt__dd-item dt__dd-item--clickable dt__dd-category-trigger"
      data-dd-row
      :data-category-name="props.name"
      :aria-expanded="props.isOpen"
      @mouseenter="scheduleOpen"
      @mouseleave="scheduleClose"
      @click="props.isOpen ? closeNow(false) : openNow(true)"
      @keydown="
        (e: KeyboardEvent) => {
          if (e.key === 'ArrowRight' && !props.isOpen) {
            e.preventDefault()
            openNow(true)
          }
        }
      "
    >
      <span class="dt__dd-category-label">{{ props.name }}</span>
      <span class="dt__dd-category-arrow">▸</span>
    </button>
    <Teleport to="body">
      <div
        v-if="props.isOpen"
        :ref="(el) => onSubmenuMounted(el as Element | null)"
        class="dt__dd-submenu"
        data-category-submenu
        :style="{ position: 'fixed', left: `${left}px`, top: `${top}px` }"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
        @keydown="onSubmenuKeydown"
      >
        <slot />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Vue's scoped CSS only stamps a component's own `data-v-*` scope id onto elements literally
   written in *its own* template — the trigger button/submenu div below are this component's own
   template (unlike the addable-column buttons rendered through `<slot />`, which stay stamped
   with DataTableView.vue's scope id and pick up its `.dt__dd-item`/`.dt__dd-item--clickable`
   rules there for free). So the base item look needs its own copy here too, mirroring
   ToolbarBtn.vue's same self-contained-styling convention for a child component that needs a
   shared `dt__`-prefixed look. */
.dt__dd-category {
  position: relative;
}
.dt__dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 13px;
  color: var(--color-text-primary);
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}
.dt__dd-item--clickable {
  cursor: pointer;
}
.dt__dd-item--clickable:hover,
.dt__dd-item--clickable:focus {
  background: var(--color-background-secondary);
}
.dt__dd-category-trigger {
  justify-content: space-between;
}
.dt__dd-category-label {
  flex: 1;
}
.dt__dd-category-arrow {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.dt__dd-submenu {
  z-index: 101;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 160px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 0;
}
</style>
