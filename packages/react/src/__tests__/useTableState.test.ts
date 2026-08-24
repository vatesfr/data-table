import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableState } from '../useTableState'
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
  { id: 3, name: 'Clara', score: 80 },
  { id: 4, name: 'David', score: 70 },
]

describe('useTableState — initial state', () => {
  it('exposes all rows in processedData and selectedRows is empty', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.processedData).toEqual(ROWS)
    expect(result.current.selection.rows).toEqual([])
  })

  it('defaults to all columns visible', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.columns.active).toHaveLength(3)
  })

  it('respects defaultVisibleColumns', () => {
    const { result } = renderHook(() =>
      useTableState(ROWS, COLS, { defaultVisibleColumns: ['id', 'name'] }),
    )
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['id', 'name'])
  })

  it('defaults pageSize to 0 (no pagination, all rows on one page)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.pagedData).toHaveLength(4)
  })

  it('respects defaultPageSize', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    expect(result.current.pagedData).toHaveLength(2)
    expect(result.current.pagination.numPages).toBe(2)
  })
})

describe('useTableState — row selection', () => {
  it('toggleRowSelection adds and removes by object identity', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggle(ROWS[0])
    })
    expect(result.current.selection.rows).toEqual([ROWS[0]])
    act(() => {
      result.current.selection.toggle(ROWS[0])
    })
    expect(result.current.selection.rows).toEqual([])
  })

  it('selectedRows only reflects rows present in processedData', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggle(ROWS[0]) // Alice
      result.current.selection.toggle(ROWS[1]) // Bob
    })
    // Filter down to Alice only — Bob disappears from selectedRows but stays in selection
    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
    })
    expect(result.current.selection.rows).toEqual([ROWS[0]])
    // Clearing the filter brings Bob back into selectedRows
    act(() => {
      result.current.filter.clear()
    })
    expect(result.current.selection.rows).toEqual([ROWS[0], ROWS[1]])
  })

  it('toggleSelectAll selects all when none are selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggleAll(ROWS)
    })
    expect(result.current.selection.rows).toHaveLength(4)
  })

  it('toggleSelectAll deselects all when all are selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggleAll(ROWS)
    })
    act(() => {
      result.current.selection.toggleAll(ROWS)
    })
    expect(result.current.selection.rows).toEqual([])
  })

  it('toggleSelectAll deselects all when only some are selected (partial)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggle(ROWS[0])
    })
    act(() => {
      result.current.selection.toggleAll(ROWS)
    })
    expect(result.current.selection.rows).toHaveLength(0)
  })

  it('toggleSelectAll with empty array is a no-op', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggle(ROWS[0])
    })
    act(() => {
      result.current.selection.toggleAll([])
    })
    expect(result.current.selection.rows).toHaveLength(1)
  })

  it('clearSelection empties the selection', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggleAll(ROWS)
    })
    act(() => {
      result.current.selection.clear()
    })
    expect(result.current.selection.rows).toEqual([])
  })

  it('shift-click toggleRowSelection selects the range between the last click and the target', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggle(ROWS[0]) // anchor = Alice
    })
    act(() => {
      result.current.selection.toggle(ROWS[2], true) // shift-click Clara
    })
    expect(result.current.selection.rows).toEqual([ROWS[0], ROWS[1], ROWS[2]])
  })

  it('shift-click deselects the range when the clicked row is already selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggleAll(ROWS) // all four selected
    })
    act(() => {
      result.current.selection.toggle(ROWS[0]) // anchor = Alice, now deselected
    })
    act(() => {
      result.current.selection.toggle(ROWS[0]) // re-select Alice, anchor stays Alice
    })
    act(() => {
      result.current.selection.toggle(ROWS[2], true) // shift-click already-selected Clara
    })
    // Clara was selected, so the whole range [Alice, Bob, Clara] gets deselected; David stays.
    expect(result.current.selection.rows).toEqual([ROWS[3]])
  })

  it('shift-click with no prior anchor falls back to a plain toggle', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.selection.toggle(ROWS[2], true)
    })
    expect(result.current.selection.rows).toEqual([ROWS[2]])
  })
})

