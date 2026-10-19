import type { ReactNode } from 'react'

export interface ToolbarBtnProps {
  active?: boolean
  children: ReactNode
  // True when an adjoining × clear button (see Dropdown's `extraTrigger`) is rendered right
  // after this one — squares off the right edge and drops the right border so the pair reads as
  // one merged pill instead of two separate buttons with a seam.
  grouped?: boolean
}

export function ToolbarBtn({ active, children, grouped }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={`dt-btn${active ? ' dt-btn--active' : ''}${grouped ? ' dt-btn--grouped' : ''}`}
    >
      {children}
    </button>
  )
}
