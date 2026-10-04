import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { computeMenuPosition, ddNavFocusables } from '@vates/data-table-core/internal'
import type { DataTableLabels, SortEntry } from '@vates/data-table-core'

// [label, action, whether focus returns to the ▾ button afterward]
type Item = [string, () => void, boolean]

interface HeaderMenuProps {
  label: string
  labels: DataTableLabels
  filtered: boolean
  // Each action is passed only when the column supports it
  onSort?: (dir: SortEntry['dir']) => void
  onFilter?: () => void
  onGroup?: () => void
  onHide?: () => void
}

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  margin: '-4px 0',
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
const hoverBg = 'var(--color-background-secondary)'

// A header's ▾ menu. `position: fixed` (like CategorySubmenu) so the table's scrolling wrapper
// doesn't clip it; it closes on any scroll rather than tracking its header. Mirrors Solid's
// HeaderMenu.tsx.
export function HeaderMenu({
  label,
  labels: L,
  filtered,
  onSort,
  onFilter,
  onGroup,
  onHide,
}: HeaderMenuProps) {
  const items: Item[] = []
  if (onSort)
    items.push(
      [`↑ ${L.sortAscending}`, () => onSort('asc'), true],
      [`↓ ${L.sortDescending}`, () => onSort('desc'), true],
    )
  if (onFilter) items.push([`${L.filter}…`, onFilter, false])
  if (onGroup) items.push([L.groupByColumn, onGroup, true])
  if (onHide) items.push([L.hideColumn, onHide, true])

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  // Hovered/focused item (inline styles have no :hover/:focus); -1 is the trigger
  const [lit, setLit] = useState<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!open || !menu || !trigger) return
    const rect = menu.getBoundingClientRect()
    setPos(
      computeMenuPosition(
        trigger.getBoundingClientRect(),
        { width: rect.width, height: rect.height },
        window.innerWidth,
        window.innerHeight,
      ),
    )
    ddNavFocusables(menu)[0]?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function close(focusTrigger: boolean): void {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  // Hiding or grouping can remove this header: focus the menu button now at its position instead.
  function run([, action, refocus]: Item): void {
    const trigger = triggerRef.current
    const row = trigger?.closest('tr')
    const index =
      row && trigger ? [...row.querySelectorAll('[data-col-menu]')].indexOf(trigger) : -1
    close(refocus)
    action()
    if (!refocus || !row) return
    queueMicrotask(() => {
      if (trigger?.isConnected) return
      const next = row.querySelectorAll<HTMLElement>('[data-col-menu]')
      next[Math.min(index, next.length - 1)]?.focus()
    })
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
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
    if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const list = ddNavFocusables(menu)
    const idx = list.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? list.length - 1
          : (idx + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
    list[next]?.focus()
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
          setOpen((o) => !o)
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
          {items.map((item, i) => (
            <button
              key={item[0]}
              type="button"
              role="menuitem"
              data-dd-row
              onClick={() => run(item)}
              onMouseEnter={() => setLit(i)}
              onMouseLeave={() => setLit(null)}
              onFocus={() => setLit(i)}
              onBlur={() => setLit(null)}
              style={lit === i ? { ...itemStyle, background: hoverBg } : itemStyle}
            >
              {item[0]}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