describe('useTableState — getRowId (selection identity)', () => {
  it('without getRowId, a refetch (new row objects) silently drops selection', () => {
    const { result, rerender } = renderHook(({ data }) => useTableState(data, COLS), {
      initialProps: { data: ROWS },
    })
    act(() => {
      result.current.selection.toggle(ROWS[0])
    })
    expect(result.current.selection.rows).toEqual([ROWS[0]])
    const refetched = ROWS.map((r) => ({ ...r }))
    rerender({ data: refetched })
    expect(result.current.selection.rows).toEqual([])
  })

  it('with getRowId, selection survives a refetch that produces new row objects', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableState(data, COLS, { getRowId: (r) => r.id }),
      { initialProps: { data: ROWS } },
    )
    act(() => {
      result.current.selection.toggle(ROWS[0]) // Alice, id 1
    })
    const refetched = ROWS.map((r) => ({ ...r }))
    rerender({ data: refetched })
    expect(result.current.selection.rows).toEqual([refetched[0]])
  })

  it('with getRowId, a row no longer present after the refetch is dropped from selection', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableState(data, COLS, { getRowId: (r) => r.id }),
      { initialProps: { data: ROWS } },
    )
    act(() => {
      result.current.selection.toggle(ROWS[0]) // Alice, id 1
    })
    const refetchedWithoutAlice = ROWS.slice(1).map((r) => ({ ...r }))
    rerender({ data: refetchedWithoutAlice })
    expect(result.current.selection.rows).toEqual([])
  })

  it('with getRowId, toggleRowSelection on a fresh-object row with a selected id deselects it', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableState(data, COLS, { getRowId: (r) => r.id }),
      { initialProps: { data: ROWS } },
    )
    act(() => {
      result.current.selection.toggle(ROWS[0]) // Alice, id 1
    })
    const refetched = ROWS.map((r) => ({ ...r }))
    rerender({ data: refetched })
    act(() => {
      result.current.selection.toggle(refetched[0]) // same id, different reference
    })
    expect(result.current.selection.rows).toEqual([])
  })

  it('with getRowId, toggleSelectAll treats a stale-reference id as already selected', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableState(data, COLS, { getRowId: (r) => r.id }),
      { initialProps: { data: ROWS } },
    )
    act(() => {
      result.current.selection.toggle(ROWS[0]) // Alice, id 1
    })
    const refetched = ROWS.map((r) => ({ ...r }))
    rerender({ data: refetched })
    act(() => {
      result.current.selection.toggleAll(refetched)
    })
    // Alice (id 1) was already selected (by id) before this call, so this is the deselect-all
    // branch: nothing should end up selected.
    expect(result.current.selection.rows).toEqual([])
  })
})

describe('useTableState — column visibility', () => {
  it('toggleColVisibility hides a column', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.columns.toggleVisibility('name')
    })
    expect(result.current.columns.active.map((c) => c.key)).not.toContain('name')
  })

  it('toggleColVisibility shows a hidden column', () => {
    const { result } = renderHook(() =>
      useTableState(ROWS, COLS, { defaultVisibleColumns: ['id'] }),
    )
    act(() => {
      result.current.columns.toggleVisibility('name')
    })
    expect(result.current.columns.active.map((c) => c.key)).toContain('name')
  })

  it('cannot hide the last visible column', () => {
    const { result } = renderHook(() =>
      useTableState(ROWS, COLS, { defaultVisibleColumns: ['id'] }),
    )
    act(() => {
      result.current.columns.toggleVisibility('id')
    })
    expect(result.current.columns.active.map((c) => c.key)).toContain('id')
  })

  it('a columns prop swapped to a fully disjoint key set keeps every new column visible, instead of filtering all of them out', () => {
    const { result, rerender } = renderHook(
      ({ columns }: { columns: ColumnDef<Row>[] }) => useTableState(ROWS, columns),
      { initialProps: { columns: COLS } },
    )
    expect(result.current.columns.active).toHaveLength(3)
    const NEW_COLS: ColumnDef<Row>[] = [
      { key: 'sku', label: 'SKU' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ]
    rerender({ columns: NEW_COLS })
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['sku', 'qty'])
  })

  it("a columns prop change preserves an existing column's hidden state and defaults a genuinely new column to visible", () => {
    const { result, rerender } = renderHook(
      ({ columns }: { columns: ColumnDef<Row>[] }) => useTableState(ROWS, columns),
      { initialProps: { columns: COLS } },
    )
    act(() => {
      result.current.columns.toggleVisibility('score') // hide it
    })
    const withExtra: ColumnDef<Row>[] = [...COLS, { key: 'extra', label: 'Extra' }]
    rerender({ columns: withExtra })
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['id', 'name', 'extra'])
  })
})

