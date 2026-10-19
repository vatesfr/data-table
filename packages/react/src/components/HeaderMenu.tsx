import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  FILTER_NARROW_QUERY,
  HEADER_MENU_ITEMS,
  ddNavFocusables,
  keepHeaderMenuFocus,
  moveMenuIndex,
  onMenuDismiss,
  placeMenu,
  watchMedia,
  type HeaderMenuItem,
} from '@vates/data-table-core/internal'
import type { DataTableLabels } from '@vates/data-table-core'
import { CategorySubmenu } from './CategorySubmenu'

interface HeaderMenuProps {
  /** Accessible name of the ▾ button */
  label: string
  /** Accessible name of the panel */
  menuLabel: string
  /** The column's label, naming the narrow screen's back row */
  column: string
  labels: DataTableLabels
  /** From `getHeaderMenuItems`; empty renders nothing */
  items: HeaderMenuItem[]
  filtered: boolean
  /** The column's filter pane, shown in the Filter flyout */
  filterPane: ReactNode
  onClearFilter: () => void
  onGroup: () => void
  onHide: () => void
}

function Icon({ item }: { item: HeaderMenuItem }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
      className="dt-th-menu-icon"
    >
      <path d={HEADER_MENU_ITEMS[item].icon} />
    </svg>
  )
}

// A header's ▾ menu. `position: fixed` (like CategorySubmenu) so the table's scrolling wrapper
// doesn't clip it; it closes on any scroll rather than tracking its header. Mirrors Solid's
// HeaderMenu.tsx; the shared logic lives in core's headerMenu.ts.
export function HeaderMenu({
  label,
  menuLabel,
  column,
  labels: L,
  items,
  filtered,
  filterPane,
  onClearFilter,
  onGroup,
  onHide,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // No room for a flyout beside the menu: Filter swaps the panel's items for its pane instead
  const [narrow, setNarrow] = useState(false)
  useEffect(() => watchMedia(FILTER_NARROW_QUERY, setNarrow), [])
  const drilled = narrow && filterOpen
  const drillFocus = useRef<string | null>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!open || !menu || !trigger) return
    setPos(placeMenu(trigger, menu))
    ddNavFocusables(menu)[0]?.focus()
  }, [open])

  // Focuses the back row rather than the search box, so the on-screen keyboard waits for a tap
  function drill(into: boolean): void {
    drillFocus.current = into ? '[data-menu-back]' : '[data-menu-filter]'
    setFilterOpen(into)
  }
  useLayoutEffect(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    const target = drillFocus.current
    if (!target || !menu || !trigger) return
    drillFocus.current = null
    setPos(placeMenu(trigger, menu))
    menu.querySelector<HTMLElement>(target)?.focus()
  }, [filterOpen])

  useEffect(() => {
    if (!open) return
    return onMenuDismiss(
      () => [menuRef.current, triggerRef.current],
      () => {
        setOpen(false)
        setFilterOpen(false)
      },
    )
  }, [open])

  // The menu renders inside the draggable <th>: while open, dragging a control in it (the
  // filter's range slider) would drag the column instead
  useEffect(() => {
    const th = triggerRef.current?.closest('th')
    if (!open || !th) return
    th.draggable = false
    return () => {
      th.draggable = true
    }
  }, [open])

  function close(focusTrigger: boolean): void {
    setOpen(false)
    setFilterOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  // Grouping or hiding can remove this header: focus the ▾ now at its position instead
  function act(item: Exclude<HeaderMenuItem, 'filter'>): void {
    const restoreFocus = triggerRef.current && keepHeaderMenuFocus(triggerRef.current)
    close(true)
    if (item === 'clear') onClearFilter()
    else if (item === 'group' || item === 'ungroup') onGroup()
    else onHide()
    if (restoreFocus) queueMicrotask(restoreFocus)
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    // Keys inside the filter flyout are the flyout's
    if ((e.target as Element).closest('[data-category-submenu], [data-menu-pane]')) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    const menu = menuRef.current
    if (!menu) return
    const focusables = ddNavFocusables(menu)
    const next = moveMenuIndex(
      e.key,
      focusables.indexOf(document.activeElement as HTMLElement),
      focusables.length,
    )
    if (next === null) return
    e.preventDefault()
    focusables[next]?.focus()
  }

  if (items.length === 0) return null
  return (
    <>
      <button
        type="button"
        className={`dt-th-menu${filtered ? ' dt-th-menu--filtered' : ''}`}
        data-col-menu
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        draggable={false}
        onClick={(e) => {
          e.stopPropagation()
          if (open) close(false)
          else setOpen(true)
        }}
      >
        {/* A funnel, not just a color, tells a filtered column apart */}
        {filtered ? <Icon item="filter" /> : '▾'}
      </button>
      {open && (
        <div
          ref={menuRef}
          className={`dt-dd-submenu dt-th-menu-panel${drilled ? ' dt-th-menu-panel--drilled' : ''}`}
          role="dialog"
          aria-label={menuLabel}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKeyDown}
          onBlur={(e) => {
            // Focus leaving the panel closes it; a click inside may blur to nothing (null)
            const to = e.relatedTarget
            if (to && !e.currentTarget.contains(to) && to !== triggerRef.current) close(false)
          }}
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
        >
          {drilled ? (
            <div
              className="dt-th-filter-flyout"
              data-menu-pane
              role="group"
              aria-label={L.filter}
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
                className="dt-dd-item dt-dd-item--click dt-filter-back"
                data-menu-back
                onClick={() => drill(false)}
              >
                ‹ {column}
              </button>
              {filterPane}
            </div>
          ) : (
            items.map((item) =>
              item === 'filter' && narrow ? (
                <button
                  key={item}
                  type="button"
                  className="dt-dd-item dt-dd-item--click"
                  data-dd-row
                  data-menu-filter
                  onClick={() => drill(true)}
                  onKeyDown={(e) => e.key === 'ArrowRight' && drill(true)}
                >
                  <Icon item={item} />
                  <span className="dt-flex1">{L[HEADER_MENU_ITEMS[item].label]}</span>
                  <span className="dt-dd-category-arrow">▸</span>
                </button>
              ) : item === 'filter' ? (
                <CategorySubmenu
                  key={item}
                  name={L[HEADER_MENU_ITEMS[item].label]}
                  icon={<Icon item={item} />}
                  groupLabel={L[HEADER_MENU_ITEMS[item].label]}
                  className="dt-th-filter-flyout"
                  isOpen={filterOpen}
                  onOpen={() => setFilterOpen(true)}
                  onClose={() => setFilterOpen(false)}
                >
                  {filterPane}
                </CategorySubmenu>
              ) : (
                <button
                  key={item}
                  type="button"
                  className="dt-dd-item dt-dd-item--click"
                  data-dd-row
                  onClick={() => act(item)}
                >
                  <Icon item={item} />
                  {L[HEADER_MENU_ITEMS[item].label]}
                </button>
              ),
            )
          )}
        </div>
      )}
    </>
  )
}
