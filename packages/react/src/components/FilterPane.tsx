import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  computeStringValues,
  computeStringValueCounts,
  isMultiValueColumnCached,
  filterValuesBySearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  computeRangeSliderGeometry,
  formatRangeBound,
  rangeInputProps,
  matchingRangePreset,
  rangePresetFilter,
  formatDateTreeLabel,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir as toggleValueSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  checklistBulkState,
  clickChecklistValue,
  toggleChecklistExclude,
  clickDateTreeNode,
  toggleChecklistValues,
  computeVirtualRange,
  getVirtualScrollTarget,
  rovingFocusTarget,
  checklistNavIndex,
  FILTER_DETAIL_NAV_SELECTOR,
  filterMatchMode,
  formatFilterValue,
  toggleCollapse,
  type DateTreeNode,
} from '@vates/data-table-core/internal'
import type { ValueSort } from '@vates/data-table-core'
import type { ColumnDef } from '../types'
import type { TableState } from '../useTableState'

// Fixed row height for the filter dropdown's virtualized checklist (see computeVirtualRange) —
// must match the actual rendered height of a checklist row exactly, which is why each row gets
// an explicit inline height below instead of relying on .dt-dd-item's padding + line-height.
const FILTER_LIST_ITEM_HEIGHT = 32
// Only the *assumed* viewport height fed to computeVirtualRange's windowing math: `.dt-filter-list`
// flex-fills `.dt-filter-detail` instead of having a fixed height. Safe to leave un-measured:
// `.dt-filter-panel`'s max-height of 380px bounds how much taller the list can grow past this
// (~60-80px, given the search row above it), well inside the 5-row (160px) overscan on each side.
const FILTER_LIST_VIEWPORT_HEIGHT = 260

/**
 * The "2 inputs + a slider" range control's slider half — two overlapping native
 * <input type="range"> thumbs sharing one visual track (only the thumb itself is a hit target,
 * via `.dt-range-slider-thumb`, so grabbing either one works regardless of z-order) plus a
 * colored fill between them. `onChange` always receives already-sorted (low, high) — dragging
 * one thumb past the other just swaps their visual roles on the next render rather than needing
 * cross-clamping, the standard behavior for this two-native-inputs trick. Unlike the vanilla
 * adapter's version, this fires on every `input` tick (not just on drag-end): React's reconciler
 * keeps the same underlying DOM node across a state-driven re-render of a controlled input, so
 * there's no "rebuild mid-drag aborts the native drag" risk here the way there is for vanilla's
 * innerHTML-rebuilding render().
 */
function RangeSlider({
  bounds,
  low,
  high,
  step,
  pctLo,
  pctHi,
  minLabel,
  maxLabel,
  onChange,
}: {
  bounds: { min: number; max: number }
  low: number
  high: number
  step: number | 'any'
  pctLo: number
  pctHi: number
  minLabel: string
  maxLabel: string
  onChange: (low: number, high: number) => void
}) {
  const handleThumb = (raw: number, other: number) =>
    onChange(Math.min(raw, other), Math.max(raw, other))
  return (
    <div className="dt-range-slider">
      <div className="dt-range-slider-track" />
      <div
        className="dt-range-slider-fill"
        style={{ left: `${pctLo}%`, right: `${100 - pctHi}%` }}
      />
      <input
        type="range"
        className="dt-range-slider-thumb"
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={low}
        aria-label={minLabel}
        onChange={(e) => handleThumb(Number(e.target.value), high)}
      />
      <input
        type="range"
        className="dt-range-slider-thumb"
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={high}
        aria-label={maxLabel}
        onChange={(e) => handleThumb(Number(e.target.value), low)}
      />
    </div>
  )
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }

// Escape on the value search clears it first (see the search input below); the Filter dropdown's
// own handler only crosses panes (→/←) and clears columns.
/**
 * One column's filter controls — checklist (string, virtualized), range + slider (number), or a
 * Year›Month›Day tree + range + slider (date). Shown by the Filter dropdown's right pane and the
 * header menu's Filter flyout; owns its view state (value search, value order, shift-click
 * anchor, expanded date nodes), so render it keyed by column.
 */
