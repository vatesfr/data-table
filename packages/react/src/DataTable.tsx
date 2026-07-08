import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { computeAggregate } from '@vates/flexi-table-core'
import { useTableState } from './useTableState'
import { Dropdown } from './components/Dropdown'
import { ToolbarBtn } from './components/ToolbarBtn'
import type { ColumnDef, DataTableProps } from './types'

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
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

export function DataTable<TRow extends object>({
  data,
  columns,
  rowKey,
  defaultVisibleColumns,
  labels,
  defaultPageSize,
  selectable,
  onSelectionChange,
  onRowClick,
}: DataTableProps<TRow>) {
  const [openColsDD, setOpenColsDD] = useState(false)
  const [openSortDD, setOpenSortDD] = useState(false)
  const [openFilterDD, setOpenFilterDD] = useState(false)
  const [openGroupDD, setOpenGroupDD] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<TRow | null>(null)

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
    stringValueMap,
    activeFilterCount,
    selection,
    selectedRows,
    page,
    pageSize,
    numPages,
    searchQuery,
    L,
    toggleColVisibility,
    toggleSort,
    toggleFilter,
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
  } = useTableState(data, columns, defaultVisibleColumns, labels, defaultPageSize)

  const selectAllRef = useRef<HTMLInputElement>(null)
  const allSelected = processedData.length > 0 && selectedRows.length === processedData.length
  const someSelected = selectedRows.length > 0 && !allSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

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

  const numericFilterCols = columns.filter((c) => c.type === 'number' && c.filterable !== false)
  const stringFilterCols = columns.filter(
    (c) => c.type !== 'number' && c.type !== 'date' && c.filterable !== false,
  )
  const groupableCols = columns.filter((c) => c.groupable === true)
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
    formatValue(asRecord(row)[col.key], row, col)

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
          {columns.map((col) => (
            <label key={col.key} style={{ ...S.ddItem, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={visibleCols.has(col.key)}
                onChange={() => toggleColVisibility(col.key)}
                style={{ margin: 0 }}
              />
              {col.label}
            </label>
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
        {(stringFilterCols.length > 0 || numericFilterCols.length > 0) && (
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
            <div style={{ maxHeight: 380, overflowY: 'auto', minWidth: 240 }}>
              {stringFilterCols.map((col) => (
                <div key={col.key}>
                  <div style={S.ddSection}>{col.label}</div>
                  {(stringValueMap[col.key] ?? []).map((v) => (
                    <label key={v} style={{ ...S.ddItem, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={filters[col.key]?.has(v) ?? false}
                        onChange={() => toggleFilter(col.key, v)}
                        style={{ margin: 0 }}
                      />
                      {col.renderFilterLabel ? col.renderFilterLabel(v) : v}
                    </label>
                  ))}
                </div>
              ))}
              {numericFilterCols.length > 0 && (
                <>
                  <div style={S.ddSection}>{L.numericRanges}</div>
                  {numericFilterCols.map((col) => (
                    <div key={col.key} style={{ padding: '4px 14px 8px' }}>
                      <div
                        style={{
                          fontSize: 12,
                          marginBottom: 4,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {col.label}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder={L.min}
                          value={rangeFilters[col.key]?.min ?? ''}
                          onChange={(e) => setRangeFilter(col.key, 'min', e.target.value)}
                          style={S.rangeInput}
                        />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>–</span>
                        <input
                          type="number"
                          placeholder={L.max}
                          value={rangeFilters[col.key]?.max ?? ''}
                          onChange={(e) => setRangeFilter(col.key, 'max', e.target.value)}
                          style={S.rangeInput}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
              {activeFilterCount > 0 && (
                <div style={{ padding: '4px 14px 8px' }}>
                  <button onClick={clearFilters} style={S.clearBtn}>
                    {L.clearFilters}
                  </button>
                </div>
              )}
            </div>
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
                {columns.find((c) => c.key === key)?.label}: {[...vals].join(', ')}
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
                    style={{ ...S.th, width: col.width }}
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
                        const raw = asRecord(rows[0])[g]
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
                            onChange={() => toggleRowSelection(row)}
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
