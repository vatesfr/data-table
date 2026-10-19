<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import {
  computeDropdownClampOffset,
  ddNavFocusables,
  ddOpenFocusTarget,
  keepDropdownClamped,
  viewportWidth,
} from '@vates/data-table-core/internal'

// Listeners like @dragover/@drop passed to <Dropdown> are meant for the menu panel itself (so a
// drag-and-drop reorder list inside can resolve a drop that lands past its last row / in
// unrelated dead space — see the Sort/Group/Columns dropdown drag handlers in
// DataTableView.vue), not the outer wrapper — inheritAttrs is off so `v-bind="$attrs"` below can
// target them there explicitly instead of falling through to the template's actual root element.
// A `@keydown` passed this way (the Filter dropdown's own pane-crossing nav — see
// onFilterDropdownKeydown in DataTableView.vue) is automatically merged by Vue with this
// component's own `onPanelKeydown` binding below (both fire; Vue's documented behavior for a
// fallthrough listener and an explicit template listener sharing the same event name on the same
// element), so a caller doesn't lose the base nav/Escape handling by supplying its own on top.
defineOptions({ inheritAttrs: false })

// Rows reached by the roving nav carry `data-dd-row`, the dropdown's own search box
// `data-dd-search` (core's DD_NAV_SELECTOR). The Filter dropdown's detail pane uses its own
// `data-dd-value-*` markers and nav (see FilterPane.vue), so this nav never sweeps it up.
const props = defineProps<{
  // Escape clears a non-empty search term first (focus stays put), only closing the dropdown on
  // a second press or when there was nothing to clear — each consumer wires its own search-clear
  // action here (it may own more than one search box, e.g. the Filter dropdown's column search
  // and its per-column value search; the callback itself decides which applies). Returns whether
  // it actually cleared something. Omitted for a panel with no search box at all (there's always
  // one here today, but the prop stays optional for a future dropdown that might not have one).
  onEscapeClearable?: () => boolean
}>()

const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
// The trigger content is caller-provided via the #trigger slot, so this wraps it just to give
// `focusTrigger` (see defineExpose below) something to query into after Escape closes the menu.
const triggerWrapRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const flipUp = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function focusTrigger() {
  triggerWrapRef.value?.querySelector<HTMLElement>('button, [tabindex]')?.focus()
}

// Exposed so a consumer's own code (e.g. the active-bar chips — see "Active-bar chip click
// actions") can open/close this dropdown and return focus to its trigger without needing to hoist
// `isOpen` itself into the parent. `isOpen` itself is also exposed (read-only in spirit — no
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
  focusTrigger,
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
  (open, _, onCleanup) => {
    if (!open) {
      flipUp.value = false
      return
    }
    const menu = menuRef.value
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    flipUp.value = computeDropdownClampOffset(rect, viewportWidth(), window.innerHeight).flipUp
    let dx = 0
    onCleanup(
      keepDropdownClamped(
        menu,
        () => dx,
        (next) => {
          dx = next
          menu.style.transform = next ? `translateX(${next}px)` : ''
        },
      ),
    )
    // Focus follows open, rather than leaving it on the trigger button — otherwise every open
    // still needs an extra Tab press before typing into a search box or using arrow-key nav does
    // anything. `[data-dd-search]` is a generic marker a consumer puts on whichever input should
    // be the default entry point, checked *ahead of* plain DOM order — deliberately, since e.g.
    // the Sort/Group dropdowns render their active-entries section *above* the search box, but
    // the search box is still the intended first stop. Falling back to the first focusable
    // descendant covers a dropdown with no search box at all (e.g. Sort when every column is
    // already sorted, so there's no addable section to search). On a touch screen, the first row
    // regardless, so the keyboard doesn't pop up (see ddOpenFocusTarget).
    ddOpenFocusTarget(menu)?.focus()
  },
  { flush: 'post' },
)

// Roving Up/Down/Home/End nav across the panel's own search box + rows, plus Escape. A distinct concern from any Alt+↑/↓
// reorder or Enter/Space toggle a row itself implements (see DataTableView.vue's
// onSortRowKeyDown/onGroupRowKeyDown/onColRowKeyDown) — those don't stopPropagation, so this still
// runs after them via bubbling, but its own `e.altKey` guard keeps it from ever acting on their
// modifier combo. Scoped to elements this panel actually recognizes
// (`all.indexOf(active) !== -1`) so it never interferes with unrelated controls elsewhere in the
// panel (e.g. the Filter dropdown's right-hand detail pane, which implements its own nav — see
// onFilterDropdownKeydown in DataTableView.vue — including native Left/Right/Up/Down/Home/End on
// its own range inputs/slider that must keep working unmolested).
function onPanelKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (props.onEscapeClearable?.()) return
    isOpen.value = false
    focusTrigger()
    return
  }
  if (e.altKey) return
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
  const menu = menuRef.value
  if (!menu) return
  // A CategorySubmenu (see that file) renders as a real descendant of this panel and implements
  // its own independent Up/Down/Home/End nav, scoped to its own rows and stopping propagation —
  // excluding its rows here keeps this panel-wide nav exactly as if the submenu weren't open,
  // rather than letting it wander into a floating submenu whose rows aren't visually part of
  // this list.
  const all = ddNavFocusables(menu).filter((el) => !el.closest('[data-category-submenu]'))
  const rows = all.filter((el) => !el.hasAttribute('data-dd-search'))
  const active = document.activeElement as HTMLElement | null
  if (!active || all.indexOf(active) === -1) return
  if (e.key === 'Home' || e.key === 'End') {
    if (rows.length === 0) return
    e.preventDefault()
    ;(e.key === 'Home' ? rows[0] : rows[rows.length - 1]).focus()
    return
  }
  const idx = all.indexOf(active)
  const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
  if (nextIdx < 0 || nextIdx >= all.length) return
  e.preventDefault()
  all[nextIdx].focus()
}
</script>

<template>
  <div ref="containerRef" class="dt-dd-wrap">
    <span style="display: inline-flex">
      <span ref="triggerWrapRef" style="display: contents" @click="toggle">
        <!-- Pass open state to trigger so it can style itself -->
        <slot name="trigger" :open="isOpen" />
      </span>
      <!--
        Rendered as a sibling of the trigger — inside the same outside-click boundary as the
        trigger and panel (so clicking it doesn't spuriously close the dropdown via onMousedown
        above), but outside the trigger's own @click toggle (so it never opens/closes the dropdown
        itself). Used for the Sort/Group/Filter toolbar's adjoining × clear button (see
        DataTableView.vue), visually merged into one pill with the trigger via shared CSS.
      -->
      <slot name="extra-trigger" />
    </span>
    <div
      v-if="isOpen"
      ref="menuRef"
      class="dt-dd"
      :class="{ 'dt-dd--up': flipUp }"
      v-bind="$attrs"
      @keydown="onPanelKeydown"
    >
      <slot />
    </div>
  </div>
</template>
