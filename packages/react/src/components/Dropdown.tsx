import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

export interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
  align?: 'left' | 'right'
  wrapStyle?: CSSProperties
}

export function Dropdown({
  trigger,
  children,
  open,
  setOpen,
  align = 'left',
  wrapStyle,
}: DropdownProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [flipUp, setFlipUp] = useState(false)

  // Keep a stable ref so event-handler effects don't need setOpen as a dep
  const setOpenRef = useRef(setOpen)
  useEffect(() => {
    setOpenRef.current = setOpen
  }, [setOpen])

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const update = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Measure panel after render and flip up if it would overflow the viewport bottom
  useLayoutEffect(() => {
    if (!open || !rect || !panelRef.current) {
      setFlipUp(false)
      return
    }
    const spaceBelow = window.innerHeight - rect.bottom - 4
    setFlipUp(panelRef.current.offsetHeight > spaceBelow)
  }, [open, rect])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        (!triggerRef.current || !triggerRef.current.contains(target)) &&
        (!panelRef.current || !panelRef.current.contains(target))
      ) {
        setOpenRef.current(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenRef.current(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              ...(flipUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
              ...(align === 'right'
                ? { right: window.innerWidth - rect.right }
                : { left: rect.left }),
              zIndex: 9999,
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              minWidth: 220,
              padding: '4px 0',
            }}
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={triggerRef} style={{ position: 'relative', display: 'inline-block', ...wrapStyle }}>
      <div onClick={() => setOpenRef.current(!open)}>{trigger}</div>
      {panel}
    </div>
  )
}
