import { For, Show, createSignal, onCleanup } from 'solid-js'
import {
  FILTER_NARROW_QUERY,
  HEADER_MENU_ITEMS,
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
import type { TableState } from '../createTableState'
import { CategorySubmenu } from './CategorySubmenu'
import { FilterPane } from './FilterPane'

interface HeaderMenuProps<TRow extends object> {
  table: TableState<TRow>
  col: ColumnDef<TRow>
  onOpenChange: (open: boolean) => void
}

function Icon(props: { item: HeaderMenuItem }) {
  return (
    <svg
      class="dt-th-menu-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={HEADER_MENU_ITEMS[props.item].icon} />
    </svg>
  )
}

const FILTER_KINDS = ['include', 'exclude', 'range'] as const

// A header's ▾ menu. `position: fixed` (like CategorySubmenu) so the table's scrolling wrapper
// doesn't clip it; it closes on any scroll rather than tracking its header.
export function HeaderMenu<TRow extends object>(props: HeaderMenuProps<TRow>) {
  const { table } = props
  const [open, setOpen] = createSignal(false)
  const [filterOpen, setFilterOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ left: 0, top: 0 })
  let triggerRef: HTMLButtonElement | undefined
  let menuRef: HTMLDivElement | undefined
  let stopDismiss: (() => void) | undefined

  const key = () => props.col.key
  const isFiltered = () =>
    columnHasActiveFilter(
      key(),
      table.filter.include(),
      table.filter.exclude(),
      table.filter.ranges(),
    )
  const items = () =>
    getHeaderMenuItems(props.col, table.group.by(), table.columns.active().length, isFiltered())
  const label = (item: HeaderMenuItem) => table.labels()[HEADER_MENU_ITEMS[item].label]
  // No room for a flyout beside the menu: Filter swaps the panel's items for its pane instead
  const [narrow, setNarrow] = createSignal(false)
  onCleanup(watchMedia(FILTER_NARROW_QUERY, setNarrow))
  const drilled = () => narrow() && filterOpen()

  onCleanup(() => {
    stopDismiss?.()
    if (open()) props.onOpenChange(false)
  })

  function openMenu(): void {
    setOpen(true)
    props.onOpenChange(true)
    stopDismiss = onMenuDismiss(
      () => [menuRef, triggerRef],
      () => close(false),
    )
    queueMicrotask(() => {
      if (!menuRef || !triggerRef) return
      setPos(placeMenu(triggerRef, menuRef))
      ddNavFocusables(menuRef)[0]?.focus()
    })
  }
  function close(focusTrigger: boolean): void {
    setOpen(false)
    props.onOpenChange(false)
    setFilterOpen(false)
    stopDismiss?.()
    if (focusTrigger) triggerRef?.focus()
  }

  // Focuses the back row rather than the search box, so the on-screen keyboard waits for a tap
  function drill(into: boolean): void {
    setFilterOpen(into)
    queueMicrotask(() => {
      if (!menuRef || !triggerRef) return
      setPos(placeMenu(triggerRef, menuRef))
      menuRef.querySelector<HTMLElement>(into ? '[data-menu-back]' : '[data-menu-filter]')?.focus()
    })
  }

  // Grouping or hiding can remove this header: focus the ▾ now at its position instead
  function act(item: Exclude<HeaderMenuItem, 'filter'>): void {
    const restoreFocus = triggerRef && keepHeaderMenuFocus(triggerRef)
    close(true)
    if (item === 'clear') for (const kind of FILTER_KINDS) table.filter.clearColumn(key(), kind)
    else if (item === 'group' || item === 'ungroup') table.group.toggle(key())
    else table.columns.toggleVisibility(key())
    if (restoreFocus) queueMicrotask(restoreFocus)
  }

  function onMenuKeyDown(e: KeyboardEvent): void {
    // Keys inside the filter flyout are the flyout's
    if ((e.target as Element).closest('.dt-th-filter-flyout')) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (!menuRef) return
    const focusables = ddNavFocusables(menuRef)
    const next = moveMenuIndex(
      e.key,
      focusables.indexOf(document.activeElement as HTMLElement),
      focusables.length,
    )
    if (next === null) return
    e.preventDefault()
    focusables[next]?.focus()
  }

  return (
    <Show when={items().length > 0}>
      <button
        type="button"
        class="dt-th-menu"
        classList={{ 'dt-th-menu--filtered': isFiltered() }}
        data-col-menu
        ref={triggerRef}
        aria-label={table.labels().columnMenu(props.col.label, isFiltered())}
        aria-haspopup="dialog"
        aria-expanded={open()}
        draggable={false}
        onClick={(e) => {
          e.stopPropagation()
          if (open()) close(false)
          else openMenu()
        }}
      >
        {/* A funnel, not just a color, tells a filtered column apart */}
        <Show when={isFiltered()} fallback="▾">
          <Icon item="filter" />
        </Show>
      </button>
      <Show when={open()}>
        <div
          class="dt-dd-submenu dt-th-menu-panel"
          classList={{ 'dt-th-menu-panel--drilled': drilled() }}
          role="dialog"
          aria-label={table.labels().columnMenu(props.col.label, false)}
          ref={menuRef}
          style={{ position: 'fixed', left: `${pos().left}px`, top: `${pos().top}px` }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKeyDown}
          onFocusOut={(e) => {
            // Focus leaving the panel closes it; a click inside may blur to nothing (null)
            const to = e.relatedTarget as Node | null
            if (to && !menuRef?.contains(to) && to !== triggerRef) close(false)
          }}
        >
          <Show
            when={drilled()}
            fallback={
              <For each={items()}>
                {(item) =>
                  item === 'filter' && narrow() ? (
                    <button
                      type="button"
                      class="dt-dd-item dt-dd-item--click"
                      data-dd-row
                      data-menu-filter
                      onClick={() => drill(true)}
                      onKeyDown={(e) => e.key === 'ArrowRight' && drill(true)}
                    >
                      <Icon item={item} />
                      <span class="dt-flex1">{label(item)}</span>
                      <span class="dt-dd-category-arrow">▸</span>
                    </button>
                  ) : item === 'filter' ? (
                    <CategorySubmenu
                      name={label(item)}
                      icon={<Icon item={item} />}
                      groupLabel={label(item)}
                      class="dt-th-filter-flyout"
                      isOpen={filterOpen()}
                      onOpen={() => setFilterOpen(true)}
                      onClose={() => setFilterOpen(false)}
                    >
                      <FilterPane table={table} col={props.col} />
                    </CategorySubmenu>
                  ) : (
                    <button
                      type="button"
                      class="dt-dd-item dt-dd-item--click"
                      data-dd-row
                      onClick={() => act(item)}
                    >
                      <Icon item={item} />
                      {label(item)}
                    </button>
                  )
                }
              </For>
            }
          >
            <div
              class="dt-th-filter-flyout"
              role="group"
              aria-label={label('filter')}
              onKeyDown={(e) => {
                // ← in a text field moves its caret instead
                const inText = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox'
                if (e.key !== 'Escape' && (e.key !== 'ArrowLeft' || inText)) return
                e.preventDefault()
                e.stopPropagation()
                drill(false)
              }}
            >
              <button
                type="button"
                class="dt-dd-item dt-dd-item--click dt-filter-back"
                data-menu-back
                onClick={() => drill(false)}
              >
                ‹ {props.col.label}
              </button>
              <FilterPane table={table} col={props.col} />
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  )
}
