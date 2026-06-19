import { useState, useMemo } from 'react'
import {
  processData,
  groupData,
  computeStringValues,
  paginateData,
  calcTotalPages,
  toggleSort as _toggleSort,
  toggleFilter as _toggleFilter,
  toggleGroupBy,
  toggleCollapse,
  getSortIcon as _getSortIcon,
  getSortIndex as _getSortIndex,
  countActiveFilters,
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
} from '@vates/flexi-table-core'
import type { ColumnDef } from './types'

export function useTableState<TRow extends object>(
  data: TRow[],
  columns: ColumnDef<TRow>[],
  defaultVisibleColumns?: string[],
  labelOverrides?: Partial<DataTableLabels>,
  defaultPageSize?: number,
) {
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(defaultVisibleColumns ?? columns.map(c => c.key)),
  )
  const [sorts, setSorts] = useState<SortEntry[]>([])
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({})
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(defaultPageSize ?? 0)

  const stringValueMap = useMemo(() => computeStringValues(data, columns), [data, columns])

  const processedData = useMemo(
    () => processData(data, filters, rangeFilters, sorts),
    [data, filters, rangeFilters, sorts],
  )

  const numPages = useMemo(
    () => calcTotalPages(processedData.length, pageSize),
    [processedData.length, pageSize],
  )

  const pagedData = useMemo(
    () => paginateData(processedData, Math.min(page, numPages), pageSize),
    [processedData, page, numPages, pageSize],
  )

  const groupedData = useMemo(
    () => groupData(pagedData, groupBy),
    [pagedData, groupBy],
  )

  const activeColumns = useMemo(
    () => columns.filter(c => visibleCols.has(c.key) && !groupBy.includes(c.key)),
    [columns, visibleCols, groupBy],
  )

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, rangeFilters),
    [filters, rangeFilters],
  )

  return {
    // Raw state (for direct manipulation in the UI)
    visibleCols,
    sorts,
    filters,
    rangeFilters,
    groupBy,
    collapsedGroups,
    page,
    pageSize,
    // Derived
    processedData,
    pagedData,
    groupedData,
    activeColumns,
    stringValueMap,
    activeFilterCount,
    numPages,
    L,
    // Actions
    toggleColVisibility: (key: string) =>
      setVisibleCols(prev => {
        const next = new Set(prev)
        if (next.has(key)) { if (next.size > 1) next.delete(key) }
        else next.add(key)
        return next
      }),
    toggleSort: (key: string) => setSorts(prev => _toggleSort(prev, key)),
    toggleFilter: (key: string, value: string) => {
      setFilters(prev => _toggleFilter(prev, key, value))
      setPageState(1)
    },
    setRangeFilter: (key: string, field: 'min' | 'max', value: string) => {
      setRangeFilters(prev => ({
        ...prev,
        [key]: { min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [field]: value },
      }))
      setPageState(1)
    },
    toggleGroup: (key: string) => setGroupBy(prev => toggleGroupBy(prev, key)),
    toggleGroupCollapse: (key: string) => setCollapsedGroups(prev => toggleCollapse(prev, key)),
    clearColumnFilter: (key: string) => {
      setFilters(prev => ({ ...prev, [key]: new Set() }))
      setPageState(1)
    },
    setPage: (p: number) => setPageState(Math.max(1, Math.min(p, numPages))),
    setPageSize: (s: number) => { setPageSizeState(s); setPageState(1) },
    clearSorts: () => setSorts([]),
    clearFilters: () => { setFilters({}); setRangeFilters({}); setPageState(1) },
    clearGroups: () => { setGroupBy([]); setCollapsedGroups(new Set()) },
    clearAll: () => {
      setSorts([])
      setFilters({})
      setRangeFilters({})
      setGroupBy([])
      setCollapsedGroups(new Set())
      setPageState(1)
    },
    getSortIcon: (key: string) => _getSortIcon(sorts, key),
    getSortIndex: (key: string) => _getSortIndex(sorts, key),
  }
}
