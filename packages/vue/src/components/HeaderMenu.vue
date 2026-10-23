<script setup lang="ts" generic="TRow extends object">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import {
  FILTER_NARROW_QUERY,
  HEADER_MENU_ITEMS,
  HEADER_MENU_TRIGGER_ICON,
  columnHasActiveFilter,
  ddNavFocusables,
  getHeaderMenuItems,
  keepHeaderMenuFocus,
  moveMenuIndex,
  onMenuDismiss,
  placeMenu,
  watchMedia,
  type HeaderMenuItem,
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
// `label`: the value through the column's `format`, the default content
defineSlots<{ value?: (props: { value: string; label: string }) => unknown }>()

const open = ref(false)
const filterOpen = ref(false)
const pos = ref({ left: 0, top: 0 })
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)
let stopDismiss: (() => void) | undefined
// No room for a flyout beside the menu: Filter swaps the panel's items for its pane instead
const narrow = ref(false)
const stopWatch = watchMedia(FILTER_NARROW_QUERY, (m) => (narrow.value = m))
const drilled = computed(() => narrow.value && filterOpen.value)

const L = props.table.labels
const items = computed(() =>
  getHeaderMenuItems(
    props.col,
    props.table.group.by.value,
    props.table.columns.active.value.length,
    isFiltered.value,
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
  stopWatch()
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
  ddNavFocusables(menuRef.value)[0]?.focus()
}
function close(focusTrigger: boolean): void {
  open.value = false
  filterOpen.value = false
  emit('openChange', false)
  stopDismiss?.()
  if (focusTrigger) triggerRef.value?.focus()
}

// Focuses the back row rather than the search box, so the on-screen keyboard waits for a tap
async function drill(into: boolean): Promise<void> {
  filterOpen.value = into
  await nextTick()
  if (!menuRef.value || !triggerRef.value) return
  pos.value = placeMenu(triggerRef.value, menuRef.value)
  menuRef.value
    .querySelector<HTMLElement>(into ? '[data-menu-back]' : '[data-menu-filter]')
    ?.focus()
}
function onPaneKeydown(e: KeyboardEvent): void {
  // ← in a text field moves its caret instead
  const inText = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox'
  if (e.key !== 'Escape' && (e.key !== 'ArrowLeft' || inText)) return
  e.preventDefault()
  e.stopPropagation()
  void drill(false)
}

// Grouping or hiding can remove this header: focus the ▾ now at its position instead
function act(item: Exclude<HeaderMenuItem, 'filter'>): void {
  const restoreFocus = triggerRef.value && keepHeaderMenuFocus(triggerRef.value)
  close(true)
  if (item === 'clear')
    for (const kind of ['include', 'exclude', 'range'] as const)
      props.table.filter.clearColumn(props.col.key, kind)
  else if (item === 'group' || item === 'ungroup') props.table.group.toggle(props.col.key)
  else props.table.columns.toggleVisibility(props.col.key)
  if (restoreFocus) void nextTick(restoreFocus)
}

// Focus leaving the panel closes it; a click inside may blur to nothing (null)
function onMenuFocusout(e: FocusEvent): void {
  const to = e.relatedTarget as Node | null
  if (to && !menuRef.value?.contains(to) && to !== triggerRef.value) close(false)
}

function onMenuKeydown(e: KeyboardEvent): void {
  // Keys inside the filter flyout are the flyout's
  if ((e.target as Element).closest('.dt-th-filter-flyout')) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close(true)
    return
  }
  if (!menuRef.value) return
  const rows = ddNavFocusables(menuRef.value)
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
      class="dt-th-menu"
      :class="{ 'dt-th-menu--filtered': isFiltered }"
      data-col-menu
      :aria-label="L.columnMenu(col.label, isFiltered)"
      aria-haspopup="dialog"
      :aria-expanded="open"
      draggable="false"
      @click.stop="open ? close(false) : openMenu()"
    >
      <!-- A funnel, not just a color, tells a filtered column apart -->
      <svg
        class="dt-th-menu-icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="isFiltered ? HEADER_MENU_ITEMS.filter.icon : HEADER_MENU_TRIGGER_ICON" />
      </svg>
    </button>
    <div
      v-if="open"
      ref="menuRef"
      class="dt-dd-submenu dt-th-menu-panel"
      :class="{ 'dt-th-menu-panel--drilled': drilled }"
      role="dialog"
      :aria-label="L.columnMenu(col.label, false)"
      :style="{ position: 'fixed', left: `${pos.left}px`, top: `${pos.top}px` }"
      @click.stop
      @keydown="onMenuKeydown"
      @focusout="onMenuFocusout"
    >
      <div
        v-if="drilled"
        class="dt-th-filter-flyout"
        role="group"
        :aria-label="L.filter"
        @keydown="onPaneKeydown"
      >
        <button
          type="button"
          class="dt-dd-item dt-dd-item--click dt-filter-back"
          data-menu-back
          @click="drill(false)"
        >
          ‹ {{ col.label }}
        </button>
        <FilterPane :table="table" :col="col" :data="data" :columns="columns">
          <template #value="{ value, label }"
            ><slot name="value" :value="value" :label="label"
          /></template>
        </FilterPane>
      </div>
      <template v-else>
        <template v-for="item in items" :key="item">
          <button
            v-if="item === 'filter' && narrow"
            type="button"
            class="dt-dd-item dt-dd-item--click"
            data-dd-row
            data-menu-filter
            @click="drill(true)"
            @keydown.right="drill(true)"
          >
            <svg
              class="dt-th-menu-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="HEADER_MENU_ITEMS[item].icon" />
            </svg>
            <span class="dt-flex1">{{ L[HEADER_MENU_ITEMS[item].label] }}</span>
            <span class="dt-dd-category-arrow">▸</span>
          </button>
          <CategorySubmenu
            v-else-if="item === 'filter'"
            :name="L[HEADER_MENU_ITEMS[item].label]"
            :group-label="L[HEADER_MENU_ITEMS[item].label]"
            submenu-class="dt-th-filter-flyout"
            :is-open="filterOpen"
            @open="filterOpen = true"
            @close="filterOpen = false"
          >
            <template #icon>
              <svg
                class="dt-th-menu-icon"
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
              <template #value="{ value, label }"
                ><slot name="value" :value="value" :label="label"
              /></template>
            </FilterPane>
          </CategorySubmenu>
          <button
            v-else
            type="button"
            class="dt-dd-item dt-dd-item--click"
            data-dd-row
            @click="act(item)"
          >
            <svg
              class="dt-th-menu-icon"
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
      </template>
    </div>
  </template>
</template>
