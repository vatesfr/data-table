import { describe, it, expect } from 'vitest'
import { ref, shallowRef, nextTick } from 'vue'
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
    const table = useTableState(ROWS, COLS)
    const { processedData } = table
    const { rows: selectedRows } = table.selection
    expect(processedData.value).toEqual(ROWS)
    expect(selectedRows.value).toEqual([])
  })

  it('defaults to all columns visible', () => {
    const table = useTableState(ROWS, COLS)
    const { active: activeColumns } = table.columns
    expect(activeColumns.value).toHaveLength(3)
  })

  it('respects defaultVisibleColumns option', () => {
    const table = useTableState(ROWS, COLS, { defaultVisibleColumns: ['id', 'name'] })
    const { active: activeColumns } = table.columns
    expect(activeColumns.value.map((c) => c.key)).toEqual(['id', 'name'])
  })

  it('defaults pageSize to 0 (no pagination, all rows on one page)', () => {
    const table = useTableState(ROWS, COLS)
    const { pagedData } = table
    expect(pagedData.value).toHaveLength(4)
  })

  it('respects defaultPageSize option', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { pagedData } = table
    const { numPages } = table.pagination
    expect(pagedData.value).toHaveLength(2)
    expect(numPages.value).toBe(2)
  })
})

describe('useTableState — row selection', () => {
  it('toggleRowSelection adds and removes by object identity', () => {
    const table = useTableState(ROWS, COLS)
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0])
    expect(selectedRows.value).toEqual([ROWS[0]])
    toggleRowSelection(ROWS[0])
    expect(selectedRows.value).toEqual([])
  })

  it('selectedRows only reflects rows present in processedData', () => {
    const table = useTableState(ROWS, COLS)
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    const { cycleValue: cycleFilterValue, clear: clearFilters } = table.filter
    toggleRowSelection(ROWS[0]) // Alice
    toggleRowSelection(ROWS[1]) // Bob
    // Filter down to Alice only — Bob disappears from selectedRows but stays in selection
    cycleFilterValue('name', 'Alice')
    expect(selectedRows.value).toEqual([ROWS[0]])
    // Clearing the filter brings Bob back into selectedRows
    clearFilters()
    expect(selectedRows.value).toEqual([ROWS[0], ROWS[1]])
  })

  it('toggleSelectAll selects all when none are selected', () => {
    const table = useTableState(ROWS, COLS)
    const { rows: selectedRows, toggleAll: toggleSelectAll } = table.selection
    toggleSelectAll(ROWS)
    expect(selectedRows.value).toHaveLength(4)
  })

  it('toggleSelectAll deselects all when all are selected', () => {
    const table = useTableState(ROWS, COLS)
    const { rows: selectedRows, toggleAll: toggleSelectAll } = table.selection
    toggleSelectAll(ROWS)
    toggleSelectAll(ROWS)
    expect(selectedRows.value).toEqual([])
  })

  it('toggleSelectAll deselects all when only some are selected (partial)', () => {
    const table = useTableState(ROWS, COLS)
    const {
      rows: selectedRows,
      toggle: toggleRowSelection,
      toggleAll: toggleSelectAll,
    } = table.selection
    toggleRowSelection(ROWS[0])
    toggleSelectAll(ROWS)
    expect(selectedRows.value).toHaveLength(0)
  })

  it('toggleSelectAll with empty array is a no-op', () => {
    const table = useTableState(ROWS, COLS)
    const {
      rows: selectedRows,
      toggle: toggleRowSelection,
      toggleAll: toggleSelectAll,
    } = table.selection
    toggleRowSelection(ROWS[0])
    toggleSelectAll([])
    expect(selectedRows.value).toHaveLength(1)
  })

  it('clearSelection empties the selection', () => {
    const table = useTableState(ROWS, COLS)
    const {
      rows: selectedRows,
      toggleAll: toggleSelectAll,
      clear: clearSelection,
    } = table.selection
    toggleSelectAll(ROWS)
    clearSelection()
    expect(selectedRows.value).toEqual([])
  })

  it('shift-click toggleRowSelection selects the range between the last click and the target', () => {
    const table = useTableState(ROWS, COLS)
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0]) // anchor = Alice
    toggleRowSelection(ROWS[2], true) // shift-click Clara
    expect(selectedRows.value).toEqual([ROWS[0], ROWS[1], ROWS[2]])
  })

  it('shift-click deselects the range when the clicked row is already selected', () => {
    const table = useTableState(ROWS, COLS)
    const {
      rows: selectedRows,
      toggle: toggleRowSelection,
      toggleAll: toggleSelectAll,
    } = table.selection
    toggleSelectAll(ROWS) // all four selected
    toggleRowSelection(ROWS[0]) // anchor = Alice, now deselected
    toggleRowSelection(ROWS[0]) // re-select Alice, anchor stays Alice
    toggleRowSelection(ROWS[2], true) // shift-click already-selected Clara
    // Clara was selected, so the whole range [Alice, Bob, Clara] gets deselected; David stays.
    expect(selectedRows.value).toEqual([ROWS[3]])
  })

  it('shift-click with no prior anchor falls back to a plain toggle', () => {
    const table = useTableState(ROWS, COLS)
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[2], true)
    expect(selectedRows.value).toEqual([ROWS[2]])
  })
})

