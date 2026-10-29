import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
  it('a search keystroke filters without re-sorting', () => {
    const { result } = renderHook(() =>
      useTableState(ROWS, COLS, { initialViewState: { sorts: [{ key: 'name', dir: 'asc' }] } }),
    )
    expect(vi.mocked(logic.processData)).toHaveBeenCalled()
    vi.mocked(logic.processData).mockClear()

    act(() => result.current.search.setQuery('n1'))

    expect(vi.mocked(logic.processData)).not.toHaveBeenCalled()
    expect(result.current.processedData.map((r) => r.name)).toEqual(
      ROWS.map((r) => r.name)
        .filter((n) => n.includes('n1'))
        .sort(),
    )
  })
})
