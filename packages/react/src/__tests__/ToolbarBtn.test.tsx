import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ToolbarBtn } from '../components/ToolbarBtn'

describe('ToolbarBtn', () => {
  // U11: a cleared right border fell back to the browser's 2px outset one
  it('drops its right border only while active, across re-renders', () => {
    const { container, rerender } = render(<ToolbarBtn>Sort</ToolbarBtn>)
    const btn = container.querySelector('button')!
    expect(btn.className).toBe('dt-btn')
    rerender(<ToolbarBtn active>Sort</ToolbarBtn>)
    expect(btn.classList.contains('dt-btn--grouped')).toBe(true)
    rerender(<ToolbarBtn>Sort</ToolbarBtn>)
    expect(btn.className).toBe('dt-btn')
  })
})
