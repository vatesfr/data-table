import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  HEADER_MENU_ITEMS,
  ddNavFocusables,
  keepHeaderMenuFocus,
  moveMenuIndex,
  onMenuDismiss,
  placeMenu,
  type HeaderMenuItem,
} from '@vates/data-table-core/internal'
import type { DataTableLabels } from '@vates/data-table-core'
import { CategorySubmenu } from './CategorySubmenu'

interface HeaderMenuProps {
  /** Accessible name of the ▾ button */
  label: string
  labels: DataTableLabels
  /** From `getHeaderMenuItems`; empty renders nothing */
  items: HeaderMenuItem[]
  filtered: boolean
  /** The column's filter pane, shown in the Filter flyout */
  filterPane: ReactNode
  onGroup: () => void
  onHide: () => void
}

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  margin: '-4px 0 -4px auto',
  padding: 0,
  border: 'none',
  borderRadius: 4,
  background: 'none',
  color: 'var(--color-text-secondary)',
  font: 'inherit',
  cursor: 'pointer',
}
const panelStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 101,
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
  minWidth: 160,
  maxHeight: 320,
  overflowY: 'auto',
  padding: '4px 0',
  fontWeight: 400,
}
const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 14px',
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--color-text-primary)',
  border: 'none',
  background: 'none',
  fontFamily: 'inherit',
  textAlign: 'left',
  margin: 0,
  width: '100%',
  boxSizing: 'border-box',
}
const flyoutStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 380,
  overflow: 'hidden',
  padding: 0,
}
const hoverBg = 'var(--color-background-secondary)'

function Icon({ item }: { item: HeaderMenuItem }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: 14, height: 14, flexShrink: 0 }}
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
  labels: L,
  items,
  filtered,
  filterPane,
  onGroup,
  onHide,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  // Hovered/focused item (inline styles have no :hover/:focus); -1 is the trigger
  const [lit, setLit] = useState<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!open || !menu || !trigger) return
    setPos(placeMenu(trigger, menu))
    ddNavFocusables(menu)[0]?.focus()
  }, [open])

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
  function act(item: 'group' | 'hide'): void {
    const restoreFocus = triggerRef.current && keepHeaderMenuFocus(triggerRef.current)
    close(true)
    if (item === 'group') onGroup()
    else onHide()
    if (restoreFocus) queueMicrotask(restoreFocus)
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
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
        data-col-menu
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        draggable={false}
        onClick={(e) => {
          e.stopPropagation()
          if (open) close(false)
          else setOpen(true)
        }}
        onMouseEnter={() => setLit(-1)}
        onMouseLeave={() => setLit(null)}
        style={{
          ...triggerStyle,
          ...(open || lit === -1 ? { background: hoverBg } : null),
          ...(filtered ? { color: 'var(--color-text-info)', fontWeight: 700 } : null),
        }}
      >
        ▾
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKeyDown}
          style={{ ...panelStyle, left: pos.left, top: pos.top }}
        >
          {items.map((item, i) =>
            item === 'filter' ? (
              <CategorySubmenu
                key={item}
                name={L[HEADER_MENU_ITEMS[item].label]}
                icon={<Icon item={item} />}
                role="menuitem"
                panelStyle={flyoutStyle}
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
                role="menuitem"
                data-dd-row
                onClick={() => act(item)}
                onMouseEnter={() => setLit(i)}
                onMouseLeave={() => setLit(null)}
                onFocus={() => setLit(i)}
                onBlur={() => setLit(null)}
                style={lit === i ? { ...itemStyle, background: hoverBg } : itemStyle}
              >
                <Icon item={item} />
                {L[HEADER_MENU_ITEMS[item].label]}
              </button>
            ),
          )}
        </div>
      )}
    </>
  )
}
