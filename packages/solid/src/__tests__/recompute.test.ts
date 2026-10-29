import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot } from 'solid-js'
import * as logic from '../../../core/src/logic'
import { createTableState } from '../createTableState'
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

describe('createTableState — pipeline recomputes', () => {
  it('a search keystroke filters without re-sorting', () => {
    createRoot((dispose) => {
      const table = createTableState(ROWS, COLS, {
        initialViewState: { sorts: [{ key: 'name', dir: 'asc' }] },
      })
      expect(vi.mocked(logic.processData)).toHaveBeenCalled()
      vi.mocked(logic.processData).mockClear()

      table.search.setQuery('n1')

      expect(table.processedData().map((r) => r.name)).toEqual(
        ROWS.map((r) => r.name)
          .filter((n) => n.includes('n1'))
          .sort(),
      )
      expect(vi.mocked(logic.processData)).not.toHaveBeenCalled()
      dispose()
    })
  })
  it('builds the search index once, on the first keystroke', () => {
    createRoot((dispose) => {
      const table = createTableState(ROWS, COLS)
      expect(vi.mocked(logic.buildSearchIndex)).not.toHaveBeenCalled()

      table.search.setQuery('n')
      table.search.setQuery('n1')

      expect(table.processedData()).toHaveLength(11)
      expect(vi.mocked(logic.buildSearchIndex)).toHaveBeenCalledTimes(1)
      dispose()
    })
  })
  it('a group toggle groups once', () => {
    createRoot((dispose) => {
      const table = createTableState(ROWS, COLS)
      vi.mocked(logic.groupData).mockClear()

      table.group.toggle('name')

      expect(vi.mocked(logic.groupData)).toHaveBeenCalledTimes(1)
      expect(table.sort.entries()).toEqual([{ key: 'name', dir: 'asc' }])
      dispose()
    })
  })
})
