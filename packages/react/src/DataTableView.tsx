import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  computeAggregate,
  getColumnValue,
  filterValuesBySearch,
  filterValuesByCount,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  findDateTreeNode,
  selectDateRange,
  selectRange,
  getVisibleRows,
  type DateTreeNode,
  type ValueSort,
} from '@vates/data-table-core'
import { Dropdown } from './components/Dropdown'
import { ToolbarBtn } from './components/ToolbarBtn'
import type { ColumnDef, DataTableViewProps } from './types'

const S = {
  wrap: {
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 0',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    flexWrap: 'wrap',
  } as CSSProperties,
  stats: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  } as CSSProperties,
  tableWrap: {
    overflowX: 'auto',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    marginTop: 12,
  } as CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } as CSSProperties,
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 500,
    fontSize: 12,
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: 'pointer',
  } as CSSProperties,
  td: {
    padding: '8px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  } as CSSProperties,
  ddItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  ddSection: {
    padding: '6px 14px 2px',
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  } as CSSProperties,
  filterCount: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
  } as CSSProperties,
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  } as CSSProperties,
  groupRow: {
    background: 'var(--color-background-secondary)',
    fontWeight: 500,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  } as CSSProperties,
  groupTd: {
    padding: '6px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  } as CSSProperties,
  clearBtn: {
    fontSize: 12,
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: 0,
  } as CSSProperties,
  rangeInput: {
    width: 80,
    padding: '3px 6px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    fontFamily: 'inherit',
    background: 'transparent',
    color: 'inherit',
  } as CSSProperties,
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 2px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  } as CSSProperties,
  pageBtn: {
    padding: '4px 9px',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    lineHeight: 1,
  } as CSSProperties,
  pageBtnDisabled: { opacity: 0.35, cursor: 'default' } as CSSProperties,
  reorderBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    lineHeight: 1,
  } as CSSProperties,
  reorderBtnDisabled: { opacity: 0.3, cursor: 'default' } as CSSProperties,
  pageInfo: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    padding: '0 6px',
  } as CSSProperties,
  rowsPerPageLabel: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginLeft: 10,
  } as CSSProperties,
  pageSelect: {
    padding: '4px 6px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    cursor: 'pointer',
  } as CSSProperties,
  searchInput: {
    padding: '4px 8px',
    fontSize: 13,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    minWidth: 160,
  } as CSSProperties,
  aggRow: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
  } as CSSProperties,
  aggTd: {
    padding: '4px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  } as CSSProperties,
  filterPanel: { display: 'flex', minWidth: 460, maxHeight: 380 } as CSSProperties,
  filterCols: {
    width: 150,
    flexShrink: 0,
    overflowY: 'auto',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    padding: '4px 0',
  } as CSSProperties,
  filterColItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    padding: '7px 10px',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  filterColItemActive: { background: 'var(--color-background-secondary)', fontWeight: 500 },
  filterColDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-text-info)',
    flexShrink: 0,
  } as CSSProperties,
  filterDetail: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 0',
    minWidth: 220,
  } as CSSProperties,
  filterSearchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '2px 12px 6px',
  } as CSSProperties,
  ddSearch: {
    display: 'block',
    flex: 1,
    padding: '5px 8px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  } as CSSProperties,
  filterSelectAll: {
    flexShrink: 0,
    margin: 0,
  } as CSSProperties,
  valueSortBtn: {
    flexShrink: 0,
    padding: '4px 7px',
    fontSize: 11,
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  } as CSSProperties,
  dateTreeToggle: {
    width: 14,
    flexShrink: 0,
    textAlign: 'center',
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
  } as CSSProperties,
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }

/**
 * Renders the built-in table UI for a `useTableState` result you own yourself — the same
 * markup `<DataTable>` renders, minus the internal `useTableState` call. Use this instead of
 * `<DataTable>` when you need to reach the table's state from outside (view persistence,
 * imperative selection control, etc.) but still want the default look, e.g.:
 *
 * ```tsx
 * const table = useTableState(data, columns)
 * usePersistedView(table, 'my-table-view')
 * return <DataTableView table={table} data={data} columns={columns} />
 * ```
 */