describe('useTableState — column ordering', () => {
  it('defaults to natural column order', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('moveColumn reorders by drag-and-drop semantics (insert before target)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.columns.move('score', 'id')
    })
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['score', 'id', 'name'])
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })

  it('moveColumnBy swaps with the neighbor in the given direction', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.columns.moveBy('id', 1)
    })
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['name', 'id', 'score'])
  })

  it('moveColumnBy is a no-op past the boundary', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.columns.moveBy('id', -1)
    })
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('preserves order across visibility toggles', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.columns.move('score', 'id')
      result.current.columns.toggleVisibility('name')
    })
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['score', 'id'])
    act(() => {
      result.current.columns.toggleVisibility('name')
    })
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — sort remove/direction/reorder', () => {
  it('removeSort clears a sort entry without cycling through direction', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('score')
    })
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'asc' }])
    act(() => {
      result.current.sort.remove('score')
    })
    expect(result.current.sort.entries).toEqual([])
  })

  it('toggleSort starts at defaultSortDir and cycles the reverse direction next', () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', defaultSortDir: 'desc' }]
    const { result } = renderHook(() => useTableState(ROWS, cols))
    act(() => {
      result.current.sort.toggle('score')
    })
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'desc' }])
    act(() => {
      result.current.sort.toggle('score')
    })
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'asc' }])
    act(() => {
      result.current.sort.toggle('score')
    })
    expect(result.current.sort.entries).toEqual([])
  })

  it('replaceSort (header click) starts at defaultSortDir', () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', defaultSortDir: 'desc' }]
    const { result } = renderHook(() => useTableState(ROWS, cols))
    act(() => {
      result.current.sort.replace('score')
    })
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('appendOrToggleSort (shift-click) starts at defaultSortDir', () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', defaultSortDir: 'desc' }]
    const { result } = renderHook(() => useTableState(ROWS, cols))
    act(() => {
      result.current.sort.appendOrToggle('score')
    })
    expect(result.current.sort.entries).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('toggleSortDir flips an existing entry in place without reordering', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('name')
      result.current.sort.toggle('score')
    })
    act(() => {
      result.current.sort.toggleDir('name')
    })
    expect(result.current.sort.entries).toEqual([
      { key: 'name', dir: 'desc' },
      { key: 'score', dir: 'asc' },
    ])
  })

  it('moveSortBy reorders priority by swapping with a neighbor', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('name')
      result.current.sort.toggle('score')
    })
    act(() => {
      result.current.sort.moveBy('score', -1)
    })
    expect(result.current.sort.entries.map((s) => s.key)).toEqual(['score', 'name'])
  })

  it('moveSort reorders by drag-and-drop semantics (insert before target)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('id')
      result.current.sort.toggle('name')
      result.current.sort.toggle('score')
    })
    act(() => {
      result.current.sort.move('score', 'id')
    })
    expect(result.current.sort.entries.map((s) => s.key)).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — group remove/reorder', () => {
  const GROUPABLE_COLS: ColumnDef<Row>[] = [
    { key: 'id', label: 'ID', groupable: true },
    { key: 'name', label: 'Name', groupable: true },
    { key: 'score', label: 'Score', groupable: true },
  ]

  it('removeGroup clears a group entry', () => {
    const { result } = renderHook(() => useTableState(ROWS, GROUPABLE_COLS))
    act(() => {
      result.current.group.toggle('name')
    })
    expect(result.current.group.by).toEqual(['name'])
    act(() => {
      result.current.group.remove('name')
    })
    expect(result.current.group.by).toEqual([])
  })

  it('moveGroupBy reorders priority by swapping with a neighbor', () => {
    const { result } = renderHook(() => useTableState(ROWS, GROUPABLE_COLS))
    act(() => {
      result.current.group.toggle('name')
      result.current.group.toggle('score')
    })
    act(() => {
      result.current.group.moveBy('score', -1)
    })
    expect(result.current.group.by).toEqual(['score', 'name'])
  })

  it('moveGroup reorders by drag-and-drop semantics (insert before target)', () => {
    const { result } = renderHook(() => useTableState(ROWS, GROUPABLE_COLS))
    act(() => {
      result.current.group.toggle('id')
      result.current.group.toggle('name')
      result.current.group.toggle('score')
    })
    act(() => {
      result.current.group.move('score', 'id')
    })
    expect(result.current.group.by).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — keepVisibleWhenGrouped', () => {
  const COLS_WITH_KEEP: ColumnDef<Row>[] = [
    { key: 'id', label: 'ID', groupable: true },
    { key: 'name', label: 'Name', groupable: true, keepVisibleWhenGrouped: true },
    { key: 'score', label: 'Score', groupable: true },
  ]

  it('still hides a grouped column by default', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS_WITH_KEEP))
    act(() => {
      result.current.group.toggle('score')
    })
    expect(result.current.columns.active.map((c) => c.key)).not.toContain('score')
  })

  it('keeps a grouped column in activeColumns when keepVisibleWhenGrouped is set', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS_WITH_KEEP))
    act(() => {
      result.current.group.toggle('name')
    })
    expect(result.current.columns.active.map((c) => c.key)).toContain('name')
  })

  it('column reappears in activeColumns once ungrouped either way', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS_WITH_KEEP))
    act(() => {
      result.current.group.toggle('name')
    })
    act(() => {
      result.current.group.remove('name')
    })
    expect(result.current.columns.active.map((c) => c.key)).toContain('name')
  })
})

