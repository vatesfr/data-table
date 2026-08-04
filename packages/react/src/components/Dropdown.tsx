import { useRef, useEffect, useLayoutEffect, type ReactNode } from 'react'

export interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
}

export function Dropdown({ trigger, children, open, setOpen }: DropdownProps) {
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
  // (unclamped) position — this mutates that node's style directly rather than going through
  // React state (which would need a setState-in-effect, flagged as a cascading-render risk by
  // this project's eslint-plugin-react-hooks config). A translateX offset is used for the
  // horizontal case instead of flipping left:0 -> right:0, since the overflow is relative to
  // the viewport, not to the trigger (see vanilla's Dropdown clamp for the reasoning).
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const margin = 8
    const rect = panel.getBoundingClientRect()
    let dx = 0
    if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right
    if (rect.left + dx < margin) dx = margin - rect.left
    if (dx !== 0) panel.style.transform = `translateX(${dx}px)`
    if (rect.bottom > window.innerHeight - margin) {
      panel.style.top = 'auto'
      panel.style.marginTop = '0'
      panel.style.bottom = '100%'
      panel.style.marginBottom = '4px'
    }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          ref={panelRef}
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
            padding: '4px 0',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