export function FilterPane<TRow extends object>({
  table,
  data,
  columns,
  col,
}: {
  table: TableState<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
  col: ColumnDef<TRow>
}) {
  const L = table.labels
  const {
    include: filters,
    exclude: excludeFilters,
    ranges: rangeFilters,
    modes: filterModes,
    setMode: setFilterMode,
    setRange: setRangeFilter,
  } = table.filter
  const [searchTerm, setSearchTerm] = useState('')
  const [anchor, setAnchor] = useState<string | null>(null)
  const [expandedDateNodes, setExpandedDateNodes] = useState<Set<string>>(new Set())
  const [valueSort, setValueSort] = useState<ValueSort>(col.defaultValueSort ?? DEFAULT_VALUE_SORT)
  const [filterListScrollTop, setFilterListScrollTop] = useState(0)
  const filterListRef = useRef<HTMLDivElement>(null)
  const filterListRafPending = useRef(false)
  const filterSelectAllRef = useRef<HTMLInputElement>(null)
  const filterOthersRef = useRef<HTMLInputElement>(null)

  const allValues = useMemo(
    () => (col.type !== 'number' ? computeStringValues(data, col, L.emptyValue) : []),
    [data, col, L.emptyValue],
  )
  const valueCounts = computeStringValueCounts(
    data,
    col,
    filters,
    rangeFilters,
    columns,
    L.emptyValue,
    excludeFilters,
    filterModes,
  )
  // Bounds are the column's actual min/max across the full, unfiltered `data` (not
  // filtered/processed data) — see computeValueBounds — so they don't shift under a mid-drag
  // user just because some other filter narrowed the row set. Computed once by the caller (see
  // filterDetailBounds below) and shared with the plain min/max inputs' own default value, rather
  // than recomputed here on every render.
  const renderRangeSliderFor = (
    col: ColumnDef<TRow>,
    bounds: { min: number; max: number } | null,
    minLabel: string,
    maxLabel: string,
  ) => {
    if (!bounds || bounds.min >= bounds.max) return null
    const rf = rangeFilters[col.key]
    const geo = computeRangeSliderGeometry(rf, bounds, col.type === 'date')
    return (
      <RangeSlider
        bounds={bounds}
        low={geo.low}
        high={geo.high}
        step={geo.step}
        pctLo={geo.pctLo}
        pctHi={geo.pctHi}
        minLabel={minLabel}
        maxLabel={maxLabel}
        onChange={(lo, hi) => {
          setRangeFilter(col.key, 'min', formatRangeBound(lo, col))
          setRangeFilter(col.key, 'max', formatRangeBound(hi, col))
        }}
      />
    )
  }
  // The min/max inputs (+ slider below them) for a number/date range filter; value, placeholder
  // and name come from core's rangeInputProps
  const renderRangeInputsFor = (
    col: ColumnDef<TRow>,
    bounds: { min: number; max: number } | null,
  ) => {
    const isDate = col.type === 'date'
    const min = rangeInputProps(col, 'min', rangeFilters[col.key], bounds, L.min)
    const max = rangeInputProps(col, 'max', rangeFilters[col.key], bounds, L.max)
    const activePreset = matchingRangePreset(col, rangeFilters[col.key])
    return (
      <div style={{ padding: '4px 14px 8px' }}>
        {!isDate && !!col.rangePresets?.length && (
          <div className="dt-range-presets">
            {col.rangePresets.map((preset) => {
              const pressed = preset === activePreset
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`dt-value-sort-btn dt-range-preset${pressed ? ' dt-filter-match-mode--active' : ''}`}
                  aria-pressed={pressed}
                  onClick={() => {
                    const range = pressed ? { min: '', max: '' } : rangePresetFilter(preset)
                    setRangeFilter(col.key, 'min', range.min)
                    setRangeFilter(col.key, 'max', range.max)
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type={isDate ? 'date' : 'number'}
            className="dt-range-input"
            placeholder={min.placeholder}
            aria-label={min.ariaLabel}
            value={min.value}
            onChange={(e) => setRangeFilter(col.key, 'min', e.target.value)}
          />
          <span className="dt-range-sep">–</span>
          <input
            type={isDate ? 'date' : 'number'}
            className="dt-range-input"
            placeholder={max.placeholder}
            aria-label={max.ariaLabel}
            value={max.value}
            onChange={(e) => setRangeFilter(col.key, 'max', e.target.value)}
          />
        </div>
        {renderRangeSliderFor(col, bounds, min.ariaLabel, max.ariaLabel)}
      </div>
    )
  }
  const filterDetailBounds =
    col.type === 'number' || col.type === 'date' ? computeValueBounds(data, col) : null
  // Any/all match-mode control — only meaningful for a column whose values are actually
  // array-shaped in the data (see isMultiValueColumn's own doc comment), and only for the
  // string checklist, not the date tree (mirrors Solid's FilterDropdown.tsx).
  const isMultiValueFilterCol = isMultiValueColumnCached(data, col)
  // A non-multi-value column's checklist uses a checked-by-default, exclude-only model instead
  // of the tri-state include/exclude cycle (see docs/filter-dropdown.md's "Filter dropdown"): `filters` is
  // never written for such a column, "checked" simply means "not in `excludeFilters`". Date/
  // number columns (their own detail branches) and genuinely multi-value columns keep the
  // original include-based model untouched. Mirrors Solid's `usesExcludeOnly`.
  const usesExcludeOnly = col.type !== 'date' && col.type !== 'number' && !isMultiValueFilterCol
  // The set a value must be in to stay visible even at a 0 facet count (see
  // filterValuesByCount) — whichever map the active column's model actually writes to.
  const filterAlreadyTouched = (col: ColumnDef<TRow>) =>
    usesExcludeOnly
      ? (excludeFilters[col.key] ?? new Set<string>())
      : (filters[col.key] ?? new Set<string>())
  const matchMode = filterMatchMode(filterModes, col.key, col)
  const cycleFilterValueSort = () =>
    setValueSort(
      col.type === 'date'
        ? { ...valueSort, dir: toggleValueSortDir(valueSort.dir) }
        : cycleValueSort(valueSort),
    )
  // Range/count-filtered, but not yet narrowed by the checklist's own value search — kept
  // separate from filterDetailValues below so filterOtherValues can diff the two to find exactly
  // what the search is currently hiding. Order relative to search doesn't matter here: range/
  // count filtering and search are independent per-value predicates, so computing them in either
  // order yields the same final set. Mirrors Solid's detailValuesBeforeSearch.
  const detailValuesBeforeSearch =
    col.type !== 'number'
      ? filterValuesByCount(
          // Narrowed by the date range filter (if any) — a value outside the active range never
          // becomes a tree leaf, rather than merely being ANDed onto the final row set once
          // ticked. A no-op for string columns (they never populate rangeFilters).
          filterValuesByRange(allValues, rangeFilters[col.key], col.parseDate),
          valueCounts,
          filterAlreadyTouched(col),
        )
      : []
  const filterDetailValues =
    col.type !== 'number'
      ? sortFilterValues(
          filterValuesBySearch(detailValuesBeforeSearch, searchTerm),
          valueCounts,
          valueSort,
          col.compare,
        )
      : []
  // "Others" — the values the checklist's own value search is currently hiding (see docs/filter-dropdown.md's
  // "Filter dropdown"). Only meaningful once a search term actually narrows the list; empty
  // otherwise.
  const filterOtherValues = (() => {
    if (!searchTerm) return []
    const shown = new Set(filterDetailValues)
    return detailValuesBeforeSearch.filter((v) => !shown.has(v))
  })()
  const filterBulkState = (values: string[]) =>
    checklistBulkState(
      values,
      (usesExcludeOnly ? excludeFilters : filters)[col.key],
      usesExcludeOnly,
    )
  const { checked: filterAllSelected, indeterminate: filterSomeSelected } =
    filterBulkState(filterDetailValues)
  const filterOthersState = filterBulkState(filterOtherValues)

  useEffect(() => {
    if (filterSelectAllRef.current) filterSelectAllRef.current.indeterminate = filterSomeSelected
  }, [filterSomeSelected])

  useEffect(() => {
    if (filterOthersRef.current)
      filterOthersRef.current.indeterminate = filterOthersState.indeterminate
  }, [filterOthersState.indeterminate])

  // Reset the virtualized checklist's scroll position whenever the values it's scrolled
  // through change identity — switching columns or narrowing by search both shift what row 0
  // even means, so staying scrolled to the same pixel offset would show an unrelated slice.
  // Comparing against the previous render (rather than an effect) is React's own documented
  // pattern for "adjust state when a prop changes" — https://react.dev/reference/react/useState#storing-information-from-previous-renders —
  // and avoids the cascading-render lint error a setState-in-effect would trigger.
  const filterListResetKey = searchTerm
  const [prevFilterListResetKey, setPrevFilterListResetKey] = useState(filterListResetKey)
  if (filterListResetKey !== prevFilterListResetKey) {
    setPrevFilterListResetKey(filterListResetKey)
    setFilterListScrollTop(0)
  }
  // Keyed on filterListResetKey, NOT filterListScrollTop — this only needs to imperatively move
  // the DOM's scroll position when we're the ones forcing it back to 0 above. Keying it on
  // filterListScrollTop instead (every state update, including ones the user's own scrolling
  // just caused) re-applies a snapshot of scrollTop taken at a slightly earlier point in time on
  // every scroll-driven re-render, fighting the live native scroll and making it flicker back —
  // in practice, feeling like the list won't scroll at all.
  useEffect(() => {
    if (filterListRef.current) filterListRef.current.scrollTop = 0
  }, [filterListResetKey])

  const filterListVirtualRange = computeVirtualRange(
    filterListScrollTop,
    FILTER_LIST_VIEWPORT_HEIGHT,
    FILTER_LIST_ITEM_HEIGHT,
    filterDetailValues.length,
  )

  // Up/Down/Home/End on the flat checklist (see handleFilterPanelKeyDown below) needs to reach a
  // value that isn't currently rendered — the list is virtualized (see filterListVirtualRange
  // above), so only a scrolled-into-view window of rows actually exists in the DOM at any
  // moment. Scrolling there is a state update (setFilterListScrollTop), which re-renders
  // asynchronously — the row to focus can't be reached via a ref until that render commits, so
  // it's stashed here and a layout effect below (keyed on filterListScrollTop, the same shape as
  // pendingFocusTarget/[page] elsewhere in this file) picks it up once the new window's rows are
  // actually mounted.
  const pendingFilterValueFocus = useRef<{ value: string; onExclude: boolean } | null>(null)
  // The checkbox of `value`'s row, or its ≠ button
  const focusChecklistValue = (value: string, onExclude: boolean) => {
    const selector = onExclude ? '[data-dd-value-exclude]' : 'input[data-dd-value-row]'
    for (const el of filterListRef.current?.querySelectorAll<HTMLElement>(selector) ?? []) {
      if (el.dataset.value === value) {
        el.focus()
        break
      }
    }
  }
  useLayoutEffect(() => {
    if (!pendingFilterValueFocus.current) return
    const { value, onExclude } = pendingFilterValueFocus.current
    pendingFilterValueFocus.current = null
    focusChecklistValue(value, onExclude)
  }, [filterListScrollTop])

  const focusChecklistIndex = (targetIdx: number, onExclude: boolean) => {
    if (targetIdx < 0 || targetIdx >= filterDetailValues.length) return
    const value = filterDetailValues[targetIdx]
    const newScrollTop = getVirtualScrollTarget(
      filterListScrollTop,
      FILTER_LIST_VIEWPORT_HEIGHT,
      FILTER_LIST_ITEM_HEIGHT,
      targetIdx,
    )
    if (newScrollTop !== null) {
      pendingFilterValueFocus.current = { value, onExclude }
      if (filterListRef.current) filterListRef.current.scrollTop = newScrollTop
      setFilterListScrollTop(newScrollTop)
      return
    }
    // Already in the rendered window — focus directly, no need to wait for a re-render.
    focusChecklistValue(value, onExclude)
  }

  // Up/Down/Home/End over the value search and the checklist or date tree rows
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey) return
    const filterDetailEl = e.currentTarget
    // ←/→ cross between a value's checkbox and its ≠ button; ← from the checkbox leaves the pane
    const target = e.target as HTMLElement
    const partner = (selector: string) =>
      target.parentElement?.closest('div')?.querySelector<HTMLElement>(selector)
    if (e.key === 'ArrowRight' && target.matches('input[data-dd-value-row]')) {
      const button = partner('[data-dd-value-exclude]')
      if (button) {
        e.preventDefault()
        button.focus()
      }
      return
    }
    if (e.key === 'ArrowLeft' && target.matches('[data-dd-value-exclude]')) {
      e.preventDefault()
      e.stopPropagation()
      partner('input[data-dd-value-row]')?.focus()
      return
    }
    // Only the value search joins the vertical chain; select-all and the sort button sit beside it
    const focusables = Array.from(
      filterDetailEl.querySelectorAll<HTMLElement>(FILTER_DETAIL_NAV_SELECTOR),
    )
    const rows = focusables.filter((el) => !el.matches('input[data-dd-value-search]'))
    const active = document.activeElement as HTMLElement | null
    // Up/Down from a ≠ button stays in the ≠ column
    const onExclude = !!active?.matches('[data-dd-value-exclude]')
    if (!active || (!focusables.includes(active) && !onExclude)) return

    // The flat checklist is virtualized: a value outside the rendered window (or Home/End) needs
    // focusChecklistIndex's scroll-then-focus; the date tree is fully mounted, so DOM order works
    if (filterListRef.current && col.type !== 'date') {
      const i = checklistNavIndex(e.key, filterDetailValues, active.dataset.value)
      if (i !== null) {
        e.preventDefault()
        e.stopPropagation()
        focusChecklistIndex(i, onExclude)
        return
      }
    }

    const next = rovingFocusTarget(e.key, focusables, active, rows)
    if (!next) return
    e.preventDefault()
    e.stopPropagation()
    next.focus()
  }

  const filterDetailTree =
    col.type === 'date'
      ? computeDateTree(filterDetailValues, L.emptyValue, valueSort.dir, col.parseDate)
      : []
  const toggleDateNodeExpand = (path: string) =>
    setExpandedDateNodes((prev) => toggleCollapse(prev, path))
  const renderDateTreeNodes = (
    nodes: DateTreeNode[],
    colKey: string,
    depth: number,
    parseDate: ((value: string) => number) | undefined,
  ): ReactNode => {
    const searchActive = searchTerm !== ''
    return nodes.map((node) => {
      const state = getDateTreeNodeState(node, filters[colKey] ?? new Set())
      const isLeaf = node.children.length === 0
      const expanded = searchActive || expandedDateNodes.has(node.path)
      const label = formatDateTreeLabel(node.key, depth)
      return (
        <div key={node.path}>
          <label className="dt-date-tree-item" style={{ paddingLeft: 14 + depth * 16 }}>
            {isLeaf ? (
              <span className="dt-date-tree-toggle" />
            ) : (
              <span
                className="dt-date-tree-toggle dt-date-tree-toggle--branch"
                onClick={(e) => {
                  e.preventDefault()
                  toggleDateNodeExpand(node.path)
                }}
              >
                {expanded ? '▼' : '▶'}
              </span>
            )}
            <input
              type="checkbox"
              data-dd-value-row
              checked={state === 'checked'}
              readOnly
              ref={(el) => {
                if (el) el.indeterminate = state === 'indeterminate'
              }}
              onClick={(e) => {
                clickDateTreeNode(table.filter, colKey, node, e.shiftKey, {
                  anchorPath: anchor,
                  tree: filterDetailTree,
                  values: filterDetailValues,
                  include: filters[colKey],
                  parseDate,
                })
                setAnchor(node.path)
              }}
            />
            <span className="dt-flex1">{label}</span>
            <span className="dt-filter-count" aria-hidden="true">
              {sumDateTreeNodeCount(node, valueCounts)}
            </span>
          </label>
          {!isLeaf && expanded && renderDateTreeNodes(node.children, colKey, depth + 1, parseDate)}
        </div>
      )
    })
  }

  return (
    <div className="dt-filter-detail" data-filter-detail onKeyDown={handleKeyDown}>
      {col.type === 'number' ? (
        renderRangeInputsFor(col, filterDetailBounds)
      ) : (
        <>
          {col.type === 'date' && renderRangeInputsFor(col, filterDetailBounds)}
          <div className="dt-filter-search-row">
            {filterDetailValues.length > 0 && (
              <input
                ref={filterSelectAllRef}
                type="checkbox"
                checked={filterAllSelected}
                onChange={() =>
                  toggleChecklistValues(table.filter, col.key, filterDetailValues, usesExcludeOnly)
                }
                title={L.selectAll}
                aria-label={L.selectAll}
              />
            )}
            <span className="dt-dd-search-wrap">
              <input
                type="text"
                className="dt-dd-search"
                data-dd-value-search
                placeholder={L.filterSearchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && e.currentTarget.value !== '') {
                    e.preventDefault()
                    e.stopPropagation()
                    setSearchTerm('')
                  }
                }}
              />
              {searchTerm !== '' && (
                <button
                  type="button"
                  className="dt-dd-search-clear"
                  title={L.clearSearch}
                  aria-label={L.clearSearch}
                  onClick={() => setSearchTerm('')}
                >
                  ×
                </button>
              )}
            </span>
            <button
              type="button"
              className="dt-value-sort-btn"
              onClick={cycleFilterValueSort}
              title={L.sortValues}
              aria-label={L.sortValues}
            >
              {col.type === 'date' ? getDateSortIcon(valueSort.dir) : getValueSortIcon(valueSort)}
            </button>
            {isMultiValueFilterCol && (
              <div className="dt-filter-match-mode-group" role="group">
                <button
                  type="button"
                  onClick={() => setFilterMode(col.key, 'or')}
                  title={L.filterMatchAny}
                  aria-label={L.filterMatchAny}
                  aria-pressed={matchMode === 'or'}
                  className={`dt-value-sort-btn dt-filter-match-mode dt-filter-match-mode--left${matchMode === 'or' ? ' dt-filter-match-mode--active' : ''}`}
                >
                  {L.filterMatchAny}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode(col.key, 'and')}
                  title={L.filterMatchAll}
                  aria-label={L.filterMatchAll}
                  aria-pressed={matchMode === 'and'}
                  className={`dt-value-sort-btn dt-filter-match-mode dt-filter-match-mode--right${matchMode === 'and' ? ' dt-filter-match-mode--active' : ''}`}
                >
                  {L.filterMatchAll}
                </button>
              </div>
            )}
          </div>
          {col.type === 'date' ? (
            <div className="dt-date-tree-wrap">
              {renderDateTreeNodes(filterDetailTree, col.key, 0, col.parseDate)}
            </div>
          ) : (
            (() => {
              // Virtualized: only the rows scrolled into view (+ overscan) are
              // ever mounted, regardless of how many thousands of distinct values
              // filterDetailValues holds — see computeVirtualRange/FILTER_LIST_*.
              // Select-all/shift-range above still operate on the full array, so
              // behavior is unaffected by how much of it is actually rendered.
              const { startIndex, endIndex, offsetY, totalHeight } = filterListVirtualRange
              return (
                <>
                  {/* Bulk (de)select everything the value search above is
                                    currently hiding — see docs/filter-dropdown.md's "Filter dropdown". Only
                                    rendered once a search term actually narrows the list. Not
                                    extended to the date tree, which has its own branch above. */}
                  {filterOtherValues.length > 0 && (
                    <label className="dt-dd-item dt-filter-others">
                      <input
                        ref={filterOthersRef}
                        type="checkbox"
                        title={L.filterOthers}
                        aria-label={L.filterOthers}
                        checked={filterOthersState.checked}
                        readOnly
                        // No preventDefault, like the value rows: the browser reverts a prevented
                        // click after React's update, leaving the box stale
                        onClick={() => {
                          toggleChecklistValues(
                            table.filter,
                            col.key,
                            filterOtherValues,
                            usesExcludeOnly,
                          )
                        }}
                      />
                      <span className="dt-flex1">{L.filterOthers}</span>
                      <span className="dt-filter-count" aria-hidden="true">
                        {filterOtherValues.length}
                      </span>
                    </label>
                  )}
                  <div
                    ref={filterListRef}
                    className="dt-filter-list"
                    onScroll={() => {
                      if (!filterListRafPending.current) {
                        filterListRafPending.current = true
                        requestAnimationFrame(() => {
                          filterListRafPending.current = false
                          // Read the live scrollTop here (not a value captured back
                          // in the triggering onScroll call) — several scroll events
                          // can fire before this callback runs, and only the latest
                          // position matters.
                          if (filterListRef.current) {
                            setFilterListScrollTop(filterListRef.current.scrollTop)
                          }
                        })
                      }
                    }}
                  >
                    <div style={{ height: totalHeight, position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          top: offsetY,
                          left: 0,
                          right: 0,
                        }}
                      >
                        {filterDetailValues.slice(startIndex, endIndex).map((v) => {
                          // Non-multi-value column: "checked" means "not excluded".
                          // Multi-value column: the checkbox includes, the ≠ button excludes.
                          const checked = usesExcludeOnly
                            ? !(excludeFilters[col.key]?.has(v) ?? false)
                            : (filters[col.key]?.has(v) ?? false)
                          const excluded = usesExcludeOnly
                            ? false
                            : (excludeFilters[col.key]?.has(v) ?? false)
                          const itemTitle = usesExcludeOnly
                            ? checked
                              ? L.filterValueHideTitle
                              : L.filterValueShowTitle
                            : undefined
                          const excludeLabel = L.excludeValue(
                            formatFilterValue(col, v, L.emptyValue),
                          )
                          return (
                            <div
                              key={v}
                              className={`dt-dd-item${excluded ? ' dt-dd-item--exclude' : ''}`}
                              style={{ height: FILTER_LIST_ITEM_HEIGHT, boxSizing: 'border-box' }}
                            >
                              <label className="dt-filter-value">
                                <input
                                  type="checkbox"
                                  data-dd-value-row
                                  data-value={v}
                                  checked={checked}
                                  readOnly
                                  onClick={(e) => {
                                    clickChecklistValue(table.filter, col.key, v, e.shiftKey, {
                                      anchor,
                                      values: filterDetailValues,
                                      include: filters[col.key],
                                      exclude: excludeFilters[col.key],
                                      excludeOnly: usesExcludeOnly,
                                    })
                                    setAnchor(v)
                                  }}
                                  title={itemTitle}
                                />
                                <span className="dt-flex1">
                                  {col.renderFilterLabel
                                    ? col.renderFilterLabel(v)
                                    : formatFilterValue(col, v, L.emptyValue)}
                                </span>
                                <span className="dt-filter-count" aria-hidden="true">
                                  {valueCounts.get(v) ?? 0}
                                </span>
                              </label>
                              {!usesExcludeOnly && (
                                <button
                                  type="button"
                                  className="dt-filter-exclude"
                                  data-dd-value-exclude
                                  data-value={v}
                                  aria-pressed={excluded}
                                  aria-label={excludeLabel}
                                  title={excludeLabel}
                                  onClick={() =>
                                    toggleChecklistExclude(
                                      table.filter,
                                      col.key,
                                      v,
                                      excludeFilters[col.key],
                                    )
                                  }
                                >
                                  ≠
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()
          )}
        </>
      )}
    </div>
  )
}
