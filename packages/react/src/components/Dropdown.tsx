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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        (!triggerRef.current || !triggerRef.current.contains(target)) &&
        (!panelRef.current || !panelRef.current.contains(target))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [setOpen])

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
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
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {panel}
    </div>
  )
}