describe('useTableState — pagination', () => {
  it('setPage navigates between pages', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    expect(result.current.pagination.page).toBe(2)
    expect(result.current.pagedData).toEqual([ROWS[2], ROWS[3]])
  })

  it('setPage clamps to numPages', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(100)
    })
    expect(result.current.pagination.page).toBe(2)
  })

  it('setPage clamps to 1 at minimum', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(-5)
    })
    expect(result.current.pagination.page).toBe(1)
  })

  it('setPage ignores NaN instead of corrupting page state', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
      result.current.pagination.setPage(NaN)
    })
    expect(result.current.pagination.page).toBe(2)
  })

  it('setPageSize ignores NaN instead of breaking pagination', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPageSize(NaN)
    })
    expect(result.current.pagination.pageSize).toBe(2)
    expect(result.current.pagination.numPages).toBe(2)
  })

  it('setPageSize resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    act(() => {
      result.current.pagination.setPageSize(3)
    })
    expect(result.current.pagination.page).toBe(1)
  })

  it('page self-clamps when numPages shrinks without an explicit setPage call', () => {
    // e.g. a group being collapsed, or (as reproduced here) data shrinking — nothing calls
    // setPage, so pagination.page must reflect the new, smaller numPages on its own rather
    // than reporting a stale out-of-range page number.
    const { result, rerender } = renderHook(
      ({ data }) => useTableState(data, COLS, { defaultPageSize: 2 }),
      { initialProps: { data: ROWS } },
    )
    act(() => {
      result.current.pagination.setPage(2)
    })
    expect(result.current.pagination.page).toBe(2)
    rerender({ data: ROWS.slice(0, 2) })
    expect(result.current.pagination.numPages).toBe(1)
    expect(result.current.pagination.page).toBe(1)
  })
})

