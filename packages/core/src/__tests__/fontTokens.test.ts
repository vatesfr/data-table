import { describe, it, expect } from 'vitest'
import { DT_STYLES } from '../styles'

describe('font tokens', () => {
  it('sets every font size and weight through a --font-* variable', () => {
    expect(DT_STYLES).not.toMatch(/font-(size|weight):\s*\d/)
  })
})
