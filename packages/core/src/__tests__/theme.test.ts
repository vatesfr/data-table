import { describe, it, expect } from 'vitest'
import { LIGHT_THEME, DARK_THEME, renderThemeCss } from '../theme'

describe('theme', () => {
  it('LIGHT_THEME and DARK_THEME define the same set of tokens', () => {
    expect(Object.keys(DARK_THEME).sort()).toEqual(Object.keys(LIGHT_THEME).sort())
  })

  it('renderThemeCss emits a :root block, a dark media query, and data-theme overrides', () => {
    const css = renderThemeCss()
    expect(css).toContain(
      `:root{--color-background-primary:${LIGHT_THEME['color-background-primary']}`,
    )
    expect(css).toContain('@media(prefers-color-scheme:dark){:root{')
    expect(css).toContain(`--color-background-primary:${DARK_THEME['color-background-primary']}`)
    expect(css).toContain('[data-theme=dark]{')
    expect(css).toContain('[data-theme=light]{')
  })
})
