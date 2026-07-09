import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { encodeViewState, decodeViewState } from '@vates/data-table-core'
import { useTableState } from '../useTableState'
import { usePersistedView, useUrlView } from '../persistence'
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

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('usePersistedView', () => {
  it('hydrates state from localStorage on mount', () => {
    localStorage.setItem('key1', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistedView(table, 'key1')
      return table
    })
    expect(result.current.sorts).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('saves the view to localStorage when it changes', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistedView(table, 'key2')
      return table
    })
    act(() => {
      result.current.toggleSort('score')
    })
    expect(decodeViewState(localStorage.getItem('key2')!)).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
    })
  })

  it('does not overwrite the persisted view with pre-hydration defaults', () => {
    localStorage.setItem('key3', encodeViewState({ searchQuery: 'x' }))
    renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistedView(table, 'key3')
      return table
    })
    expect(decodeViewState(localStorage.getItem('key3')!)).toEqual({ searchQuery: 'x' })
  })
})

describe('useUrlView', () => {
  it('hydrates state from the URL on mount', () => {
    window.history.replaceState(null, '', `/?view=${encodeViewState({ searchQuery: 'abc' })}`)
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      useUrlView(table)
      return table
    })
    expect(result.current.searchQuery).toBe('abc')
  })

  it('writes the view to the URL when it changes', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      useUrlView(table)
      return table
    })
    act(() => {
      result.current.setSearchQuery('xyz')
    })
    const encoded = new URLSearchParams(window.location.search).get('view')
    expect(decodeViewState(encoded!)).toEqual({ searchQuery: 'xyz' })
  })

  it('removes the view param once the view returns to default', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      useUrlView(table)
      return table
    })
    act(() => {
      result.current.setSearchQuery('xyz')
    })
    act(() => {
      result.current.setSearchQuery('')
    })
    expect(new URLSearchParams(window.location.search).has('view')).toBe(false)
  })

  it('supports a custom paramName', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      useUrlView(table, { paramName: 'v' })
      return table
    })
    act(() => {
      result.current.setSearchQuery('xyz')
    })
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
  })
})

describe('usePersistedView + useUrlView composed', () => {
  it('a reload with no URL param keeps the localStorage-restored view', () => {
    localStorage.setItem('key5', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistedView(table, 'key5')
      useUrlView(table)
      return table
    })
    expect(result.current.sorts).toEqual([{ key: 'score', dir: 'desc' }])
  })
})
