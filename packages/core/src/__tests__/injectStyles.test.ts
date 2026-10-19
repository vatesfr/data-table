// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DT_STYLES, injectStyles } from '../styles'

const tags = (attr: string) => document.head.querySelectorAll(`style[${attr}]`)

describe('injectStyles', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('injects the rules once however many tables mount', () => {
    injectStyles()
    injectStyles()
    expect(tags('data-dt-styles')).toHaveLength(1)
    expect(tags('data-dt-styles')[0].textContent).toBe(DT_STYLES)
    expect(tags('data-dt-theme')).toHaveLength(0)
  })

  it('still injects theme tokens when a table without them mounted first', () => {
    injectStyles()
    injectStyles(':root{--x:1}')
    expect(tags('data-dt-styles')).toHaveLength(1)
    expect(tags('data-dt-theme')).toHaveLength(1)
    expect(tags('data-dt-theme')[0].textContent).toBe(':root{--x:1}')
  })

  it('inserts before existing <head> children so app stylesheets win the cascade', () => {
    const app = document.createElement('style')
    document.head.append(app)
    injectStyles(':root{--x:1}')
    for (const tag of [...tags('data-dt-styles'), ...tags('data-dt-theme')])
      expect(tag.compareDocumentPosition(app) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
