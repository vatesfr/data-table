/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest'

const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx,vue}', '!./**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('font tokens', () => {
  it('sets every font size and weight through a --font-* variable', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(1)
    for (const [file, source] of Object.entries(SOURCES))
      expect(source, file).not.toMatch(/font-?(size|weight):\s*['"]?\d/i)
  })
})
