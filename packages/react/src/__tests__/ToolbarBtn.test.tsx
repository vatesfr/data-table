import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ToolbarBtn } from '../components/ToolbarBtn'

describe('ToolbarBtn', () => {
  // U11: a cleared right border fell back to the browser's 2px outset one
  it('keeps its own right border unless grouped, across re-renders', () => {
    const { container, rerender } = render(<ToolbarBtn>Sort</ToolbarBtn>)
    const btn = container.querySelector('button')!
    expect(btn.style.borderRight).toBe('0.5px solid var(--color-border-secondary)')
    rerender(<ToolbarBtn grouped>Sort</ToolbarBtn>)
    expect(btn.style.borderRightStyle).toBe('none')
    rerender(<ToolbarBtn>Sort</ToolbarBtn>)
    expect(btn.style.borderRight).toBe('0.5px solid var(--color-border-secondary)')
  })
})
