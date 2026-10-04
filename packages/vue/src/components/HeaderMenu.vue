<script setup lang="ts" generic="TRow extends object">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import {
  columnHasActiveFilter,
  computeMenuPosition,
  ddNavFocusables,
} from '@vates/data-table-core/internal'
import type { ColumnDef } from '../types'
import type { TableState } from '../useTableState'

// A header's ▾ menu. `position: fixed` (like CategorySubmenu) so the table's scrolling wrapper
// doesn't clip it; it closes on any scroll rather than tracking its header.
const props = defineProps<{ table: TableState<TRow>; col: ColumnDef<TRow> }>()
const emit = defineEmits<{ openFilter: [key: string] }>()

const ROW_SELECTOR = 'button.dt__dd-item--clickable'

const open = ref(false)
const pos = ref({ left: 0, top: 0 })
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)

const L = props.table.labels
const key = computed(() => props.col.key)
const isFiltered = computed(() =>
  columnHasActiveFilter(
    key.value,
    props.table.filter.include.value,
    props.table.filter.exclude.value,
    props.table.filter.ranges.value,
  ),
)
// [label, action] for each item the column supports
const items = computed(() => {
  const list: [string, () => void][] = []
  if (props.col.sortable !== false)
    list.push(
      [`↑ ${L.value.sortAscending}`, () => act(() => props.table.sort.set(key.value, 'asc'))],
      [`↓ ${L.value.sortDescending}`, () => act(() => props.table.sort.set(key.value, 'desc'))],
    )
  if (props.col.filterable !== false)
    list.push([
      `${L.value.filter}…`,
      () => {
        close(false)
        emit('openFilter', key.value)
      },
    ])
  if (props.col.groupable === true && !props.table.group.by.value.includes(key.value))
    list.push([L.value.groupByColumn, () => act(() => props.table.group.toggle(key.value))])
  if (props.table.columns.active.value.length > 1)
    list.push([
      L.value.hideColumn,
      () => act(() => props.table.columns.toggleVisibility(key.value)),
    ])
  return list
})

function onOutside(e: Event): void {
  const target = e.target as Node
  if (!menuRef.value?.contains(target) && !triggerRef.value?.contains(target)) close(false)
}
function onScroll(e: Event): void {
  if (!menuRef.value?.contains(e.target as Node)) close(false)
}
function listen(on: boolean): void {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('mousedown', onOutside)
  window[method]('scroll', onScroll, true)
}
onUnmounted(() => listen(false))

async function openMenu(): Promise<void> {
  open.value = true
  listen(true)
  await nextTick()
  const menu = menuRef.value
  if (!menu || !triggerRef.value) return
  const rect = menu.getBoundingClientRect()
  pos.value = computeMenuPosition(
    triggerRef.value.getBoundingClientRect(),
    { width: rect.width, height: rect.height },
    window.innerWidth,
    window.innerHeight,
  )
  ddNavFocusables(menu, ROW_SELECTOR)[0]?.focus()
}
function close(focusTrigger: boolean): void {
  open.value = false
  listen(false)
  if (focusTrigger) triggerRef.value?.focus()
}

// Hiding or grouping can remove this header: focus the menu button now at its position instead.
function act(action: () => void): void {
  const trigger = triggerRef.value
  const row = trigger?.closest('tr')
  const buttons = row ? [...row.querySelectorAll<HTMLElement>('[data-col-menu]')] : []
  const index = trigger ? buttons.indexOf(trigger) : -1
  close(true)
  action()
  void nextTick(() => {
    if (trigger?.isConnected || !row) return
    const next = row.querySelectorAll<HTMLElement>('[data-col-menu]')
    next[Math.min(index, next.length - 1)]?.focus()
  })
}

function onMenuKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    close(true)
    return
  }
  if (e.key === 'Tab') {
    close(false)
    return
  }
  if (!menuRef.value || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  const rows = ddNavFocusables(menuRef.value, ROW_SELECTOR)
  const idx = rows.indexOf(document.activeElement as HTMLElement)
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? rows.length - 1
        : (idx + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length
  rows[next]?.focus()
}
</script>

<template>
  <template v-if="items.length > 0">
    <button
      ref="triggerRef"
      type="button"
      class="dt__th-menu"
      :class="{ 'dt__th-menu--filtered': isFiltered }"
      data-col-menu
      :aria-label="L.columnMenu(col.label)"
      aria-haspopup="menu"
      :aria-expanded="open"
      draggable="false"
      @click.stop="open ? close(false) : openMenu()"
    >
      ▾
    </button>
    <div
      v-if="open"
      ref="menuRef"
      class="dt__dd-submenu"
      role="menu"
      :style="{ position: 'fixed', left: `${pos.left}px`, top: `${pos.top}px` }"
      @click.stop
      @keydown="onMenuKeydown"
    >
      <button
        v-for="[label, run] in items"
        :key="label"
        type="button"
        role="menuitem"
        class="dt__dd-item dt__dd-item--clickable"
        @click="run"
      >
        {{ label }}
      </button>
    </div>
  </template>
</template>

<style scoped>
.dt__th-menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -4px 0 -4px 4px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
}
.dt__th-menu:hover,
.dt__th-menu[aria-expanded='true'] {
  background: var(--color-background-secondary);
}
.dt__th-menu--filtered {
  color: var(--color-text-info);
  font-weight: 700;
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
</style>
