<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { computeDropdownClampOffset, ddNavFocusables } from '@vates/data-table-core/internal'

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

// The row-list selector shared by the Columns/Sort/Group dropdowns and the Filter dropdown's own
// left column pane (see each dropdown's own template in DataTableView.vue for what these classes
// mark: a column checkbox row, a Sort/Group active or addable entry, a Filter column-selector
// button, a Filter category header). `button.dt__dd-item--clickable` (not just
// `.dt__dd-item--clickable`) is deliberately tag-scoped — that class is also used by the Columns
// row's inner <label> and by the Filter value-checklist's row <label>s, both of which must NOT be
// swept up here: the checklist has its own separate, differently-scoped nav (see
// onFilterDropdownKeydown in DataTableView.vue).
const DEFAULT_ROW_SELECTOR =
  '.dt__dd-item--colrow, .dt__dd-item--sortrow, .dt__dd-item--grouprow, button.dt__dd-item--clickable, .dt__filter-col-item, .dt__filter-category-header'

const props = withDefaults(
  defineProps<{
    // Selector for this panel's own "rows" (search input is always matched separately via
    // `input[data-dd-search]`, see below) — defaults to the shared selector above, which already
    // covers every Columns/Sort/Group row plus the Filter dropdown's left-pane column buttons.
    rowSelector?: string
    // Scopes the roving-nav row query to a descendant of the panel instead of the whole panel —
    // needed by the Filter dropdown, whose panel also contains a right-hand detail pane with its
    // own separate nav (ArrowLeft/Right pane-crossing, its own Up/Down/Home/End over the
    // checklist/date-tree — see onFilterDropdownKeydown in DataTableView.vue) that this base nav
    // must not sweep up. Omitted for every other dropdown, whose whole panel is one row list.
    navRoot?: string
    // Escape clears a non-empty search term first (focus stays put), only closing the dropdown on
    // a second press or when there was nothing to clear — each consumer wires its own search-clear
    // action here (it may own more than one search box, e.g. the Filter dropdown's column search
    // and its per-column value search; the callback itself decides which applies). Returns whether
    // it actually cleared something. Omitted for a panel with no search box at all (there's always
    // one here today, but the prop stays optional for a future dropdown that might not have one).
    onEscapeClearable?: () => boolean
  }>(),
  { rowSelector: DEFAULT_ROW_SELECTOR },
)

const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
// The trigger content is caller-provided via the #trigger slot, so this wraps it just to give
// `focusTrigger` (see defineExpose below) something to query into after Escape closes the menu.
const triggerWrapRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

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
  // A click inside an open category submenu (see CategorySubmenu.vue) must not count as
  // "outside" — it's teleported straight to document.body, not a DOM descendant of
  // `containerRef`, for reasons explained in that component's own top comment (escaping the
  // panel's scrollable overflow), so `containerRef.value.contains()` alone can't see it.
  const target = e.target as Element
  if (target.closest?.('[data-category-submenu]')) return
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

// Roving Up/Down/Home/End nav across the panel's own search box + rows (`rowSelector`, optionally
// scoped to `navRoot` — see the props above), plus Escape. A distinct concern from any Alt+↑/↓
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
  const root = props.navRoot ? (menu.querySelector<HTMLElement>(props.navRoot) ?? menu) : menu
  const all = ddNavFocusables(root, `input[data-dd-search], ${props.rowSelector}`)
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
    <div
      v-if="isOpen"
      ref="menuRef"
      class="dropdown__menu"
      v-bind="$attrs"
      @keydown="onPanelKeydown"
    >
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