describe('useTableState — pagination with grouping', () => {
  interface DeptRow {
    id: number
    name: string
    dept: string
  }
  const DEPT_COLS: ColumnDef<DeptRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Department', groupable: true },
  ]
  const DEPT_ROWS: DeptRow[] = [
    { id: 1, name: 'Alice', dept: 'Eng' },
    { id: 2, name: 'Bob', dept: 'Eng' },
    { id: 3, name: 'Clara', dept: 'HR' },
    { id: 4, name: 'David', dept: 'HR' },
  ]

  it('counts header rows toward numPages, growing when expanded vs. the 4 data rows alone', () => {
    const { result } = renderHook(() =>
      useTableState(DEPT_ROWS, DEPT_COLS, { defaultPageSize: 2, defaultGroupsCollapsed: false }),
    )
    act(() => {
      result.current.group.toggle('dept')
    })
    // 2 headers + 4 rows = 6 visible items, pageSize 2 => 3 pages (not 2, as pure data pagination would give)
    expect(result.current.pagination.numPages).toBe(3)
  })

  it("splits an expanded group's rows across a page boundary and repeats its header as a continued chunk", () => {
    const { result } = renderHook(() =>
      useTableState(DEPT_ROWS, DEPT_COLS, { defaultPageSize: 2, defaultGroupsCollapsed: false }),
    )
    act(() => {
      result.current.group.toggle('dept')
    })
    expect(result.current.groupedData).toEqual([
      {
        key: 'Eng',
        keyParts: ['Eng'],
        rows: [DEPT_ROWS[0]],
        continued: false,
        sampleRow: DEPT_ROWS[0],
      },
    ])
    act(() => {
      result.current.pagination.setPage(2)
    })
    expect(result.current.groupedData).toEqual([
      {
        key: 'Eng',
        keyParts: ['Eng'],
        rows: [DEPT_ROWS[1]],
        continued: true,
        sampleRow: DEPT_ROWS[0],
      },
      { key: 'HR', keyParts: ['HR'], rows: [], continued: false, sampleRow: DEPT_ROWS[2] },
    ])
  })

  it("backfills a collapsed group's rows from the full group instead of whatever page its header lands on", () => {
    // defaultGroupsCollapsed defaults to true (6th arg omitted)
    const { result } = renderHook(() => useTableState(DEPT_ROWS, DEPT_COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.group.toggle('dept')
    })
    // Both groups collapsed => visible items are just the 2 headers, all fitting on page 1
    expect(result.current.pagination.numPages).toBe(1)
    expect(result.current.groupedData.find((g) => g.key === 'Eng')?.rows).toEqual([
      DEPT_ROWS[0],
      DEPT_ROWS[1],
    ])
  })

  it('pagedData reflects the data rows actually visible on the page, not a flat pageSize slice', () => {
    const { result } = renderHook(() =>
      useTableState(DEPT_ROWS, DEPT_COLS, { defaultPageSize: 2, defaultGroupsCollapsed: false }),
    )
    act(() => {
      result.current.group.toggle('dept')
    })
    // page 1 budget: 1 header + 1 data row = 2 items, so only Alice is a *data* row here
    expect(result.current.pagedData).toEqual([DEPT_ROWS[0]])
  })
})

describe('useTableState — filters reset page', () => {
  it('cycleFilterValue resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
    })
    expect(result.current.pagination.page).toBe(1)
  })

  it('setRangeFilter resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    act(() => {
      result.current.filter.setRange('score', 'min', '70')
    })
    expect(result.current.pagination.page).toBe(1)
  })

  it('toggleFilterAll resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    act(() => {
      result.current.filter.toggleAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.pagination.page).toBe(1)
  })
})

describe('useTableState — toggleFilterAll', () => {
  it('selects all given values when none are selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.toggleAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filter.include['name']?.has('Alice')).toBe(true)
    expect(result.current.filter.include['name']?.has('Bob')).toBe(true)
  })

  it('deselects all given values when all are already selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.toggleAll('name', ['Alice', 'Bob'])
    })
    act(() => {
      result.current.filter.toggleAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filter.include['name']?.size ?? 0).toBe(0)
  })

  it('only affects the given values, leaving other selections for the same key untouched', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Clara')
      result.current.filter.toggleAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filter.include['name']?.has('Clara')).toBe(true)
    expect(result.current.filter.include['name']?.has('Alice')).toBe(true)
    expect(result.current.filter.include['name']?.has('Bob')).toBe(true)
  })
})