describe('useTableState — getRowId (selection identity)', () => {
  it('without getRowId, a refetch (new row objects) silently drops selection', () => {
    const data = shallowRef(ROWS)
    const table = useTableState(data, COLS)
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0])
    expect(selectedRows.value).toEqual([ROWS[0]])
    data.value = ROWS.map((r) => ({ ...r }))
    expect(selectedRows.value).toEqual([])
  })

  it('with getRowId, selection survives a refetch that produces new row objects', () => {
    const data = shallowRef(ROWS)
    const table = useTableState(data, COLS, {
      getRowId: (r) => r.id,
    })
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0]) // Alice, id 1
    const refetched = ROWS.map((r) => ({ ...r }))
    data.value = refetched
    expect(selectedRows.value).toEqual([refetched[0]])
  })

  it('with getRowId, a row no longer present after the refetch is dropped from selection', () => {
    const data = shallowRef(ROWS)
    const table = useTableState(data, COLS, {
      getRowId: (r) => r.id,
    })
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0]) // Alice, id 1
    data.value = ROWS.slice(1).map((r) => ({ ...r }))
    expect(selectedRows.value).toEqual([])
  })

  it('with getRowId, toggleRowSelection on a fresh-object row with a selected id deselects it', () => {
    const data = shallowRef(ROWS)
    const table = useTableState(data, COLS, {
      getRowId: (r) => r.id,
    })
    const { rows: selectedRows, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0]) // Alice, id 1
    const refetched = ROWS.map((r) => ({ ...r }))
    data.value = refetched
    toggleRowSelection(refetched[0]) // same id, different reference
    expect(selectedRows.value).toEqual([])
  })

  it('with getRowId, the raw selection Set is reconciled to the fresh reference after a tick', async () => {
    const data = shallowRef(ROWS)
    const table = useTableState(data, COLS, { getRowId: (r) => r.id })
    const { all: selection, toggle: toggleRowSelection } = table.selection
    toggleRowSelection(ROWS[0]) // Alice, id 1
    const refetched = ROWS.map((r) => ({ ...r }))
    data.value = refetched
    await nextTick()
    expect([...selection.value]).toEqual([refetched[0]])
  })
})

