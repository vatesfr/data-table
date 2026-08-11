import type { ReactNode } from 'react'

export interface ToolbarBtnProps {
  onClick?: () => void
  active?: boolean
  children: ReactNode
  title?: string
  // True when an adjoining × clear button (see Dropdown's `extraTrigger`) is rendered right
  // after this one — squares off the right edge and drops the right border so the pair reads as
  // one merged pill instead of two separate buttons with a seam.
  grouped?: boolean
}

export function ToolbarBtn({ onClick, active, children, title, grouped }: ToolbarBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        background: active ? 'var(--color-background-secondary)' : 'transparent',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: grouped ? '6px 0 0 6px' : 6,
        borderRight: grouped ? 'none' : undefined,
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--color-text-primary)',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