describe('useTableState — cycleFilterValue (exclude filters)', () => {
  it('cycles a value neutral -> include -> exclude -> neutral', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
    })
    expect(result.current.filter.include['name']?.has('Alice')).toBe(true)
    expect(result.current.filter.exclude['name']?.has('Alice') ?? false).toBe(false)

    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
    })
    expect(result.current.filter.include['name']?.has('Alice')).toBe(false)
    expect(result.current.filter.exclude['name']?.has('Alice')).toBe(true)
    expect(result.current.processedData.map((r) => r.name)).not.toContain('Alice')

    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
    })
    expect(result.current.filter.include['name']?.has('Alice') ?? false).toBe(false)
    expect(result.current.filter.exclude['name']?.has('Alice') ?? false).toBe(false)
    expect(result.current.processedData).toHaveLength(4)
  })

  it('activeFilterCount counts a column with an active exclude filter', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
      result.current.filter.cycleValue('name', 'Alice') // include -> exclude
    })
    expect(result.current.filter.activeCount).toBe(1)
  })
})

describe('useTableState — toggleFilterAll and exclude filters', () => {
  it("select-all's ON branch clears an existing exclusion on a listed value", () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
      result.current.filter.cycleValue('name', 'Alice') // include -> exclude
    })
    act(() => {
      result.current.filter.toggleAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filter.include['name']?.has('Alice')).toBe(true)
    expect(result.current.filter.exclude['name']?.has('Alice') ?? false).toBe(false)
  })

  it("select-all's deselect branch leaves an unrelated exclusion untouched", () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Bob') // include Bob
      result.current.filter.cycleValue('name', 'Alice')
      result.current.filter.cycleValue('name', 'Alice') // include -> exclude Alice
    })
    act(() => {
      // 'Bob' is included (so this is the deselect branch); 'Alice' is excluded, not included.
      result.current.filter.toggleAll('name', ['Bob'])
    })
    expect(result.current.filter.include['name']?.has('Bob')).toBe(false)
    expect(result.current.filter.exclude['name']?.has('Alice')).toBe(true)
  })
})

describe('useTableState — clearColumnFilter kinds', () => {
  it('clearing the include kind leaves an exclude filter on the same column untouched', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Bob')
      result.current.filter.cycleValue('name', 'Alice')
      result.current.filter.cycleValue('name', 'Alice') // include -> exclude
    })
    act(() => {
      result.current.filter.clearColumn('name', 'include')
    })
    expect(result.current.filter.include['name']?.size ?? 0).toBe(0)
    expect(result.current.filter.exclude['name']?.has('Alice')).toBe(true)
  })

  it('clearing the exclude kind leaves an include filter on the same column untouched', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Bob')
      result.current.filter.cycleValue('name', 'Alice')
      result.current.filter.cycleValue('name', 'Alice') // include -> exclude
    })
    act(() => {
      result.current.filter.clearColumn('name', 'exclude')
    })
    expect(result.current.filter.exclude['name']?.size ?? 0).toBe(0)
    expect(result.current.filter.include['name']?.has('Bob')).toBe(true)
  })
})

describe('useTableState — setFilterValues', () => {
  it('adds the given values unconditionally when selected is true', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.setValues('name', ['Alice', 'Bob'], true)
    })
    expect(result.current.filter.include['name']?.has('Alice')).toBe(true)
    expect(result.current.filter.include['name']?.has('Bob')).toBe(true)
  })

  it('removes the given values unconditionally when selected is false', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.setValues('name', ['Alice', 'Bob', 'Clara'], true)
    })
    act(() => {
      result.current.filter.setValues('name', ['Alice', 'Bob'], false)
    })
    expect(result.current.filter.include['name']?.has('Alice')).toBe(false)
    expect(result.current.filter.include['name']?.has('Bob')).toBe(false)
    expect(result.current.filter.include['name']?.has('Clara')).toBe(true)
  })
})

describe('useTableState — filters reset page (clearFilters)', () => {
  it('clearFilters resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    act(() => {
      result.current.filter.clear()
    })
    expect(result.current.pagination.page).toBe(1)
  })
})

