import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from 'react'
import { computeAggregate } from '@vates/flexi-table-core'
import { useTableState } from './useTableState'
import { Dropdown } from './components/Dropdown'
import type { ColumnDef, DataTableProps } from './types'

const S = {
  wrap: {
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  metaBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
  } as CSSProperties,
  stats: {
    flex: 1,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  } as CSSProperties,
  settingsBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
  } as CSSProperties,
  settingsBtnActive: {
    borderColor: 'var(--color-border-info, #3b82f6)',
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    background: 'var(--color-text-accent, #3b82f6)',
    color: '#fff',
    borderRadius: 9,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1,
  } as CSSProperties,
  tableWrap: {
    overflowX: 'auto',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
  } as CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } as CSSProperties,
  th: {
    padding: 0,
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
  thNoSort: {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 500,
    fontSize: 12,
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: 'default',
  } as CSSProperties,
  thInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    cursor: 'pointer',
  } as CSSProperties,
  thLabel: {
    flex: 1,
  } as CSSProperties,
  thIndicators: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  } as CSSProperties,
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-text-warning, #f59e0b)',
    display: 'inline-block',
    flexShrink: 0,
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
    background: 'none',
    border: 'none',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
    width: '100%',
  } as CSSProperties,
  ddSection: {
    padding: '6px 14px 2px',
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as CSSProperties,
  ddSep: {
    height: '0.5px',
    background: 'var(--color-border-tertiary)',
    margin: '4px 0',
  } as CSSProperties,
  clearBtn: {
    fontSize: 12,
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
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
  searchInput: {
    padding: '4px 8px',
    fontSize: 13,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
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
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 2px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap' as const,
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
  sortRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    gap: 6,
  } as CSSProperties,
  sortRowLabel: {
    flex: 1,
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as CSSProperties,
  sortDirBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    height: 22,
    padding: '0 5px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    background: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    gap: 2,
  } as CSSProperties,
  sortDirBtnActive: {
    background: 'var(--color-background-info, #eff6ff)',
    borderColor: 'var(--color-border-info, #3b82f6)',
    color: 'var(--color-text-info, #2563eb)',
  } as CSSProperties,
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

interface SortRowProps {
  currentDir: 'asc' | 'desc' | undefined
  sortIdx: number | null
  label: string
  ascTitle: string
  descTitle: string
  onAsc: () => void
  onDesc: () => void
  onClear: () => void
}

function SortRow({
  currentDir,
  sortIdx,
  label,
  ascTitle,
  descTitle,
  onAsc,
  onDesc,
  onClear,
}: SortRowProps) {
  return (
    <div style={S.sortRow}>
      <span style={S.sortRowLabel}>{label}</span>
      <button
        style={{ ...S.sortDirBtn, ...(currentDir === 'asc' ? S.sortDirBtnActive : {}) }}
        onClick={currentDir === 'asc' ? onClear : onAsc}
        title={ascTitle}
      >
        {currentDir === 'asc' && sortIdx !== null ? sortIdx : ''}↑
      </button>
      <button
        style={{ ...S.sortDirBtn, ...(currentDir === 'desc' ? S.sortDirBtnActive : {}) }}
        onClick={currentDir === 'desc' ? onClear : onDesc}
        title={descTitle}
      >
        {currentDir === 'desc' && sortIdx !== null ? sortIdx : ''}↓
      </button>
    </div>
  )
}

interface StringFilterSectionProps {
  values: string[]
  activeFilters: Set<string> | undefined
  renderFilterLabel?: (value: string) => ReactNode
  onToggle: (value: string) => void
  onBatchSet: (values: string[], selected: boolean) => void
  searchPlaceholder: string
  selectAllLabel: string
  noResultsLabel: string
}

function StringFilterSection({
  values,
  activeFilters,
  renderFilterLabel,
  onToggle,
  onBatchSet,
  searchPlaceholder,
  selectAllLabel,
  noResultsLabel,
}: StringFilterSectionProps) {
  const [query, setQuery] = useState('')

  const visible = query
    ? values.filter((v) => v.toLowerCase().includes(query.toLowerCase()))
    : values

  const selectedInVisible = visible.filter((v) => activeFilters?.has(v))
  const allSelected = visible.length > 0 && selectedInVisible.length === visible.length
  const someSelected = selectedInVisible.length > 0 && !allSelected

  return (
    <>
      <div style={{ padding: '4px 10px 2px' }}>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={S.searchInput}
        />
      </div>
      <label
        style={{
          ...S.ddItem,
          cursor: 'pointer',
          fontSize: 12,
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected
          }}
          onChange={() => onBatchSet(visible, !allSelected)}
          style={{ margin: 0 }}
        />
        <span style={{ flex: 1 }}>{selectAllLabel}</span>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{visible.length}</span>
      </label>
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {noResultsLabel}
          </div>
        ) : (
          visible.map((v) => (
            <label key={v} style={{ ...S.ddItem, cursor: 'pointer', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={activeFilters?.has(v) ?? false}
                onChange={() => onToggle(v)}
                style={{ margin: 0 }}
              />
              {renderFilterLabel ? renderFilterLabel(v) : v}
            </label>
          ))
        )}
      </div>
    </>
  )
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
}: DataTableProps<TRow>) {
  const [openDD, setOpenDD] = useState<string | null>(null)

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
    setSortDir,
    clearColumnSort,
    toggleFilter,
    setColumnFilters,
    setRangeFilter,
    toggleGroup,
    toggleGroupCollapse,
    clearColumnFilter,
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

  const hasActiveState =
    sorts.length > 0 || activeFilterCount > 0 || groupBy.length > 0 || searchQuery !== ''
  const activeCount =
    sorts.length + activeFilterCount + groupBy.length + (searchQuery !== '' ? 1 : 0)
  const hasAggregates = activeColumns.some((c) => c.aggregate !== undefined)

  const cellValue = (row: TRow, col: ColumnDef<TRow>) => {
    const v = asRecord(row)[col.key]
    if (col.render) return col.render(v, row)
    if (col.format) return col.format(v)
    return v != null ? String(v) : ''
  }

  function colHasFilter(key: string): boolean {
    return (
      (filters[key]?.size ?? 0) > 0 ||
      (rangeFilters[key]?.min ?? '') !== '' ||
      (rangeFilters[key]?.max ?? '') !== ''
    )
  }

  return (
    <div style={S.wrap}>
      {/* Meta bar: stats + table settings dropdown */}
      <div style={S.metaBar}>
        <span style={S.stats}>
          {L.rowCount(processedData.length, data.length)}
          {groupBy.length > 0 && ` · ${L.groupCount(groupedData.length)}`}
        </span>
        <Dropdown
          open={openDD === 'table'}
          setOpen={(v) => setOpenDD(v ? 'table' : null)}
          align="right"
          trigger={
            <button
              style={{
                ...S.settingsBtn,
                ...(hasActiveState ? S.settingsBtnActive : {}),
              }}
            >
              ⚙{activeCount > 0 && <span style={S.badge}>{activeCount}</span>}
            </button>
          }
        >
          {/* Search */}
          <div style={{ padding: '6px 10px' }}>
            <input
              type="text"
              placeholder={L.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={S.searchInput}
              autoFocus
            />
          </div>
          <div style={S.ddSep} />
          {/* Column visibility */}
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
          {hasActiveState && (
            <>
              <div style={S.ddSep} />
              <div style={{ padding: '4px 14px 6px' }}>
                <button
                  onClick={() => {
                    clearAll()
                    setOpenDD(null)
                  }}
                  style={S.clearBtn}
                >
                  {L.clearAll}
                </button>
              </div>
            </>
          )}
        </Dropdown>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {selectable && (
                <th style={{ ...S.thNoSort, width: 36 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(processedData)}
                    style={{ margin: 0 }}
                  />
                </th>
              )}
              {groupBy.length > 0 && <th style={{ ...S.thNoSort, width: 28 }} />}
              {activeColumns.map((col) => {
                const sortIdx = getSortIndex(col.key)
                const currentSort = sorts.find((s) => s.key === col.key)
                const filtered = colHasFilter(col.key)
                const isSortable = col.sortable !== false
                const isFilterable = col.filterable !== false && col.type !== 'date'
                const isNumeric = col.type === 'number'
                const hasFilterValues = isNumeric || (stringValueMap[col.key]?.length ?? 0) > 0
                const showFilter = isFilterable && hasFilterValues
                const canHide = visibleCols.size > 1

                return (
                  <th key={col.key} style={{ ...S.th, width: col.width }}>
                    <Dropdown
                      open={openDD === `col:${col.key}`}
                      setOpen={(v) => setOpenDD(v ? `col:${col.key}` : null)}
                      wrapStyle={{ display: 'block' }}
                      trigger={
                        <div style={S.thInner}>
                          <span style={S.thLabel}>{col.label}</span>
                          <span style={S.thIndicators}>
                            {filtered && <span style={S.filterDot} title="Filtered" />}
                            <span
                              style={{
                                fontSize: 10,
                                flexShrink: 0,
                                color: sortIdx
                                  ? 'var(--color-text-primary)'
                                  : 'var(--color-border-secondary)',
                              }}
                            >
                              {sortIdx ? `${sortIdx}${getSortIcon(col.key)}` : '▾'}
                            </span>
                          </span>
                        </div>
                      }
                    >
                      {/* Sort */}
                      {isSortable && (
                        <SortRow
                          currentDir={currentSort?.dir}
                          sortIdx={sortIdx}
                          label={L.sort}
                          ascTitle={L.sortAscending}
                          descTitle={L.sortDescending}
                          onAsc={() => setSortDir(col.key, 'asc')}
                          onDesc={() => setSortDir(col.key, 'desc')}
                          onClear={() => clearColumnSort(col.key)}
                        />
                      )}

                      {/* Group by */}
                      {col.groupable && (
                        <>
                          {isSortable && <div style={S.ddSep} />}
                          <button
                            style={S.ddItem}
                            onClick={() => {
                              toggleGroup(col.key)
                              setOpenDD(null)
                            }}
                          >
                            {L.convertToGroup}
                          </button>
                        </>
                      )}

                      {/* Hide column */}
                      {(isSortable || col.groupable) && <div style={S.ddSep} />}
                      <button
                        style={{
                          ...S.ddItem,
                          color: 'var(--color-text-secondary)',
                          ...(!canHide ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                        }}
                        disabled={!canHide}
                        onClick={() => {
                          toggleColVisibility(col.key)
                          setOpenDD(null)
                        }}
                      >
                        {L.hideColumn}
                      </button>

                      {/* Filter */}
                      {showFilter && (
                        <>
                          <div style={S.ddSep} />
                          <div style={S.ddSection}>{L.filter}</div>
                          {isNumeric ? (
                            <div style={{ padding: '4px 14px 8px' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="number"
                                  placeholder={L.min}
                                  value={rangeFilters[col.key]?.min ?? ''}
                                  onChange={(e) => setRangeFilter(col.key, 'min', e.target.value)}
                                  style={S.rangeInput}
                                />
                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                                  –
                                </span>
                                <input
                                  type="number"
                                  placeholder={L.max}
                                  value={rangeFilters[col.key]?.max ?? ''}
                                  onChange={(e) => setRangeFilter(col.key, 'max', e.target.value)}
                                  style={S.rangeInput}
                                />
                              </div>
                            </div>
                          ) : (
                            <StringFilterSection
                              values={stringValueMap[col.key] ?? []}
                              activeFilters={filters[col.key]}
                              renderFilterLabel={col.renderFilterLabel}
                              onToggle={(v) => toggleFilter(col.key, v)}
                              onBatchSet={(vals, selected) => {
                                const next = new Set(filters[col.key] ?? [])
                                if (selected) vals.forEach((v) => next.add(v))
                                else vals.forEach((v) => next.delete(v))
                                setColumnFilters(col.key, next)
                              }}
                              searchPlaceholder={L.filterSearch}
                              selectAllLabel={L.selectAll}
                              noResultsLabel={L.noFilterResults}
                            />
                          )}
                          {filtered && (
                            <div style={{ padding: '4px 14px 6px' }}>
                              <button onClick={() => clearColumnFilter(col.key)} style={S.clearBtn}>
                                {L.clearFilter}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </Dropdown>
                  </th>
                )
              })}
            </tr>
            {groupBy.length > 0 && (
              <tr>
                {selectable && <th style={{ ...S.thNoSort, width: 36 }} />}
                <th style={{ ...S.thNoSort, width: 28 }} />
                <th colSpan={activeColumns.length} style={{ ...S.thNoSort, padding: '4px 12px' }}>
                  {groupBy.map((g, i) => {
                    const col = columns.find((c) => c.key === g)
                    const currentSort = sorts.find((s) => s.key === g)
                    const sortIdx = getSortIndex(g)
                    return (
                      <span
                        key={g}
                        style={{ display: 'inline-flex', alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {i > 0 && <span style={{ margin: '0 8px', opacity: 0.4 }}>›</span>}
                        <Dropdown
                          open={openDD === `group:${g}`}
                          setOpen={(v) => setOpenDD(v ? `group:${g}` : null)}
                          trigger={
                            <span
                              style={{
                                opacity: 0.8,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                borderBottom: '1px dashed currentColor',
                              }}
                            >
                              {col?.label ?? g}
                              {sortIdx ? (
                                <span style={{ fontSize: 10 }}>
                                  {sortIdx}
                                  {getSortIcon(g)}
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, opacity: 0.4 }}>▾</span>
                              )}
                            </span>
                          }
                        >
                          <SortRow
                            currentDir={currentSort?.dir}
                            sortIdx={sortIdx}
                            label={L.sort}
                            ascTitle={L.sortAscending}
                            descTitle={L.sortDescending}
                            onAsc={() => setSortDir(g, 'asc')}
                            onDesc={() => setSortDir(g, 'desc')}
                            onClear={() => clearColumnSort(g)}
                          />
                          <div style={S.ddSep} />
                          <button
                            style={S.ddItem}
                            onClick={() => {
                              toggleGroup(g)
                              setOpenDD(null)
                            }}
                          >
                            {L.convertToColumn}
                          </button>
                        </Dropdown>
                      </span>
                    )
                  })}
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {groupedData.map(({ key: gkey, rows }) => {
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
                        return (
                          <span key={g}>
                            {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>›</span>}
                            <span style={{ marginRight: 4, opacity: 0.6 }}>{col?.label}:</span>
                            {col ? cellValue(rows[0], col) : String(asRecord(rows[0])[g] ?? '')}
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
                              ? col.format(v)
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
                      style={{
                        background:
                          selectable && selection.has(row)
                            ? 'var(--color-background-info)'
                            : ri % 2 === 0
                              ? 'transparent'
                              : 'var(--color-background-secondary)',
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
