import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encodeViewState, decodeViewState } from '@vates/data-table-core'
import { createDataTable } from '../index'
import { persistViewToLocalStorage, syncViewToUrl, resetView } from '../persistence'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', filterable: true },
  { key: 'score', label: 'Score', filterable: true, type: 'number' },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90 },
  { id: 2, name: 'Bob', score: 60 },
]

describe('persistence helpers', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    container.remove()
  })

  describe('persistViewToLocalStorage', () => {
    it('hydrates from localStorage when created', () => {
      localStorage.setItem('key1', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      persistViewToLocalStorage(table, 'key1')
      expect(table.getViewState()).toEqual({ sorts: [{ key: 'score', dir: 'desc' }] })
    })

    it('saves to localStorage when the view changes', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      persistViewToLocalStorage(table, 'key2')
      table.setViewState({ searchQuery: 'abc' })
      expect(decodeViewState(localStorage.getItem('key2')!)).toEqual({ searchQuery: 'abc' })
    })

    it('does not overwrite the persisted view while hydrating', () => {
      localStorage.setItem('key3', encodeViewState({ searchQuery: 'x' }))
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      persistViewToLocalStorage(table, 'key3')
      expect(decodeViewState(localStorage.getItem('key3')!)).toEqual({ searchQuery: 'x' })
    })

    it('stops saving once unsubscribed', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      const unsubscribe = persistViewToLocalStorage(table, 'key4')
      unsubscribe()
      table.setViewState({ searchQuery: 'abc' })
      expect(localStorage.getItem('key4')).toBeNull()
    })
  })

  describe('syncViewToUrl', () => {
    it('hydrates from the URL immediately', () => {
      window.history.replaceState(null, '', `/?view=${encodeViewState({ searchQuery: 'abc' })}`)
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      syncViewToUrl(table)
      expect(table.getViewState()).toEqual({ searchQuery: 'abc' })
    })

    it('writes the view to the URL when it changes', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      syncViewToUrl(table)
      table.setViewState({ searchQuery: 'xyz' })
      const encoded = new URLSearchParams(window.location.search).get('view')
      expect(decodeViewState(encoded!)).toEqual({ searchQuery: 'xyz' })
    })

    it('removes the view param once the view returns to default', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      syncViewToUrl(table)
      table.setViewState({ searchQuery: 'xyz' })
      table.setViewState({})
      expect(new URLSearchParams(window.location.search).has('view')).toBe(false)
    })

    it('applies the view on popstate', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      syncViewToUrl(table)
      window.history.pushState(null, '', `/?view=${encodeViewState({ searchQuery: 'nav' })}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(table.getViewState()).toEqual({ searchQuery: 'nav' })
    })

    it('stops syncing once unsubscribed', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      const unsubscribe = syncViewToUrl(table)
      unsubscribe()
      table.setViewState({ searchQuery: 'xyz' })
      expect(new URLSearchParams(window.location.search).has('view')).toBe(false)
    })
  })

  describe('persistViewToLocalStorage + syncViewToUrl composed', () => {
    it('a reload with no URL param keeps the localStorage-restored view', () => {
      localStorage.setItem('key5', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      persistViewToLocalStorage(table, 'key5')
      syncViewToUrl(table)
      expect(table.getViewState()).toEqual({ sorts: [{ key: 'score', dir: 'desc' }] })
    })
  })

  describe('resetView', () => {
    it('resets live state to construction-time defaults', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      table.setViewState({ searchQuery: 'xyz' })
      resetView(table)
      expect(table.getViewState()).toEqual({})
    })

    it('clears the given localStorage key', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      persistViewToLocalStorage(table, 'key6')
      table.setViewState({ searchQuery: 'xyz' })
      expect(localStorage.getItem('key6')).not.toBeNull()
      resetView(table, { storageKey: 'key6' })
      expect(localStorage.getItem('key6')).toBeNull()
    })

    it('clears the given URL param', () => {
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      syncViewToUrl(table, { paramName: 'v' })
      table.setViewState({ searchQuery: 'xyz' })
      expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
      resetView(table, { paramName: 'v' })
      expect(new URLSearchParams(window.location.search).has('v')).toBe(false)
    })

    it('leaves localStorage/URL untouched when no storageKey/paramName is given', () => {
      localStorage.setItem('unrelated', 'x')
      window.history.replaceState(null, '', '/?other=1')
      const table = createDataTable(container, { data: ROWS, columns: COLS })
      resetView(table)
      expect(localStorage.getItem('unrelated')).toBe('x')
      expect(new URLSearchParams(window.location.search).get('other')).toBe('1')
    })
  })
})
