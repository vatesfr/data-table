import { describe, it, expect } from 'vitest'
import { STYLES } from '../styles'

describe('font tokens', () => {
  it('sets every font size and weight through a --font-* variable', () => {
    expect(STYLES).not.toMatch(/font-(size|weight):\s*\d/)
  })
})
