<script setup lang="ts" generic="TRow extends object">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import {
  HEADER_MENU_ITEMS,
  columnHasActiveFilter,
  ddNavFocusables,
  getHeaderMenuItems,
  keepHeaderMenuFocus,
  moveMenuIndex,
  onMenuDismiss,
  placeMenu,
} from '@vates/data-table-core/internal'
import type { ColumnDef } from '../types'
import type { TableState } from '../useTableState'
import CategorySubmenu from './CategorySubmenu.vue'
import FilterPane from './FilterPane.vue'

// A header's ▾ menu. `position: fixed` (like CategorySubmenu) so the table's scrolling wrapper
// doesn't clip it; it closes on any scroll rather than tracking its header.
const props = defineProps<{
  table: TableState<TRow>
  col: ColumnDef<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
}>()
const emit = defineEmits<{ openChange: [open: boolean] }>()
// `value`: the filter flyout's value label, forwarded to FilterPane
defineSlots<{ value?: (props: { value: string }) => unknown }>()

const ROW_SELECTOR = 'button.dt__dd-item--clickable'

const open = ref(false)
const filterOpen = ref(false)
const pos = ref({ left: 0, top: 0 })
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)
let stopDismiss: (() => void) | undefined

const L = props.table.labels
const items = computed(() =>
  getHeaderMenuItems(
    props.col,
    props.table.group.by.value,
    props.table.columns.active.value.length,
  ),
)
const isFiltered = computed(() =>
  columnHasActiveFilter(
    props.col.key,
    props.table.filter.include.value,
    props.table.filter.exclude.value,
    props.table.filter.ranges.value,
  ),
)

onUnmounted(() => {
  stopDismiss?.()
  if (open.value) emit('openChange', false)
})

async function openMenu(): Promise<void> {
  open.value = true
  emit('openChange', true)
  stopDismiss = onMenuDismiss(
    () => [menuRef.value, triggerRef.value],
    () => close(false),
  )
  await nextTick()
  if (!menuRef.value || !triggerRef.value) return
  pos.value = placeMenu(triggerRef.value, menuRef.value)
  ddNavFocusables(menuRef.value, ROW_SELECTOR)[0]?.focus()
}
function close(focusTrigger: boolean): void {
  open.value = false
  filterOpen.value = false
  emit('openChange', false)
  stopDismiss?.()
  if (focusTrigger) triggerRef.value?.focus()
}

// Grouping or hiding can remove this header: focus the ▾ now at its position instead
function act(item: 'group' | 'hide'): void {
  const restoreFocus = triggerRef.value && keepHeaderMenuFocus(triggerRef.value)
  close(true)
  if (item === 'group') props.table.group.toggle(props.col.key)
  else props.table.columns.toggleVisibility(props.col.key)
  if (restoreFocus) void nextTick(restoreFocus)
}

function onMenuKeydown(e: KeyboardEvent): void {
  // Keys inside the filter flyout are the flyout's
  if (!(e.target as Element).matches('[role=menuitem]')) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close(true)
    return
  }
  if (e.key === 'Tab') {
    close(false)
    return
  }
  if (!menuRef.value) return
  const rows = ddNavFocusables(menuRef.value, ROW_SELECTOR)
  const next = moveMenuIndex(
    e.key,
    rows.indexOf(document.activeElement as HTMLElement),
    rows.length,
  )
  if (next === null) return
  e.preventDefault()
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
      <template v-for="item in items" :key="item">
        <CategorySubmenu
          v-if="item === 'filter'"
          :name="L[HEADER_MENU_ITEMS[item].label]"
          role="menuitem"
          submenu-class="dt__th-filter-flyout"
          :is-open="filterOpen"
          @open="filterOpen = true"
          @close="filterOpen = false"
        >
          <template #icon>
            <svg
              class="dt__th-menu-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="HEADER_MENU_ITEMS[item].icon" />
            </svg>
          </template>
          <FilterPane :table="table" :col="col" :data="data" :columns="columns">
            <template #value="{ value }"><slot name="value" :value="value" /></template>
          </FilterPane>
        </CategorySubmenu>
        <button
          v-else
          type="button"
          role="menuitem"
          class="dt__dd-item dt__dd-item--clickable"
          @click="act(item)"
        >
          <svg
            class="dt__th-menu-icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="HEADER_MENU_ITEMS[item].icon" />
          </svg>
          {{ L[HEADER_MENU_ITEMS[item].label] }}
        </button>
      </template>
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
  margin: -4px 0 -4px auto;
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
  font-weight: 400;
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
/* The icon in the Filter item sits in CategorySubmenu's trigger, the flyout in its template */
:deep(.dt__th-menu-icon),
.dt__th-menu-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
:deep(.dt__dd-submenu.dt__th-filter-flyout) {
  display: flex;
  flex-direction: column;
  max-height: 380px;
  overflow: hidden;
  padding: 0;
}
</style>
