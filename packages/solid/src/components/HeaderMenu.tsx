import { For, Show, createSignal, onCleanup } from 'solid-js'
import {
  columnHasActiveFilter,
  computeMenuPosition,
  ddNavFocusables,
} from '@vates/data-table-core/internal'
import type { ColumnDef } from '../types'
import type { TableState } from '../createTableState'

interface HeaderMenuProps<TRow extends object> {
  table: TableState<TRow>
  col: ColumnDef<TRow>
  onOpenFilter?: (key: string) => void
}

// A header's ▾ menu. `position: fixed` (like CategorySubmenu) so the table's scrolling wrapper
// doesn't clip it; it closes on any scroll rather than tracking its header.
export function HeaderMenu<TRow extends object>(props: HeaderMenuProps<TRow>) {
  const { table } = props
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ left: 0, top: 0 })
  let triggerRef: HTMLButtonElement | undefined
  let menuRef: HTMLDivElement | undefined

  const key = () => props.col.key
  // [label, action] for each item the column supports
  const items = (): [string, () => void][] => {
    const L = table.labels()
    const list: [string, () => void][] = []
    if (props.col.sortable !== false)
      list.push(
        [`↑ ${L.sortAscending}`, () => act(() => table.sort.set(key(), 'asc'))],
        [`↓ ${L.sortDescending}`, () => act(() => table.sort.set(key(), 'desc'))],
      )
    const onOpenFilter = props.onOpenFilter
    if (props.col.filterable !== false && onOpenFilter)
      list.push([
        `${L.filter}…`,
        () => {
          close(false)
          onOpenFilter(key())
        },
      ])
    if (props.col.groupable === true && !table.group.by().includes(key()))
      list.push([L.groupByColumn, () => act(() => table.group.toggle(key()))])
    if (table.columns.active().length > 1)
      list.push([L.hideColumn, () => act(() => table.columns.toggleVisibility(key()))])
    return list
  }
  const isFiltered = () =>
    columnHasActiveFilter(
      key(),
      table.filter.include(),
      table.filter.exclude(),
      table.filter.ranges(),
    )

  function onOutside(e: Event): void {
    if (!menuRef?.contains(e.target as Node) && !triggerRef?.contains(e.target as Node))
      close(false)
  }
  function onScroll(e: Event): void {
    if (!menuRef?.contains(e.target as Node)) close(false)
  }
  function listen(on: boolean): void {
    const method = on ? 'addEventListener' : 'removeEventListener'
    document[method]('mousedown', onOutside)
    window[method]('scroll', onScroll, true)
  }
  onCleanup(() => listen(false))

  function openMenu(): void {
    setOpen(true)
    listen(true)
    queueMicrotask(() => {
      if (!menuRef || !triggerRef) return
      const rect = menuRef.getBoundingClientRect()
      setPos(
        computeMenuPosition(
          triggerRef.getBoundingClientRect(),
          { width: rect.width, height: rect.height },
          window.innerWidth,
          window.innerHeight,
        ),
      )
      ddNavFocusables(menuRef)[0]?.focus()
    })
  }
  function close(focusTrigger: boolean): void {
    setOpen(false)
    listen(false)
    if (focusTrigger) triggerRef?.focus()
  }

  // Hiding or grouping can remove this header: focus the menu button now at its position instead.
  function act(action: () => void): void {
    const row = triggerRef?.closest('tr')
    const buttons = row ? [...row.querySelectorAll<HTMLElement>('[data-col-menu]')] : []
    const index = triggerRef ? buttons.indexOf(triggerRef) : -1
    close(true)
    action()
    queueMicrotask(() => {
      if (triggerRef?.isConnected || !row) return
      const next = row.querySelectorAll<HTMLElement>('[data-col-menu]')
      next[Math.min(index, next.length - 1)]?.focus()
    })
  }

  function onMenuKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key === 'Tab') {
      close(false)
      return
    }
    if (!menuRef || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const items = ddNavFocusables(menuRef)
    const idx = items.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <Show when={items().length > 0}>
      <button
        type="button"
        class="dt-th-menu"
        classList={{ 'dt-th-menu--filtered': isFiltered() }}
        data-col-menu
        ref={triggerRef}
        aria-label={table.labels().columnMenu(props.col.label)}
        aria-haspopup="menu"
        aria-expanded={open()}
        draggable={false}
        onClick={(e) => {
          e.stopPropagation()
          if (open()) close(false)
          else openMenu()
        }}
      >
        ▾
      </button>
      <Show when={open()}>
        <div
          class="dt-dd-submenu dt-th-menu-panel"
          role="menu"
          ref={menuRef}
          style={{ position: 'fixed', left: `${pos().left}px`, top: `${pos().top}px` }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKeyDown}
        >
          <For each={items()}>
            {([label, run]) => (
              <button
                type="button"
                role="menuitem"
                class="dt-dd-item dt-dd-item--click"
                data-dd-row
                onClick={run}
              >
                {label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </Show>
  )
}
