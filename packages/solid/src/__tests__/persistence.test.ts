import { describe, it, expect, beforeEach } from 'vitest'
import { createRoot } from 'solid-js'
import { encodeViewState, decodeViewState } from '@vates/data-table-core/internal'
import { createTableState } from '../createTableState'
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

// Unlike createTableState.test.ts's own withRoot (which disposes immediately, fine for reading
// initial memo values), persistence's createEffect needs to stay alive across later state
// mutations to react to them — so this mirrors createDataTable's/TableBody.test.tsx's own
// pattern instead: keep the root's dispose function around, call it explicitly once the test
// is done observing reactions.
function mountTable(setupExtra: (table: ReturnType<typeof createTableState<Row>>) => void) {
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS)
    setupExtra(table)
    return d
  })
  return { table, dispose }
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('usePersistedView', () => {
  it('hydrates state from localStorage on mount', () => {
    localStorage.setItem('key1', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { table, dispose } = mountTable((t) => usePersistedView(t, 'key1'))
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'desc' }])
    dispose()
  })

  it('saves the view to localStorage when it changes', () => {
    const { table, dispose } = mountTable((t) => usePersistedView(t, 'key2'))
    table.sort.toggle('score')
    expect(decodeViewState(localStorage.getItem('key2')!)).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
    })
    dispose()
  })

  it('does not overwrite the persisted view with pre-hydration defaults', () => {
    localStorage.setItem('key3', encodeViewState({ searchQuery: 'x' }))
    const { dispose } = mountTable((t) => usePersistedView(t, 'key3'))
    expect(decodeViewState(localStorage.getItem('key3')!)).toEqual({ searchQuery: 'x' })
    dispose()
  })
})

describe('useUrlView', () => {
  it('hydrates state from the URL on mount', () => {
    window.history.replaceState(null, '', `/?view=${encodeViewState({ searchQuery: 'abc' })}`)
    const { table, dispose } = mountTable((t) => useUrlView(t))
    expect(table.search.query()).toBe('abc')
    dispose()
  })

  it('writes the view to the URL when it changes', () => {
    const { table, dispose } = mountTable((t) => useUrlView(t))
    table.search.setQuery('xyz')
    const encoded = new URLSearchParams(window.location.search).get('view')
    expect(decodeViewState(encoded!)).toEqual({ searchQuery: 'xyz' })
    dispose()
  })

  it('removes the view param once the view returns to default', () => {
    const { table, dispose } = mountTable((t) => useUrlView(t))
    table.search.setQuery('xyz')
    table.search.setQuery('')
    expect(new URLSearchParams(window.location.search).has('view')).toBe(false)
    dispose()
  })

  it('supports a custom paramName', () => {
    const { table, dispose } = mountTable((t) => useUrlView(t, { paramName: 'v' }))
    table.search.setQuery('xyz')
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
    dispose()
  })
})

describe('usePersistence', () => {
  it('hydrates from both localStorage and the URL, keying each off the same options object', () => {
    localStorage.setItem('key7', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { table, dispose } = mountTable((t) =>
      usePersistence(t, { storageKey: 'key7', paramName: 'v' }),
    )
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'desc' }])
    dispose()
  })

  it('saves to both localStorage and the URL when the view changes', () => {
    const { table, dispose } = mountTable((t) =>
      usePersistence(t, { storageKey: 'key8', paramName: 'v' }),
    )
    table.search.setQuery('xyz')
    expect(decodeViewState(localStorage.getItem('key8')!)).toEqual({ searchQuery: 'xyz' })
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
    dispose()
  })

  it('skips localStorage persistence entirely when storageKey is omitted', () => {
    const { table, dispose } = mountTable((t) => usePersistence(t, { paramName: 'v' }))
    table.search.setQuery('xyz')
    expect(localStorage.length).toBe(0)
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
    dispose()
  })

  it('reset() clears the same storageKey/paramName it was configured with', () => {
    let reset!: () => void
    const { table, dispose } = mountTable((t) => {
      reset = usePersistence(t, { storageKey: 'key9', paramName: 'v' }).reset
    })
    table.search.setQuery('xyz')
    expect(localStorage.getItem('key9')).not.toBeNull()
    reset()
    expect(localStorage.getItem('key9')).toBeNull()
    expect(new URLSearchParams(window.location.search).has('v')).toBe(false)
    expect(table.search.query()).toBe('')
    dispose()
  })
})

describe('resetView', () => {
  it('resets live state to construction-time defaults', () => {
    const { table, dispose } = mountTable(() => {})
    table.sort.toggle('score')
    table.search.setQuery('xyz')
    resetView(table)
    expect(table.sort.entries()).toEqual([])
    expect(table.search.query()).toBe('')
    dispose()
  })

  it('clears the given localStorage key', () => {
    localStorage.setItem('key6', encodeViewState({ searchQuery: 'xyz' }))
    const { table, dispose } = mountTable(() => {})
    resetView(table, { storageKey: 'key6' })
    expect(localStorage.getItem('key6')).toBeNull()
    dispose()
  })

  it('clears the given URL param', () => {
    const { table, dispose } = mountTable((t) => useUrlView(t, { paramName: 'v' }))
    table.search.setQuery('xyz')
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
    resetView(table, { paramName: 'v' })
    expect(new URLSearchParams(window.location.search).has('v')).toBe(false)
    dispose()
  })

  it('leaves localStorage/URL untouched when no storageKey/paramName is given', () => {
    localStorage.setItem('unrelated', 'x')
    window.history.replaceState(null, '', '/?other=1')
    const { table, dispose } = mountTable(() => {})
    resetView(table)
    expect(localStorage.getItem('unrelated')).toBe('x')
    expect(new URLSearchParams(window.location.search).get('other')).toBe('1')
    dispose()
  })
})
