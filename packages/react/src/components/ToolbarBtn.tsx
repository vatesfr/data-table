import type { ReactNode } from 'react'

export interface ToolbarBtnProps {
  // Also squares off the right edge to merge with the adjoining × clear button (see Dropdown's
  // `extraTrigger`), which is shown exactly while the button is active.
  active?: boolean
  children: ReactNode
}

export function ToolbarBtn({ active, children }: ToolbarBtnProps) {
  return (
    <button type="button" className={`dt-btn${active ? ' dt-btn--active dt-btn--grouped' : ''}`}>
      {children}
    </button>
  )
}
