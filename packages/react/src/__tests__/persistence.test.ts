import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { encodeViewState, decodeViewState } from '@vates/data-table-core/internal'
import { useTableState } from '../useTableState'
import { usePersistedView, useUrlView, resetView, usePersistence } from '../persistence'
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
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('saves the view to localStorage when it changes', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistedView(table, 'key2')
      return table
    })
    act(() => {
      result.current.sort.toggle('score')
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
    expect(result.current.search.query).toBe('abc')
  })

  it('writes the view to the URL when it changes', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      useUrlView(table)
      return table
    })
    act(() => {
      result.current.search.setQuery('xyz')
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
      result.current.search.setQuery('xyz')
    })
    act(() => {
      result.current.search.setQuery('')
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
      result.current.search.setQuery('xyz')
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
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'desc' }])
  })
})

describe('usePersistence', () => {
  it('hydrates from both localStorage and the URL, keying each off the same options object', () => {
    localStorage.setItem('key7', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistence(table, { storageKey: 'key7', paramName: 'v' })
      return table
    })
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('saves to both localStorage and the URL when the view changes', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistence(table, { storageKey: 'key8', paramName: 'v' })
      return table
    })
    act(() => {
      result.current.search.setQuery('xyz')
    })
    expect(decodeViewState(localStorage.getItem('key8')!)).toEqual({ searchQuery: 'xyz' })
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
  })

  it('skips localStorage persistence entirely when storageKey is omitted', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      usePersistence(table, { paramName: 'v' })
      return table
    })
    act(() => {
      result.current.search.setQuery('xyz')
    })
    expect(localStorage.length).toBe(0)
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
  })

  it('reset() clears the same storageKey/paramName it was configured with', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      const { reset } = usePersistence(table, { storageKey: 'key9', paramName: 'v' })
      return { table, reset }
    })
    act(() => {
      result.current.table.search.setQuery('xyz')
    })
    expect(localStorage.getItem('key9')).not.toBeNull()
    act(() => result.current.reset())
    expect(localStorage.getItem('key9')).toBeNull()
    expect(new URLSearchParams(window.location.search).has('v')).toBe(false)
    expect(result.current.table.search.query).toBe('')
  })
})

describe('resetView', () => {
  it('resets live state to construction-time defaults', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('score')
      result.current.search.setQuery('xyz')
    })
    act(() => resetView(result.current))
    expect(result.current.sort.entries).toEqual([])
    expect(result.current.search.query).toBe('')
  })

  it('clears the given localStorage key', () => {
    localStorage.setItem('key6', encodeViewState({ searchQuery: 'xyz' }))
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => resetView(result.current, { storageKey: 'key6' }))
    expect(localStorage.getItem('key6')).toBeNull()
  })

  it('clears the given URL param', () => {
    const { result } = renderHook(() => {
      const table = useTableState(ROWS, COLS)
      useUrlView(table, { paramName: 'v' })
      return table
    })
    act(() => {
      result.current.search.setQuery('xyz')
    })
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
    act(() => resetView(result.current, { paramName: 'v' }))
    expect(new URLSearchParams(window.location.search).has('v')).toBe(false)
  })

  it('leaves localStorage/URL untouched when no storageKey/paramName is given', () => {
    localStorage.setItem('unrelated', 'x')
    window.history.replaceState(null, '', '/?other=1')
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => resetView(result.current))
    expect(localStorage.getItem('unrelated')).toBe('x')
    expect(new URLSearchParams(window.location.search).get('other')).toBe('1')
  })
})