describe('useTableState — search', () => {
  it('defaults searchQuery to empty string', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.search.query).toBe('')
  })

  it('setSearchQuery filters processedData', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.search.setQuery('ali')
    })
    expect(result.current.processedData.map((r) => r.name)).toEqual(['Alice'])
  })

  it('setSearchQuery resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, { defaultPageSize: 2 }))
    act(() => {
      result.current.pagination.setPage(2)
    })
    act(() => {
      result.current.search.setQuery('a')
    })
    expect(result.current.pagination.page).toBe(1)
  })

  it('clearAll resets searchQuery', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.search.setQuery('alice')
    })
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.search.query).toBe('')
    expect(result.current.processedData).toHaveLength(4)
  })
})

interface Game {
  id: number
  name: string
  tags: string[]
}

const GAME_COLS: ColumnDef<Game>[] = [
  { key: 'name', label: 'Name' },
  { key: 'tags', label: 'Tags', filterable: true, groupable: true },
]

const GAMES: Game[] = [
  { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
  { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
]

const GAMES_WITH_EMPTY: Game[] = [...GAMES, { id: 3, name: 'Game C', tags: [] }]

describe('useTableState — multi-value (array) columns', () => {
  it('stringValueMap flattens array values into individual filter options', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    expect(result.current.filter.valueMap['tags']).toEqual(['Action', 'Adventure', 'RPG'])
  })

  // stringValueCounts (facet counts) moved out of useTableState into DataTableView — see
  // DataTable.test.tsx's "filter dropdown" describe block for coverage of the rendered counts,
  // and packages/core's logic.test.ts for the underlying computeStringValueCounts faceting logic.

  it('cycleFilterValue matches rows whose array contains the selected value', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.filter.cycleValue('tags', 'RPG')
    })
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A'])
  })

  it('groupedData fans a row into one group per array item', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.group.toggle('tags')
    })
    expect(result.current.groupedData.map((g) => g.key).sort()).toEqual([
      'Action',
      'Adventure',
      'RPG',
    ])
  })

  it('stringValueMap lists a "(none)" entry for rows with an empty array', () => {
    const { result } = renderHook(() => useTableState(GAMES_WITH_EMPTY, GAME_COLS))
    expect(result.current.filter.valueMap['tags']).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('groupedData buckets rows with an empty array under "(none)"', () => {
    const { result } = renderHook(() => useTableState(GAMES_WITH_EMPTY, GAME_COLS))
    act(() => {
      result.current.group.toggle('tags')
    })
    const noneGroup = result.current.groupedData.find((g) => g.key === '(none)')
    expect(noneGroup?.rows.map((r) => r.name)).toEqual(['Game C'])
  })

  it('uses a custom emptyValue label when provided', () => {
    const { result } = renderHook(() =>
      useTableState(GAMES_WITH_EMPTY, GAME_COLS, { labels: { emptyValue: 'N/A' } }),
    )
    expect(result.current.filter.valueMap['tags']).toContain('N/A')
    act(() => {
      result.current.group.toggle('tags')
    })
    expect(result.current.groupedData.map((g) => g.key)).toContain('N/A')
  })
})

describe('useTableState — filter.setMode (any/all match)', () => {
  it('defaults to "or" (union) semantics with no override', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.filter.setValues('tags', ['Action', 'RPG'], true)
    })
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A', 'Game B'])
  })

  it('setMode sets a column directly to "and" (intersection) semantics', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.filter.setValues('tags', ['Action', 'RPG'], true)
    })
    act(() => {
      result.current.filter.setMode('tags', 'and')
    })
    expect(result.current.filter.modes['tags']).toBe('and')
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A'])
    act(() => {
      result.current.filter.setMode('tags', 'or')
    })
    expect(result.current.filter.modes['tags']).toBe('or')
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A', 'Game B'])
  })

  it("overrides the column's own multiMode default", () => {
    const cols: ColumnDef<Game>[] = [
      { key: 'name', label: 'Name' },
      { key: 'tags', label: 'Tags', filterable: true, multiMode: 'and' },
    ]
    const { result } = renderHook(() => useTableState(GAMES, cols))
    act(() => {
      result.current.filter.setValues('tags', ['Action', 'RPG'], true)
    })
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A'])
    act(() => {
      result.current.filter.setMode('tags', 'or')
    })
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A', 'Game B'])
  })

  it('filter.clear() and clearAll() reset any overridden modes', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.filter.setMode('tags', 'and')
    })
    act(() => {
      result.current.filter.clear()
    })
    expect(result.current.filter.modes).toEqual({})

    act(() => {
      result.current.filter.setMode('tags', 'and')
    })
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.filter.modes).toEqual({})
  })

  it('round-trips an overridden filter mode via getViewState/setViewState', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.filter.setMode('tags', 'and')
    })
    const view = result.current.getViewState()
    expect(view.filterModes).toEqual({ tags: 'and' })

    const { result: result2 } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result2.current.setViewState(view)
    })
    expect(result2.current.filter.modes).toEqual({ tags: 'and' })
  })
})

