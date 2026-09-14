import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { computeSubmenuPosition, ddNavFocusables } from '@vates/data-table-core/internal'

// Hover-intent delays (see CLAUDE.md's "Column categories") — a native OS/app-menu-style flyout
// opens on hover once its parent menu is already open. OPEN_DELAY avoids a flicker-open while the
// pointer merely sweeps across a category row on its way to something else; CLOSE_DELAY is
// longer, giving the pointer room to travel diagonally from the trigger into the submenu itself
// without the gap between them (however narrow) closing it prematurely. Click still opens/closes
// immediately (no delay), as do ArrowRight/Enter/Escape — matches Solid's identical component.
const OPEN_DELAY = 100
const CLOSE_DELAY = 250

export interface CategorySubmenuProps {
  name: string
  // Controlled, not self-managed: the parent (Sort/Group's own DataTableView.tsx block) owns one
  // shared "which category is open" value across every CategorySubmenu in its list, so opening
  // one always closes any other that was open.
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  children: ReactNode
}

const triggerStyle: CSSProperties = {
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
const arrowStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 10,
  color: 'var(--color-text-tertiary)',
}
const submenuStyle: CSSProperties = {
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
}

// A category row in the Sort/Group dropdowns' addable-column lists (see CLAUDE.md's "Column
// categories"): collapses every column sharing `ColumnDefBase.category` into one row that opens a
// flyout submenu listing them, instead of a flat run of individual rows — worthwhile once a
// category has enough columns that this saves real scanning. Mirrors
// `packages/solid/src/components/CategorySubmenu.tsx` — same design, ported to React's own
// ref/layout-effect idioms instead of Solid's signals.
//
// Positioned with `position: fixed` at viewport coordinates computed from the trigger's own rect
// (`computeSubmenuPosition`, core), but rendered as a plain sibling of the trigger — NOT portaled
// to `document.body`, and NOT `position: absolute` either. Solid's own first version used
// `position: absolute` and hit a real bug: `.dt-dd`'s `overflow-y: auto` (see `Dropdown.tsx`'s
// panel style) means an absolutely positioned descendant that overflows a scrollable ancestor
// horizontally still grows that ancestor's own scrollable region even though it's out of normal
// flow — clipping the flyout and adding a spurious horizontal scrollbar to the whole panel. A
// `createPortal` to `document.body` was tried next and does dodge that, but comes with a real
// cost: a portaled node is no longer a DOM descendant of whatever ancestor a consumer scopes theme
// CSS custom properties to (if that ancestor is narrower than `<body>`), so the submenu silently
// falls back to the library's baked-in default colors instead of inheriting the consumer's theme
// (GitHub issue #23). `position: fixed` alone turns out to solve the original overflow problem on
// its own, with no portal needed: a fixed element's containing block is the *viewport*, not any
// scrolling ancestor, unless that ancestor sets `transform`/`filter`/`perspective`/
// `will-change: transform` (none of `.dt-dd`'s chrome does) — so a fixed submenu never contributes
// to `.dt-dd`'s scrollable area in the first place, portal or not.
//
// Because the submenu is a real DOM descendant of the panel again, its `data-dd-row`-marked rows
// *are* reachable by `Dropdown.tsx`'s own generic panel-wide roving nav — which is exactly why
// that nav explicitly excludes anything inside `[data-category-submenu]` (see its own comment):
// `handleSubmenuKeyDown` below is still what should drive Up/Down/Home/End while the submenu is
// open, not the panel's. It calls `stopPropagation()` so `Dropdown.tsx`'s own panel-level handler
// never double-handles the same keydown.
export function CategorySubmenu(props: CategorySubmenuProps) {
  const [left, setLeft] = useState(0)
  const [top, setTop] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function cancelOpen(): void {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
  }
  function cancelClose(): void {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }

  function focusFirstRow(): void {
    queueMicrotask(() => {
      if (submenuRef.current) ddNavFocusables(submenuRef.current)[0]?.focus()
    })
  }
  function openNow(focusFirst: boolean): void {
    cancelOpen()
    cancelClose()
    if (!props.isOpen) {
      if (triggerRef.current) {
        // Initial guess (right of the trigger, top-aligned) — corrected by the layout effect
        // below once the submenu's real size is known. Avoids a 0,0-positioned flash before that
        // measurement lands.
        const rect = triggerRef.current.getBoundingClientRect()
        setLeft(rect.right)
        setTop(rect.top)
      }
      props.onOpen()
    }
    if (focusFirst) focusFirstRow()
  }
  function closeNow(focusTrigger: boolean): void {
    cancelOpen()
    cancelClose()
    if (props.isOpen) props.onClose()
    if (focusTrigger) triggerRef.current?.focus()
  }
  function scheduleOpen(): void {
    cancelClose()
    if (props.isOpen || openTimerRef.current) return
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = undefined
      openNow(false)
    }, OPEN_DELAY)
  }
  function scheduleClose(): void {
    cancelOpen()
    if (closeTimerRef.current) return
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined
      closeNow(false)
    }, CLOSE_DELAY)
  }

  // Corrects the initial guess above once the submenu's real size is known — runs synchronously
  // after the DOM update (before paint), same reasoning as Dropdown.tsx's own viewport-clamp
  // layout effect.
  useLayoutEffect(() => {
    if (!props.isOpen) return
    const trigger = triggerRef.current
    const submenu = submenuRef.current
    if (!trigger || !submenu) return
    const triggerRect = trigger.getBoundingClientRect()
    const rect = submenu.getBoundingClientRect()
    const pos = computeSubmenuPosition(
      triggerRect,
      { width: rect.width, height: rect.height },
      window.innerWidth,
      window.innerHeight,
    )
    setLeft(pos.left)
    setTop(pos.top)
  }, [props.isOpen])

  function handleSubmenuKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape' || e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      closeNow(true)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const submenu = submenuRef.current
    if (!submenu) return
    const focusables = ddNavFocusables(submenu)
    const active = document.activeElement as HTMLElement | null
    const idx = active ? focusables.indexOf(active) : -1
    if (idx === -1) return
    e.stopPropagation()
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      ;(e.key === 'Home' ? focusables[0] : focusables[focusables.length - 1])?.focus()
      return
    }
    const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= focusables.length) return
    e.preventDefault()
    focusables[nextIdx]?.focus()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        data-dd-row
        data-category-header={props.name}
        ref={triggerRef}
        aria-expanded={props.isOpen}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onClick={() => (props.isOpen ? closeNow(false) : openNow(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !props.isOpen) {
            e.preventDefault()
            openNow(true)
          }
        }}
        style={triggerStyle}
      >
        <span style={{ flex: 1 }}>{props.name}</span>
        <span style={arrowStyle}>▸</span>
      </button>
      {props.isOpen && (
        <div
          ref={submenuRef}
          data-category-submenu
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onKeyDown={handleSubmenuKeyDown}
          style={{ ...submenuStyle, left, top }}
        >
          {props.children}
        </div>
      )}
    </div>
  )
}
