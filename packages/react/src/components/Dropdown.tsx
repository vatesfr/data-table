import {
  useRef,
  useEffect,
  useLayoutEffect,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { computeDropdownClampOffset, ddNavFocusables } from '@vates/data-table-core/internal'

export interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
  // Bound to the panel itself (not per-row) so a drag-and-drop reorder list inside can resolve
  // a drop that lands past its last row / in unrelated dead space — see the Sort/Group/Columns
  // dropdown drag handlers in DataTableView.tsx.
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void
  onDrop?: (e: DragEvent<HTMLDivElement>) => void
  // Rendered as a sibling of the trigger — inside the same outside-click boundary as the trigger
  // and panel (so clicking it doesn't spuriously close the dropdown via the "click outside"
  // handler below), but outside the trigger's own onClick toggle (so it never opens/closes the
  // dropdown itself). Used for the Sort/Group/Filter toolbar's adjoining × clear button (see
  // DataTableView.tsx), visually merged into one pill with the trigger via shared CSS.
  extraTrigger?: ReactNode
}

// The panel's roving Up/Down/Home/End nav (see the keydown handler below) and its focus-on-open
// behavior (see the layout effect below) both need the same "ordered list of this panel's own
// focusable row/search elements" — `ddNavFocusables` (core's `dropdownDomUtils`, using its default
// `DD_NAV_SELECTOR`) provides this, shared with Solid's identical usage. `data-dd-search` marks a
// dropdown's own column-search input (Columns/Sort/Group's addable list/Filter's left pane, see
// DataTableView.tsx); `data-dd-row` marks every other row this nav should reach (a column
// checkbox row, a Sort/Group active or addable entry, a Filter column-selector button). This is
// deliberately generic — Dropdown has no idea which concrete dropdown it's rendering, only that
// its children may carry these two markers.

export function Dropdown({
  trigger,
  children,
  open,
  setOpen,
  onDragOver,
  onDrop,
  extraTrigger,
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // A click inside an open category submenu (see CategorySubmenu.tsx) must not count as
      // "outside" — it's portaled straight to document.body, not a DOM descendant of `ref`, for
      // reasons explained in that file's own top comment (escaping the panel's scrollable
      // overflow), so `ref.current.contains()` alone can't see it.
      const target = e.target as Element
      if (target.closest?.('[data-category-submenu]')) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [setOpen])

  // The panel unmounts entirely when closed, so each open is a fresh DOM node at its natural
  // (unclamped) position — this mutates that node's style directly rather than going through
  // React state (which would need a setState-in-effect, flagged as a cascading-render risk by
  // this project's eslint-plugin-react-hooks config). A translateX offset is used for the
  // horizontal case instead of flipping left:0 -> right:0, since the overflow is relative to
  // the viewport, not to the trigger (see vanilla's Dropdown clamp for the reasoning).
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const { dx, flipUp } = computeDropdownClampOffset(rect, window.innerWidth, window.innerHeight)
    if (dx !== 0) panel.style.transform = `translateX(${dx}px)`
    if (flipUp) {
      panel.style.top = 'auto'
      panel.style.marginTop = '0'
      panel.style.bottom = '100%'
      panel.style.marginBottom = '4px'
    }
    // Opening a dropdown should hand it focus immediately — its own search box if it has one
    // (preferred regardless of where it sits in the DOM, e.g. Sort/Group's search box renders
    // *after* the active-entries section but is still the preferred landing spot, matching
    // vanilla's focusFirstInDropdown), else the first row (e.g. Sort with every column already
    // sorted has no addable section and therefore no search box).
    const search = panel.querySelector<HTMLElement>('input[data-dd-search]')
    if (search) search.focus()
    else ddNavFocusables(panel)[0]?.focus()
  }, [open])

  // Roving Up/Down/Home/End/Escape navigation across this panel's own search box + rows — see
  // DD_NAV_SELECTOR above. A distinct concern from any Alt+↑/↓ reorder or Enter/Space toggle a
  // row itself implements (see the Sort/Group active rows in DataTableView.tsx): those don't
  // stopPropagation, so this still runs after them via bubbling, but its own `!e.altKey` guard
  // keeps it from ever acting on their modifier combo. Scoped to elements this panel actually
  // recognizes (`focusables.indexOf(active) !== -1`) so it never interferes with unrelated
  // controls elsewhere in the panel (e.g. the Filter dropdown's right-hand detail pane, which
  // implements its own nav — see handleFilterPanelKeyDown in DataTableView.tsx — including native
  // Left/Right/Up/Down/Home/End on its own range inputs/slider that must keep working unmolested).
  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('button')?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = ddNavFocusables(panel)
    const rowFocusables = focusables.filter((el) => !el.matches('input[data-dd-search]'))
    const active = document.activeElement as HTMLElement | null
    if (!active || focusables.indexOf(active) === -1) return
    if (e.key === 'Home' || e.key === 'End') {
      if (rowFocusables.length === 0) return
      e.preventDefault()
      ;(e.key === 'Home' ? rowFocusables[0] : rowFocusables[rowFocusables.length - 1]).focus()
      return
    }
    const idx = focusables.indexOf(active)
    const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= focusables.length) return
    e.preventDefault()
    focusables[nextIdx].focus()
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {extraTrigger}
      {open && (
        <div
          ref={panelRef}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={handlePanelKeyDown}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: 4,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            minWidth: 220,
            maxHeight: 420,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
