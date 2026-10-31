import {
  useRef,
  useEffect,
  useLayoutEffect,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  ddNavFocusables,
  openDropdownPanel,
  rovingFocusTarget,
} from '@vates/data-table-core/internal'

export interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
  // On the panel, so a reorder drop past the last row still resolves
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void
  onDrop?: (e: DragEvent<HTMLDivElement>) => void
  // Beside the trigger, inside the outside-click boundary but outside its toggle (the toolbar's × clear button)
  extraTrigger?: ReactNode
}

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [setOpen])

  // The panel unmounts entirely when closed, so each open is a fresh DOM node at its natural
  // (unclamped) position; core writes its flip class and clamp directly, not through React state
  useLayoutEffect(() => {
    if (open && panelRef.current) return openDropdownPanel(panelRef.current)
  }, [open])

  // Roving ↑/↓/Home/End/Escape over the panel's marked rows (`DD_NAV_SELECTOR`); Alt is left to row reordering
  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('button')?.focus()
      return
    }
    const panel = panelRef.current
    if (!panel) return
    // An open CategorySubmenu runs its own nav
    const focusables = ddNavFocusables(panel).filter((el) => !el.closest('[data-category-submenu]'))
    const rowFocusables = focusables.filter((el) => !el.matches('input[data-dd-search]'))
    const target = rovingFocusTarget(e.key, focusables, document.activeElement, rowFocusables)
    if (!target) return
    e.preventDefault()
    target.focus()
  }

  return (
    <div ref={ref} className="dt-dd-wrap">
      <span style={{ display: 'inline-flex' }}>
        <span onClick={() => setOpen(!open)}>{trigger}</span>
        {extraTrigger}
      </span>
      {open && (
        <div
          ref={panelRef}
          className="dt-dd"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={handlePanelKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  )
}