describe('useTableState — column visibility', () => {
  it('toggleColVisibility hides a column', () => {
    const table = useTableState(ROWS, COLS)
    const { active: activeColumns, toggleVisibility: toggleColVisibility } = table.columns
    toggleColVisibility('name')
    expect(activeColumns.value.map((c) => c.key)).not.toContain('name')
  })

  it('toggleColVisibility shows a hidden column', () => {
    const table = useTableState(ROWS, COLS, {
      defaultVisibleColumns: ['id'],
    })
    const { active: activeColumns, toggleVisibility: toggleColVisibility } = table.columns
    toggleColVisibility('name')
    expect(activeColumns.value.map((c) => c.key)).toContain('name')
  })

  it('cannot hide the last visible column', () => {
    const table = useTableState(ROWS, COLS, {
      defaultVisibleColumns: ['id'],
    })
    const { active: activeColumns, toggleVisibility: toggleColVisibility } = table.columns
    toggleColVisibility('id')
    expect(activeColumns.value.map((c) => c.key)).toContain('id')
  })

  it('a columns ref swapped to a fully disjoint key set keeps every new column visible, instead of filtering all of them out', async () => {
    const columns = ref<ColumnDef<Row>[]>(COLS)
    const table = useTableState(ROWS, columns)
    const { active: activeColumns } = table.columns
    expect(activeColumns.value).toHaveLength(3)
    columns.value = [
      { key: 'sku', label: 'SKU' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ]
    await nextTick()
    expect(activeColumns.value.map((c) => c.key)).toEqual(['sku', 'qty'])
  })

  it("a columns ref change preserves an existing column's hidden state and defaults a genuinely new column to visible", async () => {
    const columns = ref<ColumnDef<Row>[]>(COLS)
    const table = useTableState(ROWS, columns)
    const { active: activeColumns, toggleVisibility: toggleColVisibility } = table.columns
    toggleColVisibility('score') // hide it
    columns.value = [...COLS, { key: 'extra', label: 'Extra' }]
    await nextTick()
    expect(activeColumns.value.map((c) => c.key)).toEqual(['id', 'name', 'extra'])
  })
})

describe('useTableState — column ordering', () => {
  it('defaults to natural column order', () => {
    const table = useTableState(ROWS, COLS)
    const { ordered: orderedColumns } = table.columns
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('moveColumn reorders by drag-and-drop semantics (insert before target)', () => {
    const table = useTableState(ROWS, COLS)
    const { ordered: orderedColumns, active: activeColumns, move: moveColumn } = table.columns
    moveColumn('score', 'id')
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['score', 'id', 'name'])
    expect(activeColumns.value.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })

  it('moveColumnBy swaps with the neighbor in the given direction', () => {
    const table = useTableState(ROWS, COLS)
    const { ordered: orderedColumns, moveBy: moveColumnBy } = table.columns
    moveColumnBy('id', 1)
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['name', 'id', 'score'])
  })

  it('moveColumnBy is a no-op past the boundary', () => {
    const table = useTableState(ROWS, COLS)
    const { ordered: orderedColumns, moveBy: moveColumnBy } = table.columns
    moveColumnBy('id', -1)
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('preserves order across visibility toggles', () => {
    const table = useTableState(ROWS, COLS)
    const {
      active: activeColumns,
      move: moveColumn,
      toggleVisibility: toggleColVisibility,
    } = table.columns
    moveColumn('score', 'id')
    toggleColVisibility('name')
    expect(activeColumns.value.map((c) => c.key)).toEqual(['score', 'id'])
    toggleColVisibility('name')
    expect(activeColumns.value.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — sort remove/direction/reorder', () => {
  it('removeSort clears a sort entry without cycling through direction', () => {
    const table = useTableState(ROWS, COLS)
    const { entries: sorts, toggle: toggleSort, remove: removeSort } = table.sort
    toggleSort('score')
    expect(sorts.value).toEqual([{ key: 'score', dir: 'asc' }])
    removeSort('score')
    expect(sorts.value).toEqual([])
  })

  it("toggleSort cycles from a column's defaultSortDir instead of asc", () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', defaultSortDir: 'desc' }]
    const table = useTableState(ROWS, cols)
    const { entries: sorts, toggle: toggleSort } = table.sort
    toggleSort('score')
    expect(sorts.value).toEqual([{ key: 'score', dir: 'desc' }])
    toggleSort('score')
    expect(sorts.value).toEqual([{ key: 'score', dir: 'asc' }])
    toggleSort('score')
    expect(sorts.value).toEqual([])
  })

  it("replaceSort (header click) starts at a column's defaultSortDir", () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', defaultSortDir: 'desc' }]
    const table = useTableState(ROWS, cols)
    const { entries: sorts, replace: replaceSort } = table.sort
    replaceSort('score')
    expect(sorts.value).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it("appendOrToggleSort (shift-click) starts at a column's defaultSortDir", () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', defaultSortDir: 'desc' }]
    const table = useTableState(ROWS, cols)
    const { entries: sorts, appendOrToggle: appendOrToggleSort } = table.sort
    appendOrToggleSort('score')
    expect(sorts.value).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('toggleSortDir flips an existing entry in place without reordering', () => {
    const table = useTableState(ROWS, COLS)
    const { entries: sorts, toggle: toggleSort, toggleDir: toggleSortDir } = table.sort
    toggleSort('name')
    toggleSort('score')
    toggleSortDir('name')
    expect(sorts.value).toEqual([
      { key: 'name', dir: 'desc' },
      { key: 'score', dir: 'asc' },
    ])
  })

  it('moveSortBy reorders priority by swapping with a neighbor', () => {
    const table = useTableState(ROWS, COLS)
    const { entries: sorts, toggle: toggleSort, moveBy: moveSortBy } = table.sort
    toggleSort('name')
    toggleSort('score')
    moveSortBy('score', -1)
    expect(sorts.value.map((s) => s.key)).toEqual(['score', 'name'])
  })

  it('moveSort reorders by drag-and-drop semantics (insert before target)', () => {
    const table = useTableState(ROWS, COLS)
    const { entries: sorts, toggle: toggleSort, move: moveSort } = table.sort
    toggleSort('id')
    toggleSort('name')
    toggleSort('score')
    moveSort('score', 'id')
    expect(sorts.value.map((s) => s.key)).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — group remove/reorder', () => {
  const GROUPABLE_COLS: ColumnDef<Row>[] = [
    { key: 'id', label: 'ID', groupable: true },
    { key: 'name', label: 'Name', groupable: true },
    { key: 'score', label: 'Score', groupable: true },
  ]

  it('removeGroup clears a group entry', () => {
    const table = useTableState(ROWS, GROUPABLE_COLS)
    const { by: groupBy, toggle: toggleGroup, remove: removeGroup } = table.group
    toggleGroup('name')
    expect(groupBy.value).toEqual(['name'])
    removeGroup('name')
    expect(groupBy.value).toEqual([])
  })

  it('moveGroupBy reorders priority by swapping with a neighbor', () => {
    const table = useTableState(ROWS, GROUPABLE_COLS)
    const { by: groupBy, toggle: toggleGroup, moveBy: moveGroupBy } = table.group
    toggleGroup('name')
    toggleGroup('score')
    moveGroupBy('score', -1)
    expect(groupBy.value).toEqual(['score', 'name'])
  })

  it('moveGroup reorders by drag-and-drop semantics (insert before target)', () => {
    const table = useTableState(ROWS, GROUPABLE_COLS)
    const { by: groupBy, toggle: toggleGroup, move: moveGroup } = table.group
    toggleGroup('id')
    toggleGroup('name')
    toggleGroup('score')
    moveGroup('score', 'id')
    expect(groupBy.value).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — keepVisibleWhenGrouped', () => {
  const COLS_WITH_KEEP: ColumnDef<Row>[] = [
    { key: 'id', label: 'ID', groupable: true },
    { key: 'name', label: 'Name', groupable: true, keepVisibleWhenGrouped: true },
    { key: 'score', label: 'Score', groupable: true },
  ]

  it('still hides a grouped column by default', () => {
    const table = useTableState(ROWS, COLS_WITH_KEEP)
    const { active: activeColumns } = table.columns
    table.group.toggle('score')
    expect(activeColumns.value.map((c) => c.key)).not.toContain('score')
  })

  it('keeps a grouped column in activeColumns when keepVisibleWhenGrouped is set', () => {
    const table = useTableState(ROWS, COLS_WITH_KEEP)
    const { active: activeColumns } = table.columns
    table.group.toggle('name')
    expect(activeColumns.value.map((c) => c.key)).toContain('name')
  })

  it('column reappears in activeColumns once ungrouped either way', () => {
    const table = useTableState(ROWS, COLS_WITH_KEEP)
    const { active: activeColumns } = table.columns
    table.group.toggle('name')
    table.group.remove('name')
    expect(activeColumns.value.map((c) => c.key)).toContain('name')
  })
})

describe('useTableState — pagination', () => {
  it('setPage navigates between pages', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { pagedData } = table
    const { page, setPage } = table.pagination
    setPage(2)
    expect(page.value).toBe(2)
    expect(pagedData.value).toEqual([ROWS[2], ROWS[3]])
  })

  it('setPage clamps to numPages', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    setPage(100)
    expect(page.value).toBe(2)
  })

  it('setPage clamps to 1 at minimum', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    setPage(-5)
    expect(page.value).toBe(1)
  })

  it('setPageSize resets page to 1', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage, setPageSize } = table.pagination
    setPage(2)
    setPageSize(3)
    expect(page.value).toBe(1)
  })

  it('page self-clamps when numPages shrinks without an explicit setPage call', () => {
    // e.g. a group being collapsed, or (as reproduced here) data shrinking — nothing calls
    // setPage, so pagination.page must reflect the new, smaller numPages on its own rather
    // than reporting a stale out-of-range page number.
    const data = shallowRef(ROWS)
    const table = useTableState(data, COLS, { defaultPageSize: 2 })
    const { page, numPages, setPage } = table.pagination
    setPage(2)
    expect(page.value).toBe(2)
    data.value = ROWS.slice(0, 2)
    expect(numPages.value).toBe(1)
    expect(page.value).toBe(1)
  })

  it('setPage ignores NaN instead of corrupting page state', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    setPage(2)
    setPage(NaN)
    expect(page.value).toBe(2)
  })

  it('setPageSize ignores NaN instead of breaking pagination', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { pageSize, numPages, setPageSize } = table.pagination
    setPageSize(NaN)
    expect(pageSize.value).toBe(2)
    expect(numPages.value).toBe(2)
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
    const table = useTableState(DEPT_ROWS, DEPT_COLS, {
      defaultPageSize: 2,
      defaultGroupsCollapsed: false,
    })
    const { numPages } = table.pagination
    const { toggle: toggleGroup } = table.group
    toggleGroup('dept')
    // 2 headers + 4 rows = 6 visible items, pageSize 2 => 3 pages (not 2, as pure data pagination would give)
    expect(numPages.value).toBe(3)
  })

  it("splits an expanded group's rows across a page boundary and repeats its header as a continued chunk", () => {
    const table = useTableState(DEPT_ROWS, DEPT_COLS, {
      defaultPageSize: 2,
      defaultGroupsCollapsed: false,
    })
    const { groupedData } = table
    const { toggle: toggleGroup } = table.group
    const { setPage } = table.pagination
    toggleGroup('dept')
    expect(groupedData.value).toEqual([
      {
        key: 'Eng',
        keyParts: ['Eng'],
        rows: [DEPT_ROWS[0]],
        continued: false,
        sampleRow: DEPT_ROWS[0],
      },
    ])
    setPage(2)
    expect(groupedData.value).toEqual([
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
    // defaultGroupsCollapsed defaults to true
    const table = useTableState(DEPT_ROWS, DEPT_COLS, {
      defaultPageSize: 2,
    })
    const { groupedData } = table
    const { numPages } = table.pagination
    const { toggle: toggleGroup } = table.group
    toggleGroup('dept')
    // Both groups collapsed => visible items are just the 2 headers, all fitting on page 1
    expect(numPages.value).toBe(1)
    expect(groupedData.value.find((g) => g.key === 'Eng')?.rows).toEqual([
      DEPT_ROWS[0],
      DEPT_ROWS[1],
    ])
  })

  it('pagedData reflects the data rows actually visible on the page, not a flat pageSize slice', () => {
    const table = useTableState(DEPT_ROWS, DEPT_COLS, {
      defaultPageSize: 2,
      defaultGroupsCollapsed: false,
    })
    const { pagedData } = table
    const { toggle: toggleGroup } = table.group
    toggleGroup('dept')
    // page 1 budget: 1 header + 1 data row = 2 items, so only Alice is a *data* row here
    expect(pagedData.value).toEqual([DEPT_ROWS[0]])
  })
})

describe('useTableState — filters reset page', () => {
  it('cycleFilterValue resets page to 1', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    const { cycleValue: cycleFilterValue } = table.filter
    setPage(2)
    cycleFilterValue('name', 'Alice')
    expect(page.value).toBe(1)
  })

  it('setRangeFilter resets page to 1', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    const { setRange: setRangeFilter } = table.filter
    setPage(2)
    setRangeFilter('score', 'min', '70')
    expect(page.value).toBe(1)
  })

  it('clearFilters resets page to 1', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    const { clear: clearFilters } = table.filter
    setPage(2)
    clearFilters()
    expect(page.value).toBe(1)
  })

  it('toggleFilterAll resets page to 1', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    const { toggleAll: toggleFilterAll } = table.filter
    setPage(2)
    toggleFilterAll('name', ['Alice', 'Bob'])
    expect(page.value).toBe(1)
  })
})

describe('useTableState — toggleFilterAll', () => {
  it('selects all given values when none are selected', () => {
    const table = useTableState(ROWS, COLS)
    const { include: filters, toggleAll: toggleFilterAll } = table.filter
    toggleFilterAll('name', ['Alice', 'Bob'])
    expect(filters.value['name']?.has('Alice')).toBe(true)
    expect(filters.value['name']?.has('Bob')).toBe(true)
  })

  it('deselects all given values when all are already selected', () => {
    const table = useTableState(ROWS, COLS)
    const { include: filters, toggleAll: toggleFilterAll } = table.filter
    toggleFilterAll('name', ['Alice', 'Bob'])
    toggleFilterAll('name', ['Alice', 'Bob'])
    expect(filters.value['name']?.size ?? 0).toBe(0)
  })

  it('only affects the given values, leaving other selections for the same key untouched', () => {
    const table = useTableState(ROWS, COLS)
    const {
      include: filters,
      cycleValue: cycleFilterValue,
      toggleAll: toggleFilterAll,
    } = table.filter
    cycleFilterValue('name', 'Clara')
    toggleFilterAll('name', ['Alice', 'Bob'])
    expect(filters.value['name']?.has('Clara')).toBe(true)
    expect(filters.value['name']?.has('Alice')).toBe(true)
    expect(filters.value['name']?.has('Bob')).toBe(true)
  })
})

describe('useTableState — cycleFilterValue (exclude filters)', () => {
  it('cycles a value neutral -> include -> exclude -> neutral', () => {
    const table = useTableState(ROWS, COLS)
    const { processedData } = table
    const { include: filters, exclude: excludeFilters, cycleValue: cycleFilterValue } = table.filter

    cycleFilterValue('name', 'Alice')
    expect(filters.value['name']?.has('Alice')).toBe(true)
    expect(excludeFilters.value['name']?.has('Alice') ?? false).toBe(false)

    cycleFilterValue('name', 'Alice')
    expect(filters.value['name']?.has('Alice')).toBe(false)
    expect(excludeFilters.value['name']?.has('Alice')).toBe(true)
    expect(processedData.value.map((r) => r.name)).not.toContain('Alice')

    cycleFilterValue('name', 'Alice')
    expect(filters.value['name']?.has('Alice') ?? false).toBe(false)
    expect(excludeFilters.value['name']?.has('Alice') ?? false).toBe(false)
    expect(processedData.value).toHaveLength(4)
  })

  it('activeFilterCount counts a column with an active exclude filter', () => {
    const table = useTableState(ROWS, COLS)
    const { activeCount: activeFilterCount, cycleValue: cycleFilterValue } = table.filter
    cycleFilterValue('name', 'Alice')
    cycleFilterValue('name', 'Alice') // include -> exclude
    expect(activeFilterCount.value).toBe(1)
  })
})

describe('useTableState — toggleFilterAll and exclude filters', () => {
  it("select-all's ON branch clears an existing exclusion on a listed value", () => {
    const table = useTableState(ROWS, COLS)
    const {
      include: filters,
      exclude: excludeFilters,
      cycleValue: cycleFilterValue,
      toggleAll: toggleFilterAll,
    } = table.filter
    cycleFilterValue('name', 'Alice')
    cycleFilterValue('name', 'Alice') // include -> exclude
    toggleFilterAll('name', ['Alice', 'Bob'])
    expect(filters.value['name']?.has('Alice')).toBe(true)
    expect(excludeFilters.value['name']?.has('Alice') ?? false).toBe(false)
  })

  it("select-all's deselect branch leaves an unrelated exclusion untouched", () => {
    const table = useTableState(ROWS, COLS)
    const {
      include: filters,
      exclude: excludeFilters,
      cycleValue: cycleFilterValue,
      toggleAll: toggleFilterAll,
    } = table.filter
    cycleFilterValue('name', 'Bob') // include Bob
    cycleFilterValue('name', 'Alice')
    cycleFilterValue('name', 'Alice') // include -> exclude Alice
    // 'Bob' is included (so this is the deselect branch); 'Alice' is excluded, not included.
    toggleFilterAll('name', ['Bob'])
    expect(filters.value['name']?.has('Bob')).toBe(false)
    expect(excludeFilters.value['name']?.has('Alice')).toBe(true)
  })
})

describe('useTableState — clearColumnFilter kinds', () => {
  it('clearing the include kind leaves an exclude filter on the same column untouched', () => {
    const table = useTableState(ROWS, COLS)
    const {
      include: filters,
      exclude: excludeFilters,
      cycleValue: cycleFilterValue,
      clearColumn: clearColumnFilter,
    } = table.filter
    cycleFilterValue('name', 'Bob')
    cycleFilterValue('name', 'Alice')
    cycleFilterValue('name', 'Alice') // include -> exclude
    clearColumnFilter('name', 'include')
    expect(filters.value['name']?.size ?? 0).toBe(0)
    expect(excludeFilters.value['name']?.has('Alice')).toBe(true)
  })

  it('clearing the exclude kind leaves an include filter on the same column untouched', () => {
    const table = useTableState(ROWS, COLS)
    const {
      include: filters,
      exclude: excludeFilters,
      cycleValue: cycleFilterValue,
      clearColumn: clearColumnFilter,
    } = table.filter
    cycleFilterValue('name', 'Bob')
    cycleFilterValue('name', 'Alice')
    cycleFilterValue('name', 'Alice') // include -> exclude
    clearColumnFilter('name', 'exclude')
    expect(excludeFilters.value['name']?.size ?? 0).toBe(0)
    expect(filters.value['name']?.has('Bob')).toBe(true)
  })
})

describe('useTableState — setFilterValues', () => {
  it('adds the given values unconditionally when selected is true', () => {
    const table = useTableState(ROWS, COLS)
    const { include: filters, setValues: setFilterValues } = table.filter
    setFilterValues('name', ['Alice', 'Bob'], true)
    expect(filters.value['name']?.has('Alice')).toBe(true)
    expect(filters.value['name']?.has('Bob')).toBe(true)
  })

  it('removes the given values unconditionally when selected is false', () => {
    const table = useTableState(ROWS, COLS)
    const { include: filters, setValues: setFilterValues } = table.filter
    setFilterValues('name', ['Alice', 'Bob', 'Clara'], true)
    setFilterValues('name', ['Alice', 'Bob'], false)
    expect(filters.value['name']?.has('Alice')).toBe(false)
    expect(filters.value['name']?.has('Bob')).toBe(false)
    expect(filters.value['name']?.has('Clara')).toBe(true)
  })
})

describe('useTableState — search', () => {
  it('defaults searchQuery to empty string', () => {
    const table = useTableState(ROWS, COLS)
    const { query: searchQuery } = table.search
    expect(searchQuery.value).toBe('')
  })

  it('setSearchQuery filters processedData', () => {
    const table = useTableState(ROWS, COLS)
    const { processedData } = table
    const { setQuery: setSearchQuery } = table.search
    setSearchQuery('ali')
    expect(processedData.value.map((r) => r.name)).toEqual(['Alice'])
  })

  it('setSearchQuery resets page to 1', () => {
    const table = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    const { page, setPage } = table.pagination
    const { setQuery: setSearchQuery } = table.search
    setPage(2)
    setSearchQuery('a')
    expect(page.value).toBe(1)
  })

  it('clearAll resets searchQuery', () => {
    const table = useTableState(ROWS, COLS)
    const { processedData, clearAll } = table
    const { query: searchQuery, setQuery: setSearchQuery } = table.search
    setSearchQuery('alice')
    clearAll()
    expect(searchQuery.value).toBe('')
    expect(processedData.value).toHaveLength(4)
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
    const table = useTableState(GAMES, GAME_COLS)
    const { valueMap: stringValueMap } = table.filter
    expect(stringValueMap.value['tags']).toEqual(['Action', 'Adventure', 'RPG'])
  })

  // stringValueCounts (facet counts) moved out of useTableState into DataTableView.vue — see
  // DataTable.test.ts's filter-dropdown coverage for the rendered counts, and packages/core's
  // logic.test.ts for the underlying computeStringValueCounts faceting logic.

  it('cycleFilterValue matches rows whose array contains the selected value', () => {
    const table = useTableState(GAMES, GAME_COLS)
    const { processedData } = table
    const { cycleValue: cycleFilterValue } = table.filter
    cycleFilterValue('tags', 'RPG')
    expect(processedData.value.map((g) => g.name)).toEqual(['Game A'])
  })

  it('groupedData fans a row into one group per array item', () => {
    const table = useTableState(GAMES, GAME_COLS)
    const { groupedData } = table
    const { toggle: toggleGroup } = table.group
    toggleGroup('tags')
    expect(groupedData.value.map((g) => g.key).sort()).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('stringValueMap lists a "(none)" entry for rows with an empty array', () => {
    const table = useTableState(GAMES_WITH_EMPTY, GAME_COLS)
    const { valueMap: stringValueMap } = table.filter
    expect(stringValueMap.value['tags']).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('groupedData buckets rows with an empty array under "(none)"', () => {
    const table = useTableState(GAMES_WITH_EMPTY, GAME_COLS)
    const { groupedData } = table
    const { toggle: toggleGroup } = table.group
    toggleGroup('tags')
    const noneGroup = groupedData.value.find((g) => g.key === '(none)')
    expect(noneGroup?.rows.map((r) => r.name)).toEqual(['Game C'])
  })

  it('uses a custom emptyValue label when provided', () => {
    const table = useTableState(GAMES_WITH_EMPTY, GAME_COLS, { labels: { emptyValue: 'N/A' } })
    const { groupedData } = table
    const { valueMap: stringValueMap } = table.filter
    const { toggle: toggleGroup } = table.group
    expect(stringValueMap.value['tags']).toContain('N/A')
    toggleGroup('tags')
    expect(groupedData.value.map((g) => g.key)).toContain('N/A')
  })
})

describe('useTableState — filter.setMode (any/all match)', () => {
  const THREE_GAMES: Game[] = [...GAMES, { id: 3, name: 'Game C', tags: ['RPG'] }]

  it('defaults to "or" (union) semantics with no override', () => {
    const table = useTableState(THREE_GAMES, GAME_COLS)
    table.filter.setValues('tags', ['Action', 'RPG'], true)
    expect(table.processedData.value.map((g) => g.name)).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('setMode sets a column directly to "and" (intersection) semantics', () => {
    const table = useTableState(THREE_GAMES, GAME_COLS)
    table.filter.setValues('tags', ['Action', 'RPG'], true)
    table.filter.setMode('tags', 'and')
    expect(table.filter.modes.value['tags']).toBe('and')
    expect(table.processedData.value.map((g) => g.name)).toEqual(['Game A'])
    table.filter.setMode('tags', 'or')
    expect(table.filter.modes.value['tags']).toBe('or')
    expect(table.processedData.value.map((g) => g.name)).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it("overrides the column's own multiMode default", () => {
    const cols: ColumnDef<Game>[] = [
      { key: 'name', label: 'Name' },
      { key: 'tags', label: 'Tags', filterable: true, multiMode: 'and' },
    ]
    const table = useTableState(THREE_GAMES, cols)
    table.filter.setValues('tags', ['Action', 'RPG'], true)
    expect(table.processedData.value.map((g) => g.name)).toEqual(['Game A'])
    table.filter.setMode('tags', 'or')
    expect(table.processedData.value.map((g) => g.name)).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('filter.clear() and clearAll() reset any overridden modes', () => {
    const table = useTableState(THREE_GAMES, GAME_COLS)
    table.filter.setMode('tags', 'and')
    table.filter.clear()
    expect(table.filter.modes.value).toEqual({})

    table.filter.setMode('tags', 'and')
    table.clearAll()
    expect(table.filter.modes.value).toEqual({})
  })

  it('round-trips an overridden filter mode via getViewState/setViewState', () => {
    const table = useTableState(THREE_GAMES, GAME_COLS)
    table.filter.setMode('tags', 'and')
    const view = table.getViewState()
    expect(view.filterModes).toEqual({ tags: 'and' })

    const table2 = useTableState(THREE_GAMES, GAME_COLS)
    table2.setViewState(view)
    expect(table2.filter.modes.value).toEqual({ tags: 'and' })
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
    const table = useTableState(ROWS, COMPUTED_COLS)
    const { processedData } = table
    const { toggle: toggleSort } = table.sort
    toggleSort('grade')
    expect(processedData.value.map((r) => r.name)).toEqual(['Alice', 'Clara', 'Bob', 'David'])
  })

  it('groups by a computed column value', () => {
    const table = useTableState(ROWS, COMPUTED_COLS)
    const { groupedData } = table
    const { toggle: toggleGroup } = table.group
    toggleGroup('grade')
    expect(groupedData.value.find((g) => g.key === 'A')?.rows.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
    ])
    expect(groupedData.value.find((g) => g.key === 'B')?.rows.map((r) => r.name)).toEqual([
      'Bob',
      'David',
    ])
  })
})

describe('useTableState — view state', () => {
  it('getViewState omits fields still at their default', () => {
    const table = useTableState(ROWS, COLS)
    const { getViewState } = table
    expect(getViewState()).toEqual({})
  })

  it('getViewState captures changes made through actions', () => {
    const table = useTableState(ROWS, COLS)
    const { getViewState } = table
    const { toggle: toggleSort } = table.sort
    const { cycleValue: cycleFilterValue } = table.filter
    const { setPage } = table.pagination
    toggleSort('score')
    cycleFilterValue('name', 'Alice')
    setPage(1)
    expect(getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
      filters: { name: ['Alice'] },
    })
  })

  it('getViewState/setViewState round-trip an exclude filter', () => {
    const table = useTableState(ROWS, COLS)
    const { getViewState, setViewState } = table
    const { exclude: excludeFilters, cycleValue: cycleFilterValue } = table.filter
    cycleFilterValue('name', 'Alice')
    cycleFilterValue('name', 'Alice') // include -> exclude
    const view = getViewState()
    expect(view.excludeFilters).toEqual({ name: ['Alice'] })

    setViewState({})
    expect(excludeFilters.value['name']?.size ?? 0).toBe(0)

    setViewState(view)
    expect(excludeFilters.value['name']?.has('Alice')).toBe(true)
  })

  it('setViewState applies a snapshot and getViewState round-trips it', () => {
    const table = useTableState(ROWS, COLS)
    const { getViewState, setViewState } = table
    const { entries: sorts } = table.sort
    const { by: groupBy } = table.group
    const { query: searchQuery } = table.search
    const view = {
      sorts: [{ key: 'score', dir: 'desc' as const }],
      groupBy: ['name'],
      searchQuery: 'a',
    }
    setViewState(view)
    expect(sorts.value).toEqual(view.sorts)
    expect(groupBy.value).toEqual(view.groupBy)
    expect(searchQuery.value).toBe('a')
    expect(getViewState()).toEqual(view)
  })

  it('setViewState resets fields absent from the given view', () => {
    const table = useTableState(ROWS, COLS)
    const { setViewState } = table
    const { toggle: toggleSort, entries: sorts } = table.sort
    const { setQuery: setSearchQuery, query: searchQuery } = table.search
    const { by: groupBy } = table.group
    toggleSort('score')
    setSearchQuery('a')
    setViewState({ groupBy: ['name'] })
    expect(sorts.value).toEqual([])
    expect(searchQuery.value).toBe('')
    expect(groupBy.value).toEqual(['name'])
  })

  it('setViewState falls back to default visible columns when given stale keys', () => {
    const table = useTableState(ROWS, COLS)
    const { setViewState } = table
    const { active: activeColumns } = table.columns
    setViewState({ visibleCols: ['nonexistent'] })
    expect(activeColumns.value.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('getViewState captures columnOrder and setViewState round-trips it', () => {
    const table = useTableState(ROWS, COLS)
    const { getViewState, setViewState } = table
    const { move: moveColumn, ordered: orderedColumns } = table.columns
    moveColumn('score', 'id')
    const view = getViewState()
    expect(view.columnOrder).toEqual(['score', 'id', 'name'])
    setViewState({})
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['id', 'name', 'score'])
    setViewState(view)
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })

  it('setViewState drops stale keys from columnOrder', () => {
    const table = useTableState(ROWS, COLS)
    const { setViewState } = table
    const { ordered: orderedColumns } = table.columns
    setViewState({ columnOrder: ['score', 'ghost', 'id', 'name'] })
    expect(orderedColumns.value.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })
})