export function DataTableView<TRow extends object>({
  table,
  data,
  columns,
  rowKey,
  selectable,
  onSelectionChange,
  onRowClick,
}: DataTableViewProps<TRow>) {
  const [openColsDD, setOpenColsDD] = useState(false)
  const [openSortDD, setOpenSortDD] = useState(false)
  const [openFilterDD, setOpenFilterDD] = useState(false)
  const [openGroupDD, setOpenGroupDD] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<TRow | null>(null)
  const [focusedRow, setFocusedRow] = useState<TRow | null>(null)
  const rowRefs = useRef(new Map<TRow, HTMLTableRowElement>())
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null)
  const [filterActiveCol, setFilterActiveCol] = useState<string | null>(null)
  const [filterSearchTerms, setFilterSearchTerms] = useState<Record<string, string>>({})
  const [filterSelectionAnchor, setFilterSelectionAnchor] = useState<Record<string, string>>({})
  const [expandedDateNodes, setExpandedDateNodes] = useState<Record<string, Set<string>>>({})
  const [filterValueSort, setFilterValueSort] = useState<Record<string, ValueSort>>({})

  const {
    visibleCols,
    sorts,
    filters,
    rangeFilters,
    groupBy,
    collapsedGroups,
    processedData,
    groupedData,
    activeColumns,
    orderedColumns,
    stringValueMap,
    stringValueCounts,
    activeFilterCount,
    selection,
    selectedRows,
    page,
    pageSize,
    numPages,
    searchQuery,
    L,
    toggleColVisibility,
    moveColumn,
    moveColumnBy,
    toggleSort,
    toggleFilter,
    toggleFilterAll,
    setFilterValues,
    setRangeFilter,
    toggleGroup,
    toggleGroupCollapse,
    clearColumnFilter,
    clearSorts,
    clearFilters,
    clearGroups,
    clearAll,
    setPage,
    setPageSize,
    setSearchQuery,
    getSortIcon,
    getSortIndex,
    toggleRowSelection,
    toggleSelectAll,
  } = table

  const selectAllRef = useRef<HTMLInputElement>(null)
  const allSelected = processedData.length > 0 && selectedRows.length === processedData.length
  const someSelected = selectedRows.length > 0 && !allSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  const filterSelectAllRef = useRef<HTMLInputElement>(null)

  const groupAllSelected = (rows: TRow[]) => rows.length > 0 && rows.every((r) => selection.has(r))
  const groupSomeSelected = (rows: TRow[]) =>
    rows.some((r) => selection.has(r)) && !groupAllSelected(rows)

  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    onSelectionChange?.(selectedRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRows])

  // Roving tabindex: exactly one data row is a Tab stop at a time (the rest are tabIndex={-1}),
  // arrow keys move it, matching how the checklist/date-tree checkboxes reuse the same anchor
  // idea for range selection. Rows only join the tab sequence when they're actually interactive.
  const rowNavEnabled = selectable || !!onRowClick
  const visibleRows = getVisibleRows(groupedData, collapsedGroups)
  const effectiveFocusRow =
    focusedRow && visibleRows.includes(focusedRow) ? focusedRow : (visibleRows[0] ?? null)

  const focusRow = (row: TRow) => {
    setFocusedRow(row)
    rowRefs.current.get(row)?.focus()
  }

  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: TRow) => {
    const idx = visibleRows.indexOf(row)
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const delta = e.key === 'ArrowDown' ? 1 : -1
        const target = visibleRows[Math.max(0, Math.min(visibleRows.length - 1, idx + delta))]
        if (target && target !== row) {
          e.preventDefault()
          if (e.shiftKey && selectable) toggleRowSelection(target, true)
          focusRow(target)
        }
        break
      }
      case 'Home':
      case 'End': {
        const target = visibleRows[e.key === 'Home' ? 0 : visibleRows.length - 1]
        if (target && target !== row) {
          e.preventDefault()
          if (e.shiftKey && selectable) toggleRowSelection(target, true)
          focusRow(target)
        }
        break
      }
      case ' ':
        if (selectable) {
          e.preventDefault()
          toggleRowSelection(row, e.shiftKey)
        }
        break
      case 'Enter':
        if (onRowClick) {
          e.preventDefault()
          onRowClick(row, e)
        }
        break
    }
  }

  const filterableCols = columns.filter((c) => c.filterable !== false)
  const groupableCols = columns.filter((c) => c.groupable === true)
  const filterActiveKey =
    filterActiveCol && filterableCols.some((c) => c.key === filterActiveCol)
      ? filterActiveCol
      : (filterableCols[0]?.key ?? null)
  const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
  const valueSortFor = (key: string) => filterValueSort[key] ?? DEFAULT_VALUE_SORT
  const cycleFilterValueSort = (col: ColumnDef<TRow>) => {
    const current = valueSortFor(col.key)
    const next =
      col.type === 'date'
        ? { ...current, dir: toggleSortDir(current.dir) }
        : cycleValueSort(current)
    setFilterValueSort({ ...filterValueSort, [col.key]: next })
  }
  const filterDetailValues =
    filterDetailCol && filterDetailCol.type !== 'number'
      ? sortFilterValues(
          filterValuesByCount(
            filterValuesBySearch(
              stringValueMap[filterDetailCol.key] ?? [],
              filterSearchTerms[filterDetailCol.key] ?? '',
            ),
            stringValueCounts[filterDetailCol.key] ?? new Map(),
            filters[filterDetailCol.key] ?? new Set(),
          ),
          stringValueCounts[filterDetailCol.key] ?? new Map(),
          valueSortFor(filterDetailCol.key),
        )
      : []
  const filterSelectedCount = filterDetailCol
    ? filterDetailValues.filter((v) => filters[filterDetailCol.key]?.has(v)).length
    : 0
  const filterAllSelected =
    filterDetailValues.length > 0 && filterSelectedCount === filterDetailValues.length
  const filterSomeSelected = filterSelectedCount > 0 && !filterAllSelected

  useEffect(() => {
    if (filterSelectAllRef.current) filterSelectAllRef.current.indeterminate = filterSomeSelected
  }, [filterSomeSelected])

  const filterDetailTree =
    filterDetailCol && filterDetailCol.type === 'date'
      ? computeDateTree(
          filterDetailValues,
          L.emptyValue,
          valueSortFor(filterDetailCol.key).dir,
          filterDetailCol.parseDate,
        )
      : []
  const isDateNodeExpanded = (colKey: string, path: string, searchActive: boolean) =>
    searchActive || (expandedDateNodes[colKey]?.has(path) ?? false)
  const toggleDateNodeExpand = (colKey: string, path: string) =>
    setExpandedDateNodes((prev) => {
      const next = new Set(prev[colKey] ?? [])
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { ...prev, [colKey]: next }
    })
  const monthName = (m: string) =>
    new Date(2000, Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long' })

  const renderDateTreeNodes = (
    nodes: DateTreeNode[],
    colKey: string,
    depth: number,
    parseDate: ((value: string) => number) | undefined,
  ): ReactNode => {
    const searchActive = (filterSearchTerms[colKey] ?? '') !== ''
    return nodes.map((node) => {
      const state = getDateTreeNodeState(node, filters[colKey] ?? new Set())
      const isLeaf = node.children.length === 0
      const expanded = isDateNodeExpanded(colKey, node.path, searchActive)
      const label =
        depth === 1 ? monthName(node.key) : depth === 2 ? String(Number(node.key)) : node.key
      return (
        <div key={node.path}>
          <label style={{ ...S.ddItem, paddingLeft: 14 + depth * 16 }}>
            {isLeaf ? (
              <span style={S.dateTreeToggle} />
            ) : (
              <span
                style={{ ...S.dateTreeToggle, cursor: 'pointer' }}
                onClick={(e) => {
                  e.preventDefault()
                  toggleDateNodeExpand(colKey, node.path)
                }}
              >
                {expanded ? '▼' : '▶'}
              </span>
            )}
            <input
              type="checkbox"
              checked={state === 'checked'}
              readOnly
              ref={(el) => {
                if (el) el.indeterminate = state === 'indeterminate'
              }}
              onClick={(e) => {
                const anchor = filterSelectionAnchor[colKey]
                const anchorNode =
                  anchor != null ? findDateTreeNode(filterDetailTree, anchor) : null
                if (e.shiftKey && anchorNode) {
                  const values = selectDateRange(filterDetailValues, anchorNode, node, parseDate)
                  setFilterValues(colKey, values, state !== 'checked')
                } else {
                  toggleFilterAll(colKey, node.values)
                }
                setFilterSelectionAnchor({ ...filterSelectionAnchor, [colKey]: node.path })
              }}
              style={{ margin: 0 }}
            />
            <span style={{ flex: 1 }}>{label}</span>
            <span style={S.filterCount} aria-hidden="true">
              {sumDateTreeNodeCount(node, stringValueCounts[colKey] ?? new Map())}
            </span>
          </label>
          {!isLeaf && expanded && renderDateTreeNodes(node.children, colKey, depth + 1, parseDate)}
        </div>
      )
    })
  }

  const hasActiveState =
    sorts.length > 0 || activeFilterCount > 0 || groupBy.length > 0 || searchQuery !== ''
  const hasAggregates = activeColumns.some((c) => c.aggregate !== undefined)

  const formatValue = (v: unknown, row: TRow, col: ColumnDef<TRow>) => {
    if (col.render) return col.render(v, row)
    if (col.format) return col.format(v, row)
    if (Array.isArray(v)) return v.join(', ')
    return v != null ? String(v) : ''
  }

  const cellValue = (row: TRow, col: ColumnDef<TRow>) =>
    formatValue(getColumnValue(col, row), row, col)

  const FILTER_CHIP_MAX = 3
  const summarizeFilterValues = (vals: Set<string>) => {
    const arr = [...vals]
    if (arr.length <= FILTER_CHIP_MAX) return arr.join(', ')
    return `${arr.slice(0, FILTER_CHIP_MAX).join(', ')}, ${L.moreValues(arr.length - FILTER_CHIP_MAX)}`
  }

  return (
    <div style={S.wrap}>
      <div style={S.toolbar}>
        {/* Columns */}
        <Dropdown
          open={openColsDD}
          setOpen={setOpenColsDD}
          trigger={<ToolbarBtn active={openColsDD}>{L.columns}</ToolbarBtn>}
        >
          <div style={S.ddSection}>{L.columnsSection}</div>
          {orderedColumns.map((col, idx) => (
            <div key={col.key} style={{ ...S.ddItem, justifyContent: 'space-between' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleCols.has(col.key)}
                  onChange={() => toggleColVisibility(col.key)}
                  style={{ margin: 0 }}
                />
                {col.label}
              </label>
              <span style={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  onClick={() => moveColumnBy(col.key, -1)}
                  disabled={idx === 0}
                  style={{ ...S.reorderBtn, ...(idx === 0 ? S.reorderBtnDisabled : {}) }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveColumnBy(col.key, 1)}
                  disabled={idx === orderedColumns.length - 1}
                  style={{
                    ...S.reorderBtn,
                    ...(idx === orderedColumns.length - 1 ? S.reorderBtnDisabled : {}),
                  }}
                >
                  ▼
                </button>
              </span>
            </div>
          ))}
        </Dropdown>

        {/* Sort */}
        <Dropdown
          open={openSortDD}
          setOpen={setOpenSortDD}
          trigger={
            <ToolbarBtn active={sorts.length > 0}>
              {L.sort}
              {sorts.length > 0 && <span style={{ ...S.chip, marginLeft: 2 }}>{sorts.length}</span>}
            </ToolbarBtn>
          }
        >
          <div style={S.ddSection}>{L.sortSection}</div>
          {columns.map((col) => {
            const s = sorts.find((s) => s.key === col.key)
            return (
              <div key={col.key} style={S.ddItem} onClick={() => toggleSort(col.key)}>
                <span
                  style={{
                    width: 18,
                    fontSize: 11,
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 500,
                  }}
                >
                  {s ? sorts.indexOf(s) + 1 : ''}
                </span>
                <span style={{ flex: 1 }}>{col.label}</span>
                <span
                  style={{
                    fontSize: 15,
                    color: s ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
                  }}
                >
                  {getSortIcon(col.key)}
                </span>
              </div>
            )
          })}
          {sorts.length > 0 && (
            <div style={{ padding: '4px 14px 6px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  clearSorts()
                }}
                style={S.clearBtn}
              >
                {L.clearSorts}
              </button>
            </div>
          )}
        </Dropdown>

        {/* Filter */}
        {filterableCols.length > 0 && (
          <Dropdown
            open={openFilterDD}
            setOpen={setOpenFilterDD}
            trigger={
              <ToolbarBtn active={activeFilterCount > 0}>
                {L.filter}
                {activeFilterCount > 0 && (
                  <span style={{ ...S.chip, marginLeft: 2 }}>{activeFilterCount}</span>
                )}
              </ToolbarBtn>
            }
          >
            <div style={S.filterPanel}>
              <div style={S.filterCols}>
                {filterableCols.map((col) => {
                  const rf = rangeFilters[col.key]
                  const hasActive =
                    col.type === 'number'
                      ? rf !== undefined && (rf.min !== '' || rf.max !== '')
                      : (filters[col.key]?.size ?? 0) > 0
                  return (
                    <div
                      key={col.key}
                      onClick={() => setFilterActiveCol(col.key)}
                      style={{
                        ...S.filterColItem,
                        ...(col.key === filterActiveKey ? S.filterColItemActive : {}),
                      }}
                    >
                      <span>{col.label}</span>
                      {hasActive && <span style={S.filterColDot} />}
                    </div>
                  )
                })}
              </div>
              <div style={S.filterDetail}>
                {filterDetailCol &&
                  (filterDetailCol.type === 'number' ? (
                    <div style={{ padding: '4px 14px 8px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder={L.min}
                          value={rangeFilters[filterDetailCol.key]?.min ?? ''}
                          onChange={(e) =>
                            setRangeFilter(filterDetailCol.key, 'min', e.target.value)
                          }
                          style={S.rangeInput}
                        />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>–</span>
                        <input
                          type="number"
                          placeholder={L.max}
                          value={rangeFilters[filterDetailCol.key]?.max ?? ''}
                          onChange={(e) =>
                            setRangeFilter(filterDetailCol.key, 'max', e.target.value)
                          }
                          style={S.rangeInput}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={S.filterSearchRow}>
                        {filterDetailValues.length > 0 && (
                          <input
                            ref={filterSelectAllRef}
                            type="checkbox"
                            checked={filterAllSelected}
                            onChange={() =>
                              toggleFilterAll(filterDetailCol.key, filterDetailValues)
                            }
                            title={L.selectAll}
                            aria-label={L.selectAll}
                            style={S.filterSelectAll}
                          />
                        )}
                        <input
                          type="text"
                          placeholder={L.filterSearchPlaceholder}
                          value={filterSearchTerms[filterDetailCol.key] ?? ''}
                          onChange={(e) =>
                            setFilterSearchTerms({
                              ...filterSearchTerms,
                              [filterDetailCol.key]: e.target.value,
                            })
                          }
                          style={S.ddSearch}
                        />
                        <button
                          type="button"
                          onClick={() => cycleFilterValueSort(filterDetailCol)}
                          title={L.sortValues}
                          aria-label={L.sortValues}
                          style={S.valueSortBtn}
                        >
                          {filterDetailCol.type === 'date'
                            ? getDateSortIcon(valueSortFor(filterDetailCol.key).dir)
                            : getValueSortIcon(valueSortFor(filterDetailCol.key))}
                        </button>
                      </div>
                      {filterDetailCol.type === 'date'
                        ? renderDateTreeNodes(
                            filterDetailTree,
                            filterDetailCol.key,
                            0,
                            filterDetailCol.parseDate,
                          )
                        : filterDetailValues.map((v) => (
                            <label key={v} style={{ ...S.ddItem, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={filters[filterDetailCol.key]?.has(v) ?? false}
                                readOnly
                                onClick={(e) => {
                                  const key = filterDetailCol.key
                                  const anchor = filterSelectionAnchor[key]
                                  if (e.shiftKey && anchor != null) {
                                    const shouldSelect = !(filters[key]?.has(v) ?? false)
                                    setFilterValues(
                                      key,
                                      selectRange(filterDetailValues, anchor, v),
                                      shouldSelect,
                                    )
                                  } else {
                                    toggleFilter(key, v)
                                  }
                                  setFilterSelectionAnchor({ ...filterSelectionAnchor, [key]: v })
                                }}
                                style={{ margin: 0 }}
                              />
                              <span style={{ flex: 1 }}>
                                {filterDetailCol.renderFilterLabel
                                  ? filterDetailCol.renderFilterLabel(v)
                                  : v}
                              </span>
                              <span style={S.filterCount} aria-hidden="true">
                                {stringValueCounts[filterDetailCol.key]?.get(v) ?? 0}
                              </span>
                            </label>
                          ))}
                    </>
                  ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div style={{ padding: '4px 14px 8px' }}>
                <button onClick={clearFilters} style={S.clearBtn}>
                  {L.clearFilters}
                </button>
              </div>
            )}
          </Dropdown>
        )}

        {/* Group */}
        {groupableCols.length > 0 && (
          <Dropdown
            open={openGroupDD}
            setOpen={setOpenGroupDD}
            trigger={
              <ToolbarBtn active={groupBy.length > 0}>
                {L.group}
                {groupBy.length > 0 && (
                  <span style={{ ...S.chip, marginLeft: 2 }}>{groupBy.length}</span>
                )}
              </ToolbarBtn>
            }
          >
            <div style={S.ddSection}>{L.groupSection}</div>
            {groupableCols.map((col) => (
              <div key={col.key} style={S.ddItem} onClick={() => toggleGroup(col.key)}>
                <span
                  style={{
                    width: 18,
                    fontSize: 11,
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 500,
                  }}
                >
                  {groupBy.includes(col.key) ? groupBy.indexOf(col.key) + 1 : ''}
                </span>
                <span style={{ flex: 1 }}>{col.label}</span>
                {groupBy.includes(col.key) && <span>✓</span>}
              </div>
            ))}
            {groupBy.length > 0 && (
              <div style={{ padding: '4px 14px 6px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearGroups()
                  }}
                  style={S.clearBtn}
                >
                  {L.clearGroups}
                </button>
              </div>
            )}
          </Dropdown>
        )}

        <input
          type="text"
          placeholder={L.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={S.searchInput}
        />

        {hasActiveState && (
          <button
            onClick={clearAll}
            style={{
              marginLeft: 4,
              padding: '5px 10px',
              background: 'none',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontFamily: 'inherit',
            }}
          >
            {L.clearAll}
          </button>
        )}

        <div style={S.stats}>
          {L.rowCount(processedData.length, data.length)}
          {groupBy.length > 0 && L.groupCount(groupedData.length)}
        </div>
      </div>

      {/* Active chips */}
      {hasActiveState && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0 0' }}>
          {sorts.map((s, i) => (
            <span key={s.key} style={S.chip}>
              {i + 1}. {columns.find((c) => c.key === s.key)?.label} {s.dir === 'asc' ? '↑' : '↓'}
              <span onClick={() => toggleSort(s.key)} style={{ cursor: 'pointer', marginLeft: 2 }}>
                ×
              </span>
            </span>
          ))}
          {Object.entries(filters)
            .filter(([, v]) => v.size > 0)
            .map(([key, vals]) => (
              <span
                key={key}
                style={{
                  ...S.chip,
                  background: 'var(--color-background-info)',
                  color: 'var(--color-text-info)',
                  border: '0.5px solid var(--color-border-info)',
                }}
              >
                {columns.find((c) => c.key === key)?.label}: {summarizeFilterValues(vals)}
                <span
                  onClick={() => clearColumnFilter(key)}
                  style={{ cursor: 'pointer', marginLeft: 2 }}
                >
                  ×
                </span>
              </span>
            ))}
          {groupBy.map((key, i) => (
            <span
              key={key}
              style={{
                ...S.chip,
                background: 'var(--color-background-warning)',
                color: 'var(--color-text-warning)',
                border: '0.5px solid var(--color-border-warning)',
              }}
            >
              {L.groupLabel(i + 1)}: {columns.find((c) => c.key === key)?.label}
              <span onClick={() => toggleGroup(key)} style={{ cursor: 'pointer', marginLeft: 2 }}>
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {selectable && (
                <th
                  style={{ ...S.th, width: 36, cursor: 'default' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(processedData)}
                    style={{ margin: 0 }}
                  />
                </th>
              )}
              {groupBy.length > 0 && <th style={{ ...S.th, width: 28, cursor: 'default' }} />}
              {activeColumns.map((col) => {
                const sortIdx = getSortIndex(col.key)
                return (
                  <th
                    key={col.key}
                    draggable
                    onDragStart={() => setDragColKey(col.key)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragColKey && dragColKey !== col.key) setDragOverColKey(col.key)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragColKey && dragColKey !== col.key) moveColumn(dragColKey, col.key)
                      setDragColKey(null)
                      setDragOverColKey(null)
                    }}
                    onDragEnd={() => {
                      setDragColKey(null)
                      setDragOverColKey(null)
                    }}
                    style={{
                      ...S.th,
                      width: col.width,
                      opacity: dragColKey === col.key ? 0.4 : 1,
                      boxShadow:
                        dragOverColKey === col.key
                          ? 'inset 2px 0 0 var(--color-text-primary)'
                          : undefined,
                    }}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      <span
                        style={{
                          fontSize: 10,
                          color: sortIdx
                            ? 'var(--color-text-primary)'
                            : 'var(--color-border-secondary)',
                        }}
                      >
                        {sortIdx ? `${sortIdx}${getSortIcon(col.key)}` : '↕'}
                      </span>
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groupedData.map(({ key: gkey, keyParts, rows }) => {
              const isCollapsed = gkey !== null && collapsedGroups.has(gkey)
              return [
                gkey !== null && (
                  <tr
                    key={`g-${gkey}`}
                    style={S.groupRow}
                    onClick={() => toggleGroupCollapse(gkey)}
                  >
                    {selectable && (
                      <td style={{ ...S.groupTd, width: 36 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={(el) => {
                            if (el) el.indeterminate = groupSomeSelected(rows)
                          }}
                          type="checkbox"
                          checked={groupAllSelected(rows)}
                          onChange={() => toggleSelectAll(rows)}
                          style={{ margin: 0 }}
                        />
                      </td>
                    )}
                    <td style={{ ...S.groupTd, width: 28 }}>{isCollapsed ? '▶' : '▼'}</td>
                    <td colSpan={activeColumns.length} style={S.groupTd}>
                      {groupBy.map((g, i) => {
                        const col = columns.find((c) => c.key === g)
                        const raw = col ? getColumnValue(col, rows[0]) : undefined
                        const value = Array.isArray(raw) ? keyParts[i] : raw
                        return (
                          <span key={g}>
                            {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>›</span>}
                            <span style={{ marginRight: 4, opacity: 0.6 }}>{col?.label}:</span>
                            {col ? formatValue(value, rows[0], col) : String(value ?? '')}
                          </span>
                        )
                      })}
                      <span style={{ marginLeft: 10, fontWeight: 400, opacity: 0.6 }}>
                        {L.rowsInGroup(rows.length)}
                      </span>
                    </td>
                  </tr>
                ),
                gkey !== null && hasAggregates && (
                  <tr key={`agg-${gkey}`} style={S.aggRow}>
                    {selectable && <td style={{ ...S.aggTd, width: 36 }} />}
                    <td style={{ ...S.aggTd, width: 28 }} />
                    {activeColumns.map((col) => {
                      const v = computeAggregate(col, rows)
                      return (
                        <td key={col.key} style={S.aggTd}>
                          {v !== undefined && v !== null
                            ? col.format
                              ? col.format(v, rows[0])
                              : String(v)
                            : null}
                        </td>
                      )
                    })}
                  </tr>
                ),
                !isCollapsed &&
                  rows.map((row, ri) => (
                    <tr
                      key={rowKey ? String(asRecord(row)[rowKey] ?? ri) : ri}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row, el)
                        else rowRefs.current.delete(row)
                      }}
                      tabIndex={rowNavEnabled ? (row === effectiveFocusRow ? 0 : -1) : undefined}
                      aria-selected={selectable ? selection.has(row) : undefined}
                      onKeyDown={rowNavEnabled ? (e) => handleRowKeyDown(e, row) : undefined}
                      onFocus={rowNavEnabled ? () => setFocusedRow(row) : undefined}
                      onClick={onRowClick ? (e) => onRowClick(row, e) : undefined}
                      onMouseEnter={onRowClick ? () => setHoveredRow(row) : undefined}
                      onMouseLeave={onRowClick ? () => setHoveredRow(null) : undefined}
                      style={{
                        background:
                          selectable && selection.has(row)
                            ? 'var(--color-background-info)'
                            : onRowClick && hoveredRow === row
                              ? 'var(--color-background-secondary)'
                              : ri % 2 === 0
                                ? 'transparent'
                                : 'var(--color-background-secondary)',
                        cursor: onRowClick ? 'pointer' : undefined,
                      }}
                    >
                      {selectable && (
                        <td style={{ ...S.td, width: 36 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selection.has(row)}
                            readOnly
                            tabIndex={-1}
                            onClick={(e) => toggleRowSelection(row, e.shiftKey)}
                            style={{ margin: 0 }}
                          />
                        </td>
                      )}
                      {gkey !== null && <td style={{ ...S.td, width: 28 }} />}
                      {activeColumns.map((col) => (
                        <td key={col.key} style={{ ...S.td, width: col.width }}>
                          {cellValue(row, col)}
                        </td>
                      ))}
                    </tr>
                  )),
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && (
        <div style={S.pagination}>
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            style={{ ...S.pageBtn, ...(page === 1 ? S.pageBtnDisabled : {}) }}
          >
            «
          </button>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            style={{ ...S.pageBtn, ...(page === 1 ? S.pageBtnDisabled : {}) }}
          >
            ‹
          </button>
          <span style={S.pageInfo}>{L.pageOf(page, numPages)}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= numPages}
            style={{ ...S.pageBtn, ...(page >= numPages ? S.pageBtnDisabled : {}) }}
          >
            ›
          </button>
          <button
            onClick={() => setPage(numPages)}
            disabled={page >= numPages}
            style={{ ...S.pageBtn, ...(page >= numPages ? S.pageBtnDisabled : {}) }}
          >
            »
          </button>
          <span style={S.rowsPerPageLabel}>{L.rowsPerPage}:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={S.pageSelect}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
