// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest'
import { ddOpenFocusTarget } from '../dropdownDomUtils'

describe('ddOpenFocusTarget', () => {
  const original = window.matchMedia
  afterEach(() => {
    window.matchMedia = original
  })
  const coarse = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: matches && query === '(pointer: coarse)',
    })) as unknown as typeof window.matchMedia
  }
  const panel = (html: string) => {
    const el = document.createElement('div')
    el.innerHTML = html
    return el
  }
  const withSearch = () =>
    panel(
      '<button data-dd-row id="a"></button><input data-dd-search id="s"><button data-dd-row id="b"></button>',
    )

  it('focuses the search box with a fine pointer', () => {
    coarse(false)
    expect(ddOpenFocusTarget(withSearch())?.id).toBe('s')
  })

  it('focuses the first row on a touch screen, even with a search box', () => {
    coarse(true)
    expect(ddOpenFocusTarget(withSearch())?.id).toBe('a')
  })

  it('focuses the first row without a search box, and nothing on a touch screen with only one', () => {
    coarse(false)
    expect(ddOpenFocusTarget(panel('<button data-dd-row id="a"></button>'))?.id).toBe('a')
    coarse(true)
    expect(ddOpenFocusTarget(panel('<input data-dd-search>'))).toBeUndefined()
  })
})
