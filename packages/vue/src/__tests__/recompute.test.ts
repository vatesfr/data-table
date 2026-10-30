import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import * as logic from '../../../core/src/logic'
import { useTableState } from '../useTableState'
import type { ColumnDef } from '../types'

// Spies on core's pure functions while keeping their real behavior, to count how often the
// pipeline reruns; core is imported through both entries, which both re-export `logic.ts`.
vi.mock('../../../core/src/logic', { spy: true })

interface Row {
  id: number
  name: string
}

const COLS: ColumnDef<Row>[] = [
  { key: 'id', label: 'ID', type: 'number' },
  { key: 'name', label: 'Name' },
]
const ROWS: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `n${i}` }))

beforeEach(() => vi.clearAllMocks())

describe('useTableState — pipeline recomputes', () => {
  it('a search keystroke filters without re-sorting', async () => {
    const table = useTableState(ROWS, COLS, {
      initialViewState: { sorts: [{ key: 'name', dir: 'asc' }] },
    })
    void table.processedData.value
    expect(vi.mocked(logic.sortData)).toHaveBeenCalled()
    vi.mocked(logic.sortData).mockClear()

    table.search.setQuery('n1')
    await nextTick()

    expect(table.processedData.value.map((r) => r.name)).toEqual(
      ROWS.map((r) => r.name)
        .filter((n) => n.includes('n1'))
        .sort(),
    )
    expect(vi.mocked(logic.sortData)).not.toHaveBeenCalled()
  })
  it('builds the search index once, on the first keystroke', async () => {
    const table = useTableState(ROWS, COLS)
    void table.processedData.value
    expect(vi.mocked(logic.buildSearchIndex)).not.toHaveBeenCalled()

    table.search.setQuery('n')
    await nextTick()
    void table.processedData.value
    table.search.setQuery('n1')
    await nextTick()

    expect(table.processedData.value).toHaveLength(11)
    expect(vi.mocked(logic.buildSearchIndex)).toHaveBeenCalledTimes(1)
  })
})