describe('useTableState — computed columns', () => {
  const COMPUTED_COLS: ColumnDef<Row>[] = [
    ...COLS,
    {
      key: 'grade',
      label: 'Grade',
      groupable: true,
      value: (row) => (row.score >= 80 ? 'A' : 'B'),
    },
  ]

  it('sorts by a computed column value', () => {
    const { result } = renderHook(() => useTableState(ROWS, COMPUTED_COLS))
    act(() => {
      result.current.sort.toggle('grade')
    })
    expect(result.current.processedData.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
      'Bob',
      'David',
    ])
  })

  it('groups by a computed column value', () => {
    const { result } = renderHook(() => useTableState(ROWS, COMPUTED_COLS))
    act(() => {
      result.current.group.toggle('grade')
    })
    expect(result.current.groupedData.find((g) => g.key === 'A')?.rows.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
    ])
    expect(result.current.groupedData.find((g) => g.key === 'B')?.rows.map((r) => r.name)).toEqual([
      'Bob',
      'David',
    ])
  })
})

describe('useTableState — view state', () => {
  it('getViewState omits fields still at their default', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.getViewState()).toEqual({})
  })

  it('getViewState captures changes made through actions', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('score')
      result.current.filter.cycleValue('name', 'Alice')
      result.current.pagination.setPage(1)
    })
    expect(result.current.getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
      filters: { name: ['Alice'] },
    })
  })

  it('getViewState/setViewState round-trip an exclude filter', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.filter.cycleValue('name', 'Alice')
      result.current.filter.cycleValue('name', 'Alice') // include -> exclude
    })
    const view = result.current.getViewState()
    expect(view.excludeFilters).toEqual({ name: ['Alice'] })

    act(() => {
      result.current.setViewState({})
    })
    expect(result.current.filter.exclude['name']?.size ?? 0).toBe(0)

    act(() => {
      result.current.setViewState(view)
    })
    expect(result.current.filter.exclude['name']?.has('Alice')).toBe(true)
  })

  it('setViewState applies a snapshot and getViewState round-trips it', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    const view = {
      sorts: [{ key: 'score', dir: 'desc' as const }],
      groupBy: ['name'],
      searchQuery: 'a',
    }
    act(() => {
      result.current.setViewState(view)
    })
    expect(result.current.sort.entries).toEqual(view.sorts)
    expect(result.current.group.by).toEqual(view.groupBy)
    expect(result.current.search.query).toBe('a')
    expect(result.current.getViewState()).toEqual(view)
  })

  it('setViewState resets fields absent from the given view', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.sort.toggle('score')
      result.current.search.setQuery('a')
    })
    act(() => {
      result.current.setViewState({ groupBy: ['name'] })
    })
    expect(result.current.sort.entries).toEqual([])
    expect(result.current.search.query).toBe('')
    expect(result.current.group.by).toEqual(['name'])
  })

  it('setViewState falls back to default visible columns when given stale keys', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setViewState({ visibleCols: ['nonexistent'] })
    })
    expect(result.current.columns.active.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('getViewState captures columnOrder and setViewState round-trips it', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.columns.move('score', 'id')
    })
    const view = result.current.getViewState()
    expect(view.columnOrder).toEqual(['score', 'id', 'name'])
    act(() => {
      result.current.setViewState({})
    })
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['id', 'name', 'score'])
    act(() => {
      result.current.setViewState(view)
    })
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })

  it('setViewState drops stale keys from columnOrder', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setViewState({ columnOrder: ['score', 'ghost', 'id', 'name'] })
    })
    expect(result.current.columns.ordered.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })
})
