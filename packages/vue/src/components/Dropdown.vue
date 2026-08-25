<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { computeDropdownClampOffset } from '@vates/data-table-core/dropdownDomUtils'

// Listeners like @dragover/@drop passed to <Dropdown> are meant for the menu panel itself (so a
// drag-and-drop reorder list inside can resolve a drop that lands past its last row / in
// unrelated dead space — see the Sort/Group/Columns dropdown drag handlers in
// DataTableView.vue), not the outer wrapper — inheritAttrs is off so `v-bind="$attrs"` below can
// target them there explicitly instead of falling through to the template's actual root element.
defineOptions({ inheritAttrs: false })

const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
// The trigger content is caller-provided via the #trigger slot, so this wraps it just to give
// `focusTrigger` (see defineExpose below) something to query into after Escape closes the menu.
const triggerWrapRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

// Exposed so a consumer's own keydown handler (see DataTableView.vue's Escape handling — clear a
// non-empty search term first, close the dropdown on a second press) can close this dropdown and
// return focus to its trigger without needing to hoist `isOpen` itself into the parent. `open` is
// used the same way by the active-bar chips (see "Active-bar chip click actions") — a Group/Filter
// chip's body opens straight to that entry/column rather than requiring the dropdown to be
// reopened and re-navigated by hand. `isOpen` itself is also exposed (read-only in spirit — no
// consumer should assign it directly, `open`/`close` exist for that) so a consumer can `watch` it
// reactively, e.g. the Filter dropdown's column-ordering snapshot (DataTableView.vue), which needs
// to know exactly when the dropdown transitions closed→open without hoisting the state itself.
defineExpose({
  isOpen,
  open: () => {
    isOpen.value = true
  },
  close: () => {
    isOpen.value = false
  },
  focusTrigger: () => {
    triggerWrapRef.value?.querySelector<HTMLElement>('button, [tabindex]')?.focus()
  },
})

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
    const rect = menu.getBoundingClientRect()
    const { dx, flipUp } = computeDropdownClampOffset(rect, window.innerWidth, window.innerHeight)
    if (dx !== 0) menu.style.transform = `translateX(${dx}px)`
    if (flipUp) {
      menu.style.top = 'auto'
      menu.style.marginTop = '0'
      menu.style.bottom = '100%'
      menu.style.marginBottom = '4px'
    }
    // Focus follows open, rather than leaving it on the trigger button — otherwise every open
    // still needs an extra Tab press before typing into a search box or using arrow-key nav does
    // anything. `[data-dd-search]` is a generic marker a consumer puts on whichever input should
    // be the default entry point, checked *ahead of* plain DOM order — deliberately, since e.g.
    // the Sort/Group dropdowns render their active-entries section *above* the search box, but
    // the search box is still the intended first stop. Falling back to the first focusable
    // descendant covers a dropdown with no search box at all (e.g. Sort when every column is
    // already sorted, so there's no addable section to search).
    const focusTarget =
      menu.querySelector<HTMLElement>('[data-dd-search]') ??
      menu.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    focusTarget?.focus()
  },
  { flush: 'post' },
)
</script>

<template>
  <div ref="containerRef" class="dropdown">
    <div ref="triggerWrapRef" @click="toggle">
      <!-- Pass open state to trigger so it can style itself -->
      <slot name="trigger" :open="isOpen" />
    </div>
    <!--
      Rendered as a sibling of the trigger — inside the same outside-click boundary as the
      trigger and panel (so clicking it doesn't spuriously close the dropdown via onMousedown
      above), but outside the trigger's own @click toggle (so it never opens/closes the dropdown
      itself). Used for the Sort/Group/Filter toolbar's adjoining × clear button (see
      DataTableView.vue), visually merged into one pill with the trigger via shared CSS.
    -->
    <slot name="extra-trigger" />
    <div v-if="isOpen" ref="menuRef" class="dropdown__menu" v-bind="$attrs">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-flex;
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
  /* Previously unbounded — a table with many columns could render a dropdown taller than the
     viewport with no way to scroll it. .dt__filter-panel's own max-height: 380px stays comfortably
     under this, so it never needs this outer scrollbar too. */
  max-height: 420px;
  overflow-y: auto;
}
</style>
