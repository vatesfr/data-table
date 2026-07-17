import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { encodeViewState, decodeViewState } from '@vates/data-table-core'
import { useTableState } from '../useTableState'
import { usePersistedView, useUrlView, resetView } from '../persistence'
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

type Table = ReturnType<typeof useTableState<Row>>

function mountWithTableState(setupExtra: (table: Table) => void) {
  let table!: Table
  const Comp = defineComponent({
    setup() {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Vue's setup(), not a React component; the rule's naming heuristic doesn't know Vue
      table = useTableState(ROWS, COLS)
      setupExtra(table)
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { table, wrapper }
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('usePersistedView', () => {
  it('hydrates state from localStorage on mount', () => {
    localStorage.setItem('key1', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { table } = mountWithTableState((t) => usePersistedView(t, 'key1'))
    expect(table.sorts.value).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('saves the view to localStorage when it changes', async () => {
    const { table } = mountWithTableState((t) => usePersistedView(t, 'key2'))
    table.toggleSort('score')
    await nextTick()
    expect(decodeViewState(localStorage.getItem('key2')!)).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
    })
  })

  it('does not overwrite the persisted view with pre-hydration defaults', async () => {
    localStorage.setItem('key3', encodeViewState({ searchQuery: 'x' }))
    mountWithTableState((t) => usePersistedView(t, 'key3'))
    await nextTick()
    expect(decodeViewState(localStorage.getItem('key3')!)).toEqual({ searchQuery: 'x' })
  })
})

describe('useUrlView', () => {
  it('hydrates state from the URL on mount', () => {
    window.history.replaceState(null, '', `/?view=${encodeViewState({ searchQuery: 'abc' })}`)
    const { table } = mountWithTableState((t) => useUrlView(t))
    expect(table.searchQuery.value).toBe('abc')
  })

  it('writes the view to the URL when it changes', async () => {
    const { table } = mountWithTableState((t) => useUrlView(t))
    table.setSearchQuery('xyz')
    await nextTick()
    const encoded = new URLSearchParams(window.location.search).get('view')
    expect(decodeViewState(encoded!)).toEqual({ searchQuery: 'xyz' })
  })

  it('removes the view param once the view returns to default', async () => {
    const { table } = mountWithTableState((t) => useUrlView(t))
    table.setSearchQuery('xyz')
    await nextTick()
    table.setSearchQuery('')
    await nextTick()
    expect(new URLSearchParams(window.location.search).has('view')).toBe(false)
  })

  it('supports a custom paramName', async () => {
    const { table } = mountWithTableState((t) => useUrlView(t, { paramName: 'v' }))
    table.setSearchQuery('xyz')
    await nextTick()
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
  })
})

describe('usePersistedView + useUrlView composed', () => {
  it('a reload with no URL param keeps the localStorage-restored view', () => {
    localStorage.setItem('key5', encodeViewState({ sorts: [{ key: 'score', dir: 'desc' }] }))
    const { table } = mountWithTableState((t) => {
      usePersistedView(t, 'key5')
      useUrlView(t)
    })
    expect(table.sorts.value).toEqual([{ key: 'score', dir: 'desc' }])
  })
})

describe('resetView', () => {
  it('resets live state to construction-time defaults', () => {
    const { table } = mountWithTableState(() => {})
    table.toggleSort('score')
    table.setSearchQuery('xyz')
    resetView(table)
    expect(table.sorts.value).toEqual([])
    expect(table.searchQuery.value).toBe('')
  })

  it('clears the given localStorage key', () => {
    localStorage.setItem('key6', encodeViewState({ searchQuery: 'xyz' }))
    const { table } = mountWithTableState(() => {})
    resetView(table, { storageKey: 'key6' })
    expect(localStorage.getItem('key6')).toBeNull()
  })

  it('clears the given URL param', async () => {
    const { table } = mountWithTableState((t) => useUrlView(t, { paramName: 'v' }))
    table.setSearchQuery('xyz')
    await nextTick()
    expect(new URLSearchParams(window.location.search).has('v')).toBe(true)
    resetView(table, { paramName: 'v' })
    expect(new URLSearchParams(window.location.search).has('v')).toBe(false)
  })

  it('leaves localStorage/URL untouched when no storageKey/paramName is given', () => {
    localStorage.setItem('unrelated', 'x')
    window.history.replaceState(null, '', '/?other=1')
    const { table } = mountWithTableState(() => {})
    resetView(table)
    expect(localStorage.getItem('unrelated')).toBe('x')
    expect(new URLSearchParams(window.location.search).get('other')).toBe('1')
  })
})
