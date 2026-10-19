import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useInsertionEffect,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  computeAggregate,
  computeStringValueCounts,
  isMultiValueColumnCached,
  isExcludeOnlyColumn,
  exclusionChip,
  getColumnValue,
  rowText,
  groupText,
  filterValuesBySearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  computeRangeSliderGeometry,
  formatRangeBound,
  rangeInputProps,
  matchingRangePreset,
  rangePresetFilter,
  rangeChipText,
  categorizedAlphabetizedByLabel,
  alphabetizedByLabel,
  formatDateTreeLabel,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir as toggleValueSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  isGroupCollapsed,
  isSameVisibleItem,
  indexOfVisibleItem,
  paginateVisibleItems,
  pageSizeOptions,
  showsPager,
  checklistBulkState,
  clickChecklistValue,
  toggleChecklistExclude,
  clickDateTreeNode,
  toggleChecklistValues,
  computeVirtualRange,
  getVirtualScrollTarget,
  getCrossPageFocusTarget,
  getSortIndex as getHeaderSortIndex,
  getSortIcon as getHeaderSortIcon,
  summarizeFilterValues,
  filterMatchMode,
  chipSeparator,
  formatFilterValue,
  columnHasActiveFilter,
  orderFilterColumnsByActive,
  applyColumnOrderSnapshot,
  columnMatchesSearch,
  groupColumnsByCategory,
  getHeaderMenuItems,
  watchMedia,
  FILTER_NARROW_QUERY,
  injectStyles,
  type VisibleItem,
  type DateTreeNode,
} from '@vates/data-table-core/internal'
import type { ValueSort, SortEntry } from '@vates/data-table-core'
import { Dropdown } from './components/Dropdown'
import { CategorySubmenu } from './components/CategorySubmenu'
import { HeaderMenu } from './components/HeaderMenu'
import { ToolbarBtn } from './components/ToolbarBtn'
import { useDropdownReorder } from './hooks/useDropdownReorder'
import type { ColumnDef, DataTableViewProps } from './types'
import type { TableState } from './useTableState'

// Fixed row height for the filter dropdown's virtualized checklist (see computeVirtualRange) —
// must match the actual rendered height of a checklist row exactly, which is why each row gets
// an explicit inline height below instead of relying on ddItem's padding + line-height.
const FILTER_LIST_ITEM_HEIGHT = 32
// The checklist itself no longer has a fixed height (see filterList below, which flex-fills
// filterDetail instead) — this is now only the *assumed* viewport height fed to
// computeVirtualRange's windowing math. Safe to leave un-measured: filterPanel's own
// maxHeight:380 bounds how much taller the checklist can actually grow past this default, well
// within computeVirtualRange's own overscan margin (see filterList's comment for the full math).
const FILTER_LIST_VIEWPORT_HEIGHT = 260

const S = {
  // Always rendered below the toolbar — see "Active state bar" at the render call site — so the
  // stats text has one stable home instead of bouncing between "end of the toolbar row" and
  // nowhere, and toggling a sort/filter/group never changes the toolbar's height.
  activeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    padding: '10px 0',
  } as CSSProperties,
  stats: {
    marginLeft: 'auto',
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  } as CSSProperties,
  ddItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    cursor: 'pointer',
    fontSize: 'var(--font-size-md, 13px)',
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  filterCount: {
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--color-text-tertiary)',
  } as CSSProperties,
  // A multi-value checklist row whose value is excluded (its ≠ button pressed)
  filterValueExcluded: {
    color: 'var(--color-text-danger)',
  } as CSSProperties,
  filterValue: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    cursor: 'pointer',
  } as CSSProperties,
  filterExclude: {
    flexShrink: 0,
    width: 24,
    height: 24,
    margin: '-3px -8px -3px 0',
    padding: 0,
    border: '0.5px solid transparent',
    borderRadius: 4,
    background: 'none',
    font: 'inherit',
    fontSize: 'var(--font-size-lg, 14px)',
    lineHeight: 1,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  } as CSSProperties,
  filterExcludePressed: {
    background: 'var(--color-background-danger)',
    borderColor: 'var(--color-border-danger)',
    color: 'var(--color-text-danger)',
  } as CSSProperties,
  // The "Others" checklist row (see docs/filter-dropdown.md's "Filter dropdown") — shaded/italic/bordered so it
  // reads as a distinct bulk control, not just another value blending into the results below it.
  filterOthers: {
    background: 'var(--color-background-secondary)',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    borderBottom: '0.5px solid var(--color-border-secondary)',
    fontStyle: 'italic',
    color: 'var(--color-text-secondary)',
  } as CSSProperties,
  // A chip is two sibling <button>s (chipBody + chipX below), not one inert <span> — a <button>
  // can't contain another interactive element, same reasoning already used for the toolbar's
  // grouped clear buttons (btnClear). `chip` itself carries no padding/background/border anymore;
  // that moved onto chipBody/chipX individually, each keeping only its own outer corner rounded
  // and sharing a border between them so the pair still reads as one pill.
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 'var(--font-size-sm, 12px)',
  } as CSSProperties,
  chipBody: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRight: 'none',
    borderRadius: '12px 0 0 12px',
    padding: '2px 4px 2px 8px',
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    lineHeight: 1.4,
    minHeight: 24,
  } as CSSProperties,
  chipX: {
    cursor: 'pointer',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: '0 12px 12px 0',
    padding: '2px 8px 2px 2px',
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    // 24 px touch target (docs/ui-guidelines.md)
    minHeight: 24,
    minWidth: 24,
  } as CSSProperties,
  // The one deliberate color accent in the active bar — filters already carried this "narrowing
  // your view" meaning before sort/group chips existed, so they keep it; sort/group chips reuse
  // the plain neutral `chipBody`/`chipX` above. Applied to both halves of the pill, same as
  // vanilla's `.dt-chip--filter .dt-chip-body, .dt-chip--filter .dt-chip-x`.
  chipFilter: {
    background: 'var(--color-background-info)',
    color: 'var(--color-text-info)',
    border: '0.5px solid var(--color-border-info)',
  } as CSSProperties,
  // Exclude filters get their own tint, distinct from the plain include chipFilter above — same
  // "≠" prefix + danger-tinted convention as vanilla's `.dt-chip--exclude`.
  chipExclude: {
    background: 'var(--color-background-danger)',
    color: 'var(--color-text-danger)',
    border: '0.5px solid var(--color-border-danger)',
  } as CSSProperties,
  rangeInput: {
    width: 80,
    padding: '3px 6px',
    fontSize: 'var(--font-size-sm, 12px)',
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
    padding: '5px 9px',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 'var(--font-size-md, 13px)',
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    lineHeight: 1,
  } as CSSProperties,
  pageBtnDisabled: { opacity: 0.35, cursor: 'default' } as CSSProperties,
  pageInfo: {
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--color-text-secondary)',
    padding: '0 6px',
  } as CSSProperties,
  rowsPerPageGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
  } as CSSProperties,
  rowsPerPageLabel: {
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--color-text-secondary)',
  } as CSSProperties,
  pageSelect: {
    padding: '4px 6px',
    fontSize: 'var(--font-size-sm, 12px)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    cursor: 'pointer',
  } as CSSProperties,
  // A flex column (not just `flex: 1`) so the checklist/date-tree child below can `flex: 1` to
  // fill whatever height `.filterCols` (the column list) ends up stretching this to via the
  // row's cross-axis stretch, instead of a hardcoded height leaving dead space below it once
  // `.filterCols` renders taller than that default (see filterList/filterDateTreeWrap).
  filterDetail: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '6px 0',
    minWidth: 220,
  } as CSSProperties,
  filterSearchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '2px 12px 6px',
    flexShrink: 0,
  } as CSSProperties,
  // `flex: 1` (not a hardcoded height) lets this fill whatever room filterDetail actually has —
  // `FILTER_LIST_VIEWPORT_HEIGHT` remains only the *assumed* viewport height fed to
  // computeVirtualRange's windowing math, not this element's real rendered height. That's safe
  // even when they diverge: filterPanel's own `maxHeight: 380` bounds how much taller this can
  // ever grow past the 260px default (~60-80px, given the search row/padding above it), which is
  // well inside the 5-row (160px) overscan on each side — so the virtualized window always has
  // enough pre-rendered rows to cover the actual visible box, unlike an unbounded panel would.
  // `minHeight: 0` is required for a flex column child to actually shrink/scroll instead of
  // overflowing its container (the default flex `min-height: auto` would let its content push
  // filterDetail taller instead).
  filterList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  } as CSSProperties,
  // Same reasoning as filterList above, applied to the date tree — which has no virtualization
  // of its own, so this wrapper alone is what turns "overflow past the panel onto the page" (no
  // wrapper at all previously) into "fills available space, scrolls the rest".
  filterDateTreeWrap: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  } as CSSProperties,
  ddSearch: {
    display: 'block',
    flex: 1,
    padding: '5px 20px 5px 8px',
    fontSize: 'var(--font-size-sm, 12px)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  } as CSSProperties,
  // Wraps a dropdown search <input> + its own × clear button (see DdSearchInput/the Filter
  // dropdown's own value-search input) — position:relative anchors the clear button's own
  // position:absolute. Merged with `filterColsSearch` below for the Filter dropdown's left pane
  // (that one needs position:sticky instead, applied after this in the object so it wins the
  // merge — see filterColsSearch's own comment).
  ddSearchWrap: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    minWidth: 0,
  } as CSSProperties,
  ddSearchClear: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: 'var(--font-size-md, 13px)',
    lineHeight: 1,
    color: 'var(--color-text-tertiary)',
    fontFamily: 'inherit',
  } as CSSProperties,
  filterSelectAll: {
    flexShrink: 0,
    margin: 0,
  } as CSSProperties,
  valueSortBtn: {
    flexShrink: 0,
    padding: '4px 7px',
    fontSize: 'var(--font-size-xs, 11px)',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  } as CSSProperties,
  // Any/all match-mode segmented control — two buttons sharing valueSortBtn's base look (spread
  // in at the JSX call site, same composition pattern as e.g. renderRangeInputsFor's `inputStyle`
  // above, since a plain object literal can't reference its own other properties). `--left`/
  // `--right` only override the corner radii (and drop the shared middle border on the left one)
  // so the pair reads as one merged pill; `--active` mirrors filterColItemActive's own "engaged"
  // treatment so whichever of Any/All is currently in effect looks consistent with the rest of
  // the UI's existing active-state convention.
  rangePresets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  } as CSSProperties,
  filterMatchModeGroup: {
    display: 'inline-flex',
    flexShrink: 0,
  } as CSSProperties,
  filterMatchModeLeft: {
    borderRadius: '6px 0 0 6px',
    borderRight: 'none',
  } as CSSProperties,
  filterMatchModeRight: {
    borderRadius: '0 6px 6px 0',
  } as CSSProperties,
  filterMatchModeActive: {
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
    fontWeight: 'var(--font-weight-medium, 500)',
  } as CSSProperties,
  dateTreeToggle: {
    width: 14,
    flexShrink: 0,
    textAlign: 'center',
    fontSize: 'var(--font-size-2xs, 10px)',
    color: 'var(--color-text-tertiary)',
  } as CSSProperties,
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

/**
 * Consumes a pending-focus ref (see the `pendingSortFocusKey`/`pendingGroupFocusKey`/
 * `pendingFilterColFocusKey` refs below) and focuses whichever element under `root` carries a
 * matching value on one of `attrs` — a column/entry key can land on either of two possible
 * data-attributes depending on which section (active vs. addable) it's currently rendered in.
 * No-ops if the ref is already empty (nothing pending).
 */
function focusPendingKey(
  root: HTMLElement,
  ref: { current: string | null },
  attrs: string[],
): void {
  if (!ref.current) return
  const key = ref.current
  ref.current = null
  const selector = attrs.map((a) => `[${a}]`).join(', ')
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (attrs.some((a) => el.getAttribute(a) === key)) {
      el.focus()
      break
    }
  }
}

/** Stands in for a column list that a search narrowed to nothing (U26) */
function NoMatchingColumns({ label }: { label: string }) {
  return (
    <div className="dt-dd-no-match" data-dd-no-match>
      {label}
    </div>
  )
}

const RANGE_SLIDER_STYLE_ATTR = 'data-dt-range-slider-styles'
let rangeSliderStylesInjected = false

/**
 * Injects the CSS the range slider below needs — specifically `::-webkit-slider-thumb`/
 * `::-moz-range-thumb`, which style pseudo-elements no inline `style` prop can reach. The rest
 * of this package is styled entirely via inline styles (no stylesheet at all), so this is a
 * deliberate, minimal exception scoped to just one class name — the same "inject once into
 * <head>" precedent the vanilla adapter already uses for its whole stylesheet. Idempotent
 * (checks for an existing tag first, guards a module-level flag against StrictMode's double
 * effect-invoke) and a no-op outside a browser, so it's safe to call from an effect that also
 * runs during SSR hydration.
 */
function ensureRangeSliderStyles(): void {
  if (rangeSliderStylesInjected || typeof document === 'undefined') return
  if (document.querySelector(`style[${RANGE_SLIDER_STYLE_ATTR}]`)) {
    rangeSliderStylesInjected = true
    return
  }
  const style = document.createElement('style')
  style.setAttribute(RANGE_SLIDER_STYLE_ATTR, '')
  style.textContent =
    '.dt-react-range-thumb{-webkit-appearance:none;-moz-appearance:none;appearance:none;pointer-events:none}' +
    '.dt-react-range-thumb::-webkit-slider-runnable-track{background:transparent}' +
    '.dt-react-range-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;pointer-events:auto;width:14px;height:14px;margin-top:4px;border-radius:50%;background:var(--color-text-info);border:2px solid var(--color-background-primary);box-shadow:0 0 0 1px var(--color-border-info);cursor:pointer}' +
    '.dt-react-range-thumb::-moz-range-track{background:transparent;border:none}' +
    '.dt-react-range-thumb::-moz-range-thumb{pointer-events:auto;width:14px;height:14px;border-radius:50%;background:var(--color-text-info);border:2px solid var(--color-background-primary);box-shadow:0 0 0 1px var(--color-border-info);cursor:pointer}'
  document.head.appendChild(style)
  rangeSliderStylesInjected = true
}

/**
 * The "2 inputs + a slider" range control's slider half — two overlapping native
 * <input type="range"> thumbs sharing one visual track (only the thumb itself is a hit target,
 * via ensureRangeSliderStyles above, so grabbing either one works regardless of z-order) plus a
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
  useEffect(() => {
    ensureRangeSliderStyles()
  }, [])
  const handleThumb = (raw: number, other: number) =>
    onChange(Math.min(raw, other), Math.max(raw, other))
  const thumbStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
    height: 22,
    margin: 0,
    background: 'none',
  }
  return (
    <div style={{ position: 'relative', height: 22, margin: '8px 2px 2px' }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 7,
          right: 7,
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: 'var(--color-border-secondary)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: 'var(--color-text-info)',
          left: `${pctLo}%`,
          right: `${100 - pctHi}%`,
        }}
      />
      <input
        type="range"
        className="dt-react-range-thumb"
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={low}
        aria-label={minLabel}
        onChange={(e) => handleThumb(Number(e.target.value), high)}
        style={thumbStyle}
      />
      <input
        type="range"
        className="dt-react-range-thumb"
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={high}
        aria-label={maxLabel}
        onChange={(e) => handleThumb(Number(e.target.value), low)}
        style={thumbStyle}
      />
    </div>
  )
}

/**
 * The Columns/Sort/Group/Filter dropdowns' own column-search box — narrows that dropdown's
 * column list by label, with Escape clearing the term (stopping propagation so it doesn't also
 * close the dropdown itself). Columns/Sort/Group wrap it in a `.dt-dd-search-row`; the Filter
 * dropdown's left pane passes `filterCols` instead, making the input+clear-button pair itself
 * sticky (`.dt-filter-cols-search-wrap`).
 *
 * Also carries its own × clear button (shown only once `value` is non-empty) — previously Escape
 * was the only way to clear it, with no click target for a mouse-only user, unlike the toolbar's
 * own global search box (same idea, reusing the same `clearSearch` label).
 */
function DdSearchInput({
  value,
  onChange,
  placeholder,
  clearLabel,
  filterCols,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
  filterCols?: boolean
}) {
  return (
    <span className={`dt-dd-search-wrap${filterCols ? ' dt-filter-cols-search-wrap' : ''}`}>
      <input
        type="text"
        className={`dt-dd-search${filterCols ? ' dt-filter-cols-search' : ''}`}
        data-dd-search
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && e.currentTarget.value !== '') {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
          }
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className="dt-dd-search-clear"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={() => onChange('')}
        >
          ×
        </button>
      )}
    </span>
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
function FilterPane<TRow extends object>({
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
    valueMap: stringValueMap,
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

  const stringValueCounts = computeStringValueCounts(
    data,
    filters,
    rangeFilters,
    columns,
    L.emptyValue,
    [col.key],
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
    const inputStyle = isDate ? { ...S.rangeInput, width: 118 } : S.rangeInput
    const min = rangeInputProps(col, 'min', rangeFilters[col.key], bounds, L.min)
    const max = rangeInputProps(col, 'max', rangeFilters[col.key], bounds, L.max)
    const activePreset = matchingRangePreset(col, rangeFilters[col.key])
    return (
      <div style={{ padding: '4px 14px 8px' }}>
        {!isDate && !!col.rangePresets?.length && (
          <div style={S.rangePresets}>
            {col.rangePresets.map((preset) => {
              const pressed = preset === activePreset
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => {
                    const range = pressed ? { min: '', max: '' } : rangePresetFilter(preset)
                    setRangeFilter(col.key, 'min', range.min)
                    setRangeFilter(col.key, 'max', range.max)
                  }}
                  style={{
                    ...S.valueSortBtn,
                    minHeight: 24,
                    ...(pressed ? S.filterMatchModeActive : {}),
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
            placeholder={min.placeholder}
            aria-label={min.ariaLabel}
            value={min.value}
            onChange={(e) => setRangeFilter(col.key, 'min', e.target.value)}
            style={inputStyle}
          />
          <span
            style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm, 12px)' }}
          >
            –
          </span>
          <input
            type={isDate ? 'date' : 'number'}
            placeholder={max.placeholder}
            aria-label={max.ariaLabel}
            value={max.value}
            onChange={(e) => setRangeFilter(col.key, 'max', e.target.value)}
            style={inputStyle}
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
          filterValuesByRange(stringValueMap[col.key] ?? [], rangeFilters[col.key], col.parseDate),
          stringValueCounts[col.key] ?? new Map(),
          filterAlreadyTouched(col),
        )
      : []
  const filterDetailValues =
    col.type !== 'number'
      ? sortFilterValues(
          filterValuesBySearch(detailValuesBeforeSearch, searchTerm),
          stringValueCounts[col.key] ?? new Map(),
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
  const filterAllSelected = filterBulkState(filterDetailValues).checked
  const filterSomeSelected = filterBulkState(filterDetailValues).indeterminate
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
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      // Only the value-search box joins the vertical Up/Down chain, mirroring every other
      // dropdown's "search input, then rows" pattern — the select-all checkbox and sort-order
      // button sit beside it on the *same* row (filterSearchRow), not above the rows, so
      // stepping Down/Up through all three before reaching the list would move focus somewhere
      // that doesn't visually correspond to "down". They stay reachable via Tab/click as before.
      const headerControls = Array.from(
        filterDetailEl.querySelectorAll<HTMLElement>('input[data-dd-value-search]'),
      )
      const rowInputs = Array.from(
        filterDetailEl.querySelectorAll<HTMLInputElement>('input[data-dd-value-row]'),
      )
      const focusables = [...headerControls, ...rowInputs]
      const active = document.activeElement as HTMLElement | null
      // Up/Down from a ≠ button stays in the ≠ column
      const onExclude = !!active?.matches('[data-dd-value-exclude]')
      if (!active || (focusables.indexOf(active) === -1 && !onExclude)) return

      // The flat checklist is virtualized — crossing out of the rendered window, or Home/End
      // (which must reach the *logical* first/last value, not just whatever's currently
      // rendered), needs the scroll-then-focus dance in focusChecklistIndex above. The date tree
      // has no such window (every currently-expanded row is already in the DOM), so it falls
      // straight through to the plain DOM-order nav below.
      if (filterListRef.current && col.type !== 'date') {
        const activeValue = active.dataset.value
        let targetIdx: number | null = null
        if (e.key === 'Home') targetIdx = 0
        else if (e.key === 'End') targetIdx = filterDetailValues.length - 1
        else if (activeValue !== undefined) {
          const curIdx = filterDetailValues.indexOf(activeValue)
          targetIdx = e.key === 'ArrowDown' ? curIdx + 1 : curIdx - 1
        }
        if (targetIdx !== null) {
          // Falls through to the plain header-control nav below in two cases: moving Up out of
          // the checklist's very first row (there's no row above it — the previous stop is the
          // value-search box instead), and Home/End on an empty list.
          const fallsThrough = targetIdx < 0 && e.key === 'ArrowUp' && activeValue !== undefined
          if (!fallsThrough) {
            e.preventDefault()
            e.stopPropagation()
            if (targetIdx >= 0 && targetIdx < filterDetailValues.length) {
              focusChecklistIndex(targetIdx, onExclude)
            }
            return
          }
        }
      }

      if (e.key === 'Home' || e.key === 'End') {
        if (rowInputs.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        ;(e.key === 'Home' ? rowInputs[0] : rowInputs[rowInputs.length - 1]).focus()
        return
      }
      const idx = focusables.indexOf(active)
      const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
      if (nextIdx < 0 || nextIdx >= focusables.length) return
      e.preventDefault()
      e.stopPropagation()
      focusables[nextIdx].focus()
    }
  }

  const filterDetailTree =
    col.type === 'date'
      ? computeDateTree(filterDetailValues, L.emptyValue, valueSort.dir, col.parseDate)
      : []
  const toggleDateNodeExpand = (path: string) =>
    setExpandedDateNodes((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
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
          <label style={{ ...S.ddItem, paddingLeft: 14 + depth * 16 }}>
            {isLeaf ? (
              <span style={S.dateTreeToggle} />
            ) : (
              <span
                style={{ ...S.dateTreeToggle, cursor: 'pointer' }}
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

  return (
    <div style={S.filterDetail} data-filter-detail onKeyDown={handleKeyDown}>
      {col.type === 'number' ? (
        renderRangeInputsFor(col, filterDetailBounds)
      ) : (
        <>
          {col.type === 'date' && renderRangeInputsFor(col, filterDetailBounds)}
          <div style={S.filterSearchRow}>
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
                style={S.filterSelectAll}
              />
            )}
            <span style={S.ddSearchWrap}>
              <input
                type="text"
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
                style={S.ddSearch}
              />
              {searchTerm !== '' && (
                <button
                  type="button"
                  title={L.clearSearch}
                  aria-label={L.clearSearch}
                  onClick={() => setSearchTerm('')}
                  style={S.ddSearchClear}
                >
                  ×
                </button>
              )}
            </span>
            <button
              type="button"
              onClick={cycleFilterValueSort}
              title={L.sortValues}
              aria-label={L.sortValues}
              style={S.valueSortBtn}
            >
              {col.type === 'date' ? getDateSortIcon(valueSort.dir) : getValueSortIcon(valueSort)}
            </button>
            {isMultiValueFilterCol && (
              <div style={S.filterMatchModeGroup} role="group">
                <button
                  type="button"
                  onClick={() => setFilterMode(col.key, 'or')}
                  title={L.filterMatchAny}
                  aria-label={L.filterMatchAny}
                  aria-pressed={matchMode === 'or'}
                  style={{
                    ...S.valueSortBtn,
                    ...S.filterMatchModeLeft,
                    ...(matchMode === 'or' ? S.filterMatchModeActive : {}),
                  }}
                >
                  {L.filterMatchAny}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode(col.key, 'and')}
                  title={L.filterMatchAll}
                  aria-label={L.filterMatchAll}
                  aria-pressed={matchMode === 'and'}
                  style={{
                    ...S.valueSortBtn,
                    ...S.filterMatchModeRight,
                    ...(matchMode === 'and' ? S.filterMatchModeActive : {}),
                  }}
                >
                  {L.filterMatchAll}
                </button>
              </div>
            )}
          </div>
          {col.type === 'date' ? (
            <div style={S.filterDateTreeWrap}>
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
                    <label style={{ ...S.ddItem, ...S.filterOthers }}>
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
                      <span style={{ flex: 1 }}>{L.filterOthers}</span>
                      <span style={S.filterCount} aria-hidden="true">
                        {filterOtherValues.length}
                      </span>
                    </label>
                  )}
                  <div
                    ref={filterListRef}
                    style={S.filterList}
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
                              style={{
                                ...S.ddItem,
                                height: FILTER_LIST_ITEM_HEIGHT,
                                boxSizing: 'border-box',
                                ...(excluded ? S.filterValueExcluded : null),
                              }}
                            >
                              <label style={S.filterValue}>
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
                                  style={{ margin: 0 }}
                                />
                                <span
                                  style={{
                                    flex: 1,
                                    textDecoration: excluded ? 'line-through' : undefined,
                                  }}
                                >
                                  {col.renderFilterLabel
                                    ? col.renderFilterLabel(v)
                                    : formatFilterValue(col, v, L.emptyValue)}
                                </span>
                                <span style={S.filterCount} aria-hidden="true">
                                  {stringValueCounts[col.key]?.get(v) ?? 0}
                                </span>
                              </label>
                              {!usesExcludeOnly && (
                                <button
                                  type="button"
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
                                  style={
                                    excluded
                                      ? { ...S.filterExclude, ...S.filterExcludePressed }
                                      : S.filterExclude
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
// A data row's `dt-tr` modifiers; a selected row isn't striped
function rowClass(selected: boolean, odd: boolean, clickable: boolean, current: boolean): string {
  return `dt-tr${selected ? ' dt-tr--selected' : odd ? ' dt-tr--odd' : ''}${clickable ? ' dt-tr--clickable' : ''}${current ? ' dt-tr--current' : ''}`
}

// `.dt-dd-item--drag-over`/`--drag-over-after`: a dropdown row's drop-position line
function dragOverClass(over: boolean, after: boolean): string {
  return over ? (after ? ' dt-dd-item--drag-over-after' : ' dt-dd-item--drag-over') : ''
}

export function DataTableView<TRow extends object>({
  table,
  data,
  columns,
  rowKey,
  selectable,
  onSelectionChange,
  onRowClick,
  currentRow,
  showSearch,
  showColumns,
  toolbarEnd,
}: DataTableViewProps<TRow>) {
  // No theme tokens: React apps define their own (see the README's Theming)
  useInsertionEffect(injectStyles, [])
  const [openColsDD, setOpenColsDD] = useState(false)
  const [openSortDD, setOpenSortDD] = useState(false)
  const [openFilterDD, setOpenFilterDD] = useState(false)
  // Narrow screen (U16): the Filter dropdown shows one pane at a time — columns, or values
  const [narrowFilter, setNarrowFilter] = useState(false)
  useEffect(() => watchMedia(FILTER_NARROW_QUERY, setNarrowFilter), [])
  const hasToolbarEnd = toolbarEnd != null && toolbarEnd !== false
  // On a phone the toolbar wraps: toolbarEnd ends the first line instead of taking a line of its own.
  const endFirst = narrowFilter && hasToolbarEnd
  const [filterShowValues, setFilterShowValues] = useState(false)
  const pendingFilterValuesFocus = useRef(false)
  const [openGroupDD, setOpenGroupDD] = useState(false)
  const rowRefs = useRef(new Map<TRow | string, HTMLTableRowElement>())
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterActiveCol, setFilterActiveCol] = useState<string | null>(null)
  // Narrows the *column list* itself in the Columns/Sort/Group dropdowns and the Filter
  // dropdown's left column pane — a separate concern from `filterSearchTerms` above, which
  // narrows one column's *values* in the Filter dropdown's right detail pane. Keyed by dropdown
  // id ('cols'/'sort'/'group'/'filter'), same ephemeral-UI-state category as `filterActiveCol`.
  const [ddSearchTerms, setDdSearchTerms] = useState<Record<string, string>>({})
  // Root ref purely so the two pending-focus effects below can scope their DOM queries to *this*
  // table instance — a plain `document.querySelector` by column key would risk matching another
  // <DataTable> on the same page whose columns happen to share a key.
  const rootRef = useRef<HTMLDivElement>(null)
  // Focus target after a clear button unmounts itself: the search box, else the first toolbar button.
  const focusSearch = () =>
    (searchInputRef.current ?? rootRef.current?.querySelector('button'))?.focus()
  // Activating an addable Sort/Group column (or removing an active one) moves its row between
  // the active and addable sections — a different DOM element, since they're different JSX
  // subtrees (not just a reordered list React could keep the same node for), so the button/row
  // that had focus at click time unmounts and focus is otherwise dropped. `sorts`/`groupBy`
  // updates are async (the new element doesn't exist until the next commit), so the key to
  // refocus is stashed here and picked up by a `useLayoutEffect` right after that commit — same
  // "can't focus synchronously across an async state update" shape as `pendingFocusTarget` above.
  const pendingSortFocusKey = useRef<string | null>(null)
  const pendingGroupFocusKey = useRef<string | null>(null)
  // Same shape, for the active-bar Group/Filter chip bodies (see "Active-bar chip click
  // actions" below): clicking one opens its dropdown — a panel that doesn't exist in the DOM
  // yet at click time — so the row/button to focus inside it can't be reached until the
  // open-state update commits and the panel actually mounts. `pendingGroupFocusKey` is reused as-
  // is for the Group chip (it already matches on `data-group-key`, exactly the row a newly-opened
  // Group dropdown renders); Filter gets its own ref since there's no equivalent existing one.
  const pendingFilterColFocusKey = useRef<string | null>(null)
  // Same shape, for the Columns dropdown: showing a column refocuses its new Visible row
  // (data-col-row-key); hiding one refocuses whatever it reappears as in Available — its own
  // addable row (data-col-key) if uncategorized, or its category's submenu trigger
  // (data-category-header) if not, since a categorized column has no addable row of its own
  // rendered while its submenu stays closed. A single ref covers all three since the stashed
  // value is either a column key or a category name, and matching is exact-string against
  // whichever attribute is present on a given element.
  const pendingColFocusKey = useRef<string | null>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    focusPendingKey(root, pendingSortFocusKey, ['data-sort-key', 'data-sort-add-key'])
    focusPendingKey(root, pendingGroupFocusKey, ['data-group-key', 'data-group-add-key'])
    focusPendingKey(root, pendingFilterColFocusKey, ['data-filter-col-key'])
    if (pendingFilterValuesFocus.current) {
      pendingFilterValuesFocus.current = false
      // A number column has no value rows: fall back to the back button
      ;(
        root.querySelector<HTMLElement>(
          '[data-filter-detail] input, [data-filter-detail] button',
        ) ?? root.querySelector<HTMLElement>('[data-filter-back]')
      )?.focus()
    }
    focusPendingKey(root, pendingColFocusKey, [
      'data-col-row-key',
      'data-col-key',
      'data-category-header',
    ])
  })
  // Hides `col`, refocusing whatever it reappears as in Available — shared by a visible row's own
  // × button and its Delete/Backspace keyboard equivalent (see pendingColFocusKey's own comment
  // above for why a category name and a column key are both valid values to stash here). While
  // searching, a categorized column reappears flattened out of its submenu (see the render below)
  // — its own addable row, not the category's — so the category-name target only applies when
  // *not* currently searching.
  function hideColumn(col: ColumnDef<TRow>): void {
    pendingColFocusKey.current = col.category && !isColsSearching ? col.category : col.key
    toggleColVisibility(col.key)
  }
  // Which category submenu is open, one independent value per dropdown — a single shared value
  // (not one per CategorySubmenu instance) so opening one category always closes any other that
  // was open in the same dropdown, see CategorySubmenu.tsx's own doc.
  const [openSortCategory, setOpenSortCategory] = useState<string | null>(null)
  const [openGroupCategory, setOpenGroupCategory] = useState<string | null>(null)
  const [openColsCategory, setOpenColsCategory] = useState<string | null>(null)
  // `table`'s own fields are namespaced by concern (see docs/table-state.md's "Namespaced TableState") —
  // destructured here into the same bare local names this component's ~2600 lines already use
  // throughout, so nothing below this block needed to change when the namespacing landed.
  const { processedData, groupedData, visibleItems, labels: L, clearAll } = table
  const {
    visible: visibleCols,
    active: activeColumns,
    ordered: orderedColumns,
    toggleVisibility: toggleColVisibility,
    move: moveColumn,
    moveVisibleBy: moveVisibleColumnBy,
  } = table.columns
  const {
    entries: sorts,
    toggle: toggleSort,
    replace: replaceSort,
    appendOrToggle: appendOrToggleSort,
    remove: removeSort,
    toggleDir: toggleSortDir,
    move: moveSort,
    clear: clearSorts,
    icon: getSortIcon,
    index: getSortIndex,
  } = table.sort
  const {
    include: filters,
    exclude: excludeFilters,
    ranges: rangeFilters,
    modes: filterModes,
    activeCount: activeFilterCount,
    clearColumn: clearColumnFilter,
    clear: clearFilters,
  } = table.filter
  const {
    by: groupBy,
    collapsed: collapsedGroups,
    defaultCollapsed: defaultGroupsCollapsed,
    toggle: toggleGroup,
    remove: removeGroup,
    moveBy: moveGroupBy,
    move: moveGroup,
    toggleCollapse: toggleGroupCollapse,
    clear: clearGroups,
  } = table.group
  // `focusTarget`/`setFocusTarget` used to be local state here — lifted to `useTableState`
  // (`table.focus.target`/`setTarget`) so it's reachable/settable from outside the rendered
  // table (see `focus.moveTo`'s own doc comment there); everything below still reads/writes it
  // through these same bare local names.
  const { target: focusTarget, setTarget: setFocusTarget, consumeDomFocus } = table.focus

  // Split for the Sort dropdown's active list (see "Auto-syncing group order with sort" in
  // docs/grouped-columns.md): entries matching a currently grouped column always govern nesting order via
  // `groupBy`'s own order, never via drag position within `sorts` — mixing them into one flat
  // draggable list made dragging a tie-break column above a group column look like it did
  // something when it never could (issue #17's follow-up). `groupSortEntries` is in `groupBy`'s
  // own order (skipping a grouped column with no matching sort entry); `nonGroupSortEntries` is
  // the actual freely-reorderable tie-break priority stack.
  const groupSortEntries = groupBy
    .map((key) => sorts.find((s) => s.key === key))
    .filter((s): s is SortEntry => s !== undefined)
  const nonGroupSortEntries = sorts.filter((s) => !groupBy.includes(s.key))

  // Kept independent from dragColKey/dragOverColKey above (the <th> header drag state), even
  // though both ultimately reorder columnOrder — mirrors vanilla giving each dropdown its own
  // drag state instead of a shared one.
  const {
    dragOverKey: dragOverColRowKey,
    dragOverAfter: dragOverColRowAfter,
    onRowDragStart: onColRowDragStart,
    onRowDragEnd: onColRowDragEnd,
    onDragOver: onColRowsDragOver,
    onDrop: onColRowsDrop,
  } = useDropdownReorder('data-col-row-key', moveColumn)
  const {
    dragOverKey: dragOverSortKey,
    dragOverAfter: dragOverSortAfter,
    onRowDragStart: onSortRowDragStart,
    onRowDragEnd: onSortRowDragEnd,
    onDragOver: onSortRowsDragOver,
    onDrop: onSortRowsDrop,
  } = useDropdownReorder('data-sort-key', moveSort)
  const {
    dragOverKey: dragOverGroupKey,
    dragOverAfter: dragOverGroupAfter,
    onRowDragStart: onGroupRowDragStart,
    onRowDragEnd: onGroupRowDragEnd,
    onDragOver: onGroupRowsDragOver,
    onDrop: onGroupRowsDrop,
  } = useDropdownReorder('data-group-key', moveGroup)

  const {
    all: selection,
    rows: selectedRows,
    toggle: toggleRowSelection,
    toggleAll: toggleSelectAll,
  } = table.selection
  const { page, pageSize, numPages, setPage, setPageSize } = table.pagination
  const { query: searchQuery, setQuery: setSearchQuery } = table.search

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

  // Roving tabindex: exactly one item (a data row or a group header row) is a Tab stop at a
  // time (the rest are tabIndex={-1}), arrow keys move it, matching how the checklist/date-tree
  // checkboxes reuse the same anchor idea for range selection. Data rows only join the tab
  // sequence when they're actually interactive; group headers always do, since collapsing a
  // group is already a click away regardless of selectable/onRowClick.
  const rowNavEnabled = selectable || !!onRowClick
  const pageVisibleItems = paginateVisibleItems(visibleItems, page, pageSize)
  const [initialPageSize] = useState(pageSize)
  const pageSizes = pageSizeOptions(pageSize, initialPageSize)
  const navigableItems = pageVisibleItems.filter((item) => item.kind === 'group' || rowNavEnabled)
  const effectiveFocusTarget =
    focusTarget && indexOfVisibleItem(navigableItems, focusTarget) !== -1
      ? focusTarget
      : (navigableItems[0] ?? null)
  const isFocusTarget = (item: VisibleItem<TRow>) =>
    effectiveFocusTarget !== null && isSameVisibleItem(effectiveFocusTarget, item)

  const focusItem = (target: VisibleItem<TRow>) => {
    setFocusTarget(target)
    const refKey = target.kind === 'row' ? target.row : target.key
    rowRefs.current.get(refKey)?.focus()
  }

  // Arrow-key/Ctrl+Home/Ctrl+End navigation can target an item that isn't on the current page —
  // `visibleItems` (from `table`) already covers the *full* filtered/grouped dataset, so crossing
  // to an arbitrary page's first/last item is core's `getCrossPageFocusTarget` (shared with Vue).

  // Changing `page` re-renders asynchronously, so an item on the new page can't be focused until
  // after that render commits — this records the target and a `useEffect` below picks it up.
  const pendingFocusTarget = useRef<VisibleItem<TRow> | null>(null)

  useEffect(() => {
    if (pendingFocusTarget.current) {
      const target = pendingFocusTarget.current
      pendingFocusTarget.current = null
      focusItem(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Scrolls `focus.target` into view whenever it changes to a row — the counterpart to
  // `pendingFocusTarget`/`focusItem` above, but for `table.focus.moveTo`, which (unlike keyboard
  // nav) never calls real DOM `.focus()` itself — see its own doc comment in `useTableState.ts`.
  // Runs on every `focusTarget` change (a keyboard-driven one already scrolled synchronously via
  // `focusItem`'s `.focus()`, so this is a harmless no-op re-scroll for that case) and retries on
  // `page`/`collapsedGroups` so a `moveTo` that had to expand a group or cross a page still finds
  // the row once it actually mounts.
  const lastScrolledFocusTarget = useRef<VisibleItem<TRow> | null>(null)
  useEffect(() => {
    if (
      focusTarget &&
      focusTarget.kind === 'row' &&
      focusTarget !== lastScrolledFocusTarget.current
    ) {
      const el = rowRefs.current.get(focusTarget.row)
      if (el) {
        // jsdom (used by this project's own component tests) doesn't implement
        // `scrollIntoView` at all — guard rather than let it throw in a passive effect.
        el.scrollIntoView?.({ block: 'nearest' })
        // `moveTo(row, { focus: true })` — real `.focus()` in addition to the scroll, done here
        // (not in useTableState) since this is the one place that actually holds the row's DOM
        // node. `preventScroll` avoids a redundant second scroll on top of the line above.
        if (consumeDomFocus()) el.focus({ preventScroll: true })
        lastScrolledFocusTarget.current = focusTarget
      }
    }
  }, [focusTarget, page, collapsedGroups, consumeDomFocus])

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, target: VisibleItem<TRow>) => {
    const idx = indexOfVisibleItem(navigableItems, target)
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const delta = e.key === 'ArrowDown' ? 1 : -1
        const nextIdx = idx + delta
        if (nextIdx >= 0 && nextIdx < navigableItems.length) {
          const next = navigableItems[nextIdx]
          e.preventDefault()
          if (e.shiftKey && selectable && next.kind === 'row') toggleRowSelection(next.row, true)
          focusItem(next)
        } else {
          const crossing = getCrossPageFocusTarget(
            visibleItems,
            page,
            numPages,
            pageSize,
            { kind: 'edge', delta },
            rowNavEnabled,
          )
          if (crossing) {
            e.preventDefault()
            if (e.shiftKey && selectable && crossing.item.kind === 'row')
              toggleRowSelection(crossing.item.row, true)
            pendingFocusTarget.current = crossing.item
            setPage(crossing.targetPage)
          }
        }
        break
      }
      case 'Home':
      case 'End': {
        if (e.ctrlKey || e.metaKey) {
          const crossing = getCrossPageFocusTarget(
            visibleItems,
            page,
            numPages,
            pageSize,
            { kind: 'jump', toEnd: e.key === 'End' },
            rowNavEnabled,
          )
          if (crossing) {
            e.preventDefault()
            if (e.shiftKey && selectable && crossing.item.kind === 'row')
              toggleRowSelection(crossing.item.row, true)
            if (crossing.targetPage === page) focusItem(crossing.item)
            else {
              pendingFocusTarget.current = crossing.item
              setPage(crossing.targetPage)
            }
          }
          break
        }
        const next = navigableItems[e.key === 'Home' ? 0 : navigableItems.length - 1]
        if (next && !isSameVisibleItem(next, target)) {
          e.preventDefault()
          if (e.shiftKey && selectable && next.kind === 'row') toggleRowSelection(next.row, true)
          focusItem(next)
        }
        break
      }
      case ' ':
        if (target.kind === 'group') {
          if (selectable) {
            e.preventDefault()
            const group = groupedData.find((g) => g.key === target.key)
            if (group) toggleSelectAll(group.rows)
          }
        } else if (selectable) {
          e.preventDefault()
          toggleRowSelection(target.row, e.shiftKey)
        }
        break
      case 'Enter':
        if (target.kind === 'group') {
          e.preventDefault()
          toggleGroupCollapse(target.key)
        } else if (onRowClick) {
          e.preventDefault()
          onRowClick(target.row, e)
        }
        break
    }
  }

  const filterableCols = columns.filter((c) => c.filterable !== false)
  const groupableCols = columns.filter((c) => c.groupable === true)
  const sortableCols = columns.filter((c) => c.sortable !== false)
  // Sort/Group dropdowns split into an "active" section (priority order, reorderable) and an
  // "add" section (everything else) — reordering only ever makes sense among active entries.
  const addableSortCols = sortableCols.filter((c) => getSortIndex(c.key) === null)
  const addableGroupCols = groupableCols.filter((c) => !groupBy.includes(c.key))
  // Narrows a dropdown's own column list by label *or category* (see `ddSearchTerms` and
  // `columnMatchesSearch`, core — typing a category name surfaces every column filed under it,
  // not just one whose own label contains the term) — the Columns dropdown keeps its own
  // `orderedColumns` order untouched (it doubles as the drag-to-reorder surface, so its order
  // carries meaning no alphabetization should disturb); Sort/Group's addable lists and the Filter
  // dropdown's left pane have no such order to preserve (none of these columns are sorted/
  // grouped/filtered yet), so they're alphabetized by label to make a long list easier to scan,
  // and bucketed by category — a category collapses into a `CategorySubmenu` flyout trigger
  // instead of a flat run of individual rows (via `categorizedAlphabetizedByLabel`, core, which
  // already matches by category too).
  const searchCols = <T extends { label: string; category?: string }>(
    cols: T[],
    term: string,
  ): T[] => cols.filter((c) => columnMatchesSearch(c, term))
  // Columns dropdown: "Visible columns" (every column the user has chosen to show — visibleCols,
  // not activeColumns, so a column merely hidden *by grouping* still counts as visible here) is
  // the draggable/Alt+↑↓-reorderable list this dropdown always was. Unlike Sort/Group, its search
  // box narrows *both* Visible and Available — a column you already show is just as often what
  // you're hunting for (to hide/reorder it) as one you don't, and with a typical column count
  // Visible is usually long enough that a search box placed only below it would sit off-screen
  // until scrolled to. "Available columns" (hidden columns, click to show) is search-narrowed and
  // bucketed by category while *not* searching — but, unlike Sort/Group's addable lists,
  // deliberately NOT alphabetized: this dropdown's whole identity is "shows real column/definition
  // order," so Available keeps that same order instead of adopting Sort/Group's alphabetical
  // convention (see categorizedAlphabetizedByLabel above, which this intentionally doesn't use).
  const isColsSearching = (ddSearchTerms.cols ?? '').trim() !== ''
  const visibleOrderedColumns = orderedColumns.filter((c) => visibleCols.has(c.key))
  const searchedVisibleColumns = searchCols(visibleOrderedColumns, ddSearchTerms.cols ?? '')
  // Alt+↑/↓'s neighbor-eligibility set: the real visible-columns set when not searching (today's
  // behavior, unchanged), or narrowed to just the currently-shown-and-matching keys while
  // searching, so a search-filtered-out column is never chosen as a swap partner — see
  // moveVisibleColumnBy's own doc comment (useTableState.ts) for why this needs a real Set, not
  // just filtering the *rendered* rows (the underlying reorder still walks the full columnOrder).
  const colsReorderEligible = isColsSearching
    ? new Set(searchedVisibleColumns.map((c) => c.key))
    : undefined
  const availableColumns = orderedColumns.filter((c) => !visibleCols.has(c.key))
  const searchedAvailableColumns = searchCols(availableColumns, ddSearchTerms.cols ?? '')
  // Only bucketed by category while *not* searching — once a search term narrows a category down
  // to one or two matches, keeping them behind a submenu trigger would force an extra hover/click
  // right when the search was supposed to shortcut that (see the flattened, category-tagged
  // render below instead).
  const categorizedAvailableCols = groupColumnsByCategory(availableColumns)
  // categorizedAlphabetizedByLabel (core): search, alphabetize, bucket by category, and
  // alphabetize the categories themselves too — Sort/Group's addable lists have no "already
  // active" concept to preserve order for (unlike the Columns dropdown or Filter's left pane), so
  // this pipeline's own alphabetical-everything convention applies cleanly here.
  const categorizedAddableSortCols = categorizedAlphabetizedByLabel(
    addableSortCols,
    ddSearchTerms.sort ?? '',
  )
  const categorizedAddableGroupCols = categorizedAlphabetizedByLabel(
    addableGroupCols,
    ddSearchTerms.group ?? '',
  )
  // While searching, a category match is flattened into a plain, category-tagged row instead of
  // staying bucketed behind a submenu trigger (see the Columns dropdown's identical fix above) —
  // hiding a single search match behind an extra hover/click defeats the point of searching.
  const isSortSearching = (ddSearchTerms.sort ?? '').trim() !== ''
  const isGroupSearching = (ddSearchTerms.group ?? '').trim() !== ''
  const searchedFlatAddableSortCols = alphabetizedByLabel(addableSortCols, ddSearchTerms.sort ?? '')
  const searchedFlatAddableGroupCols = alphabetizedByLabel(
    addableGroupCols,
    ddSearchTerms.group ?? '',
  )
  // Snapshot of the left pane's column order, taken only at the moment the Filter dropdown opens
  // — active-filter columns first, then the rest (see `orderFilterColumnsByActive`'s own doc
  // comment, core, for why this is a snapshot rather than a live sort: reordering while a filter
  // is toggled with the panel still open would move a row out from under the pointer
  // mid-interaction). Comparing `openFilterDD` against the previous render is React's own
  // documented pattern for "adjust state when a prop changes" — same shape as
  // `filterListResetKey`/`prevColumnKeys` elsewhere in this file — rather than an effect, so the
  // very first render with the panel open already has the fresh snapshot.
  const [filterColOrderKeys, setFilterColOrderKeys] = useState<string[] | null>(null)
  // Which categories are collapsed (see docs/columns.md's "Column categories"). Seeded the same way as
  // filterColOrderKeys above — a snapshot taken only on the closed→open transition, not
  // recomputed live while the panel stays open (so toggling a category by hand isn't fought by an
  // unrelated filter change elsewhere). Collapsed by default (matching Columns/Sort/Group's own
  // category submenus, which always start closed), except a category containing an active filter
  // at the moment the panel opens starts expanded instead — so opening the dropdown never hides
  // the very filter you're currently using behind a collapsed section with no visual sign why.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  function toggleCategoryCollapsed(name: string): void {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  // A chip's column: selected by state, so neither the column search nor a collapsed category
  // can hide it (U25). A handler factory: react-hooks/refs rejects a ref write in a helper an
  // inline handler calls.
  const openFilterColumn = (key: string) => (): void => {
    pendingFilterColFocusKey.current = key
    setFilterActiveCol(key)
    setDdSearchTerms((prev) => ({ ...prev, filter: '' }))
    const category = filterableCols.find((c) => c.key === key)?.category
    if (category)
      setCollapsedCategories((prev) => {
        const next = new Set(prev)
        next.delete(category)
        return next
      })
    setOpenFilterDD(true)
  }
  const [prevOpenFilterDD, setPrevOpenFilterDD] = useState(openFilterDD)
  if (openFilterDD !== prevOpenFilterDD) {
    setPrevOpenFilterDD(openFilterDD)
    if (openFilterDD) {
      setFilterShowValues(false)
      setFilterColOrderKeys(
        orderFilterColumnsByActive(filterableCols, filters, excludeFilters, rangeFilters),
      )
      const startCollapsed = new Set<string>()
      for (const category of groupColumnsByCategory(filterableCols).categories) {
        const hasActiveInCategory = category.columns.some((c) =>
          columnHasActiveFilter(c.key, filters, excludeFilters, rangeFilters),
        )
        if (!hasActiveInCategory) startCollapsed.add(category.name)
      }
      setCollapsedCategories(startCollapsed)
    }
  }
  const isFilterColSearching = (ddSearchTerms.filter ?? '').trim() !== ''
  const searchedFilterableCols = applyColumnOrderSnapshot(
    searchCols(filterableCols, ddSearchTerms.filter ?? ''),
    filterColOrderKeys,
  )
  // Buckets the (already searched/ordered) left-pane column list by category. Deliberately NOT
  // re-sorted alphabetically afterward — searchedFilterableCols is already active-filtered-first-
  // then-alphabetical (see its own comment above), not purely alphabetical, so re-sorting
  // categories here would undo that active-first bubbling for whichever category contains the
  // column currently being filtered on.
  const categorizedFilterCols = groupColumnsByCategory(searchedFilterableCols)
  const filterActiveKey =
    filterActiveCol && filterableCols.some((c) => c.key === filterActiveCol)
      ? filterActiveCol
      : (filterableCols[0]?.key ?? null)
  const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
  // One left-pane column row — shared by the flat uncategorized list and each category section
  // below (`.dt-filter-category-cols` indents the latter).
  const renderFilterColRow = (col: ColumnDef<TRow>) => {
    const hasActive = columnHasActiveFilter(col.key, filters, excludeFilters, rangeFilters)
    const isActive = col.key === filterActiveKey
    return (
      // The row (not the item button alone) carries the selected-column highlight, so it spans
      // the clear button too instead of stopping short of it — a <button> can't contain another
      // interactive element, so the clear button below is a sibling, not nested.
      <div
        key={col.key}
        data-filter-row-key={col.key}
        className={`dt-filter-col-row${isActive ? ' dt-filter-col-row--active' : ''}`}
      >
        {/* A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it for
            free — same fix as the Sort/Group add-lists above; this had the identical gap.
            `onFocus` (not just `onClick`) is what actually shows this column's detail pane — a
            listbox/radiogroup-style "focus follows selection", so arrow-key nav or Tab landing
            here needs no separate Enter/Space "activate" step; a click still works the same way,
            since focusing a button on click fires the same event. Guarded against re-selecting
            the already-active column so focusing it back (e.g. via ArrowLeft from the right pane)
            doesn't trigger a pointless state update. Delete/Backspace clearing the column's
            filter is handled by handleFilterPanelKeyDown (bound on the whole panel), not here —
            same action as the clear button below, reachable without leaving the row. */}
        <button
          type="button"
          data-filter-col-key={col.key}
          data-dd-row
          onFocus={() => {
            if (col.key !== filterActiveKey) setFilterActiveCol(col.key)
          }}
          onClick={() => {
            setFilterActiveCol(col.key)
            if (!narrowFilter) return
            setFilterShowValues(true)
            pendingFilterValuesFocus.current = true
          }}
          className={`dt-filter-col-item${isActive ? ' dt-filter-col-item--active' : ''}`}
        >
          <span>{col.label}</span>
        </button>
        {/* Replaces the plain active-filter dot: a one-click way to drop this column's filter
            without opening it first, matching the toolbar's own per-dropdown × buttons (see
            "Toolbar clear buttons" in docs/toolbar.md). */}
        {hasActive && (
          <button
            type="button"
            className="dt-filter-col-clear"
            title={L.clearColumnFilter}
            aria-label={L.clearColumnFilter}
            onClick={(e) => {
              e.stopPropagation()
              // Clears every kind at once — this button means "drop this column's filter
              // entirely", unlike the active-bar's own per-kind chips.
              clearColumnFilter(col.key, 'include')
              clearColumnFilter(col.key, 'exclude')
              clearColumnFilter(col.key, 'range')
            }}
          >
            ×
          </button>
        )}
      </div>
    )
  }

  // Filter dropdown: ArrowRight/ArrowLeft cross between the left column pane and the right
  // detail pane; Up/Down/Home/End inside the right pane (the value checklist or date tree,
  // whichever is rendered for the column's type, plus the value-search box above them) get the
  // same nav every other dropdown's row list gets from Dropdown.tsx's own generic handler — this
  // one is deliberately separate (bound on the filterPanel div, a descendant of Dropdown's own
  // panel) since it needs to reach into filter-specific DOM (the virtualized checklist) that
  // generic handler knows nothing about. Bubbles up to Dropdown's handler when it doesn't apply
  // (e.g. Up/Down on a *left*-pane column button, which Dropdown's own `data-dd-row` query
  // already covers) by simply not calling preventDefault/stopPropagation in that case.
  const handleFilterPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey) return
    const targetEl = e.target as HTMLElement
    const filterColBtn = targetEl.closest<HTMLElement>('[data-filter-col-key]')

    // Delete/Backspace on a focused left-pane column row clears that column's filter — the
    // keyboard equivalent of clicking its × clear button. Guarded to an actually-active column
    // so pressing it on an inert row is a true no-op (no page-reset churn from clearColumnFilter's
    // unconditional setPageState(1)).
    if ((e.key === 'Delete' || e.key === 'Backspace') && filterColBtn) {
      const key = filterColBtn.dataset.filterColKey
      const col = key && filterableCols.find((c) => c.key === key)
      if (col && columnHasActiveFilter(col.key, filters, excludeFilters, rangeFilters)) {
        e.preventDefault()
        clearColumnFilter(col.key, 'include')
        clearColumnFilter(col.key, 'exclude')
        clearColumnFilter(col.key, 'range')
      }
      return
    }

    if (filterColBtn && e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      if (narrowFilter) {
        setFilterShowValues(true)
        pendingFilterValuesFocus.current = true
        return
      }
      e.currentTarget
        .querySelector<HTMLElement>('[data-filter-detail] input, [data-filter-detail] button')
        ?.focus()
      return
    }

    const filterDetailEl = targetEl.closest<HTMLElement>('[data-filter-detail]')
    if (filterDetailEl && e.key === 'ArrowLeft') {
      const active = document.activeElement
      // Never hijack Left on an actual text/value-editing control — the value-search box, the
      // numeric/date range inputs, or a range-slider thumb — which all need their native
      // cursor/value behavior. Everything else in this pane (checklist/date-tree checkboxes,
      // select-all, the sort-order button) has no use for a bare Left, so it's free to reuse.
      const isEditable =
        active instanceof HTMLInputElement &&
        (active.type === 'text' ||
          active.type === 'number' ||
          active.type === 'date' ||
          active.type === 'range')
      if (!isEditable) {
        e.preventDefault()
        e.stopPropagation()
        if (narrowFilter) {
          setFilterShowValues(false)
          pendingFilterColFocusKey.current = filterActiveKey
          return
        }
        const cols = e.currentTarget.querySelector<HTMLElement>('[data-filter-cols]')
        for (const el of cols?.querySelectorAll<HTMLElement>('[data-filter-col-key]') ?? []) {
          if (el.dataset.filterColKey === filterActiveKey) {
            el.focus()
            break
          }
        }
        return
      }
    }
  }

  const hasActiveState =
    sorts.length > 0 || activeFilterCount > 0 || groupBy.length > 0 || searchQuery !== ''
  const hasAggregates = activeColumns.some((c) => c.aggregate !== undefined)
  const toolbarEndEl = hasToolbarEnd && <div className="dt-toolbar-end">{toolbarEnd}</div>

  const formatValue = (v: unknown, row: TRow, col: ColumnDef<TRow>) => {
    if (col.render) return col.render(v, row)
    if (col.format) return col.format(v, row)
    if (Array.isArray(v)) return v.join(', ')
    return v != null ? String(v) : ''
  }

  const cellValue = (row: TRow, col: ColumnDef<TRow>) =>
    formatValue(getColumnValue(col, row), row, col)

  return (
    <div className="dt" ref={rootRef}>
      <div className="dt-toolbar">
        <div className="dt-toolbar-actions">
          {/* Columns — "Visible columns" (every shown column, draggable/Alt+↑↓-reorderable, in
              real table order) above "Available columns" (hidden columns, click to show; a
              categorized one collapses into a CategorySubmenu). Mirrors the Sort/Group
              active/addable split above — a checkbox no longer fit once "shown" and "hidden"
              needed visually distinct rows (draggable + remove vs. plain click-to-add), the same
              reason Sort/Group never used one either. Reordering only ever happens within
              Visible — Available is click-only, so nesting it into category submenus (impossible
              for Visible, since submenu rows can't also be a drag surface) creates no conflict. */}
          {showColumns !== false && columns.length >= 2 && (
            <Dropdown
              open={openColsDD}
              setOpen={setOpenColsDD}
              trigger={<ToolbarBtn>{L.columns}</ToolbarBtn>}
              onDragOver={onColRowsDragOver}
              onDrop={onColRowsDrop}
            >
              {/* Pinned at the very top and always mounted (never conditionally rendered based on
                match count) — narrows both this section and Available below. Mounting it
                unconditionally is what fixes a real bug the old Available-only, gated-on-results
                version had: a search term matching nothing used to unmount the box itself,
                dropping focus with no way back short of Escape. */}
              <div className="dt-dd-search-row">
                <DdSearchInput
                  value={ddSearchTerms.cols ?? ''}
                  onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, cols: v })}
                  placeholder={L.filterSearchPlaceholder}
                  clearLabel={L.clearSearch}
                />
              </div>
              {searchedVisibleColumns.length > 0 && (
                <div className="dt-dd-section">{L.columnsSection}</div>
              )}
              {searchedVisibleColumns.map((col) => (
                // Draggable (+ Alt+↑/↓) reorders columnOrder, skipping hidden columns (moveVisibleBy)
                // — same treatment as the Sort/Group active rows. dragover/drop are handled at the
                // Dropdown panel level (see above), not per-row — that's what lets a drop past the
                // last row still resolve to a valid target. Alt+↑/↓'s own neighbor lookup is scoped
                // to colsReorderEligible while searching, so it only ever swaps two currently-shown
                // rows, leaving anything hidden by the filter untouched at its own position.
                <div
                  key={col.key}
                  data-col-row-key={col.key}
                  data-dd-row
                  tabIndex={0}
                  draggable
                  onDragStart={() => onColRowDragStart(col.key)}
                  onDragEnd={onColRowDragEnd}
                  onKeyDown={(e) => {
                    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                      e.preventDefault()
                      // Focus drops to <body> after this reorder without an explicit refocus —
                      // same empirically-confirmed behavior as Sort/Group's own Alt+Arrow handlers.
                      pendingColFocusKey.current = col.key
                      moveVisibleColumnBy(
                        col.key,
                        e.key === 'ArrowUp' ? -1 : 1,
                        colsReorderEligible,
                      )
                    } else if (e.key === 'Delete' || e.key === 'Backspace') {
                      // Keyboard equivalent of this row's own × button — matches the Filter
                      // dropdown's identical Delete/Backspace-on-a-focused-active-row shortcut.
                      e.preventDefault()
                      hideColumn(col)
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      // No click action of its own (unlike Sort's active rows, which toggle
                      // direction) — but still needs to preventDefault, or Space's native default
                      // action scrolls the nearest scrollable ancestor (this panel, or the whole
                      // page once the panel itself has nothing left to scroll) out from under the
                      // still-focused row, which reads as "focus was lost" even though it wasn't.
                      e.preventDefault()
                    }
                  }}
                  className={`dt-dd-item dt-dd-item--col dt-dd-item--colrow${dragOverClass(dragOverColRowKey === col.key, dragOverColRowAfter)}`}
                >
                  <span aria-hidden="true" className="dt-dd-drag-handle">
                    ⠿
                  </span>
                  <span className="dt-flex1">{col.label}</span>
                  <button
                    type="button"
                    draggable={false}
                    title={L.hideColumn}
                    aria-label={L.hideColumn}
                    onClick={(e) => {
                      e.stopPropagation()
                      hideColumn(col)
                    }}
                    className="dt-item-remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              {searchedVisibleColumns.length === 0 && searchedAvailableColumns.length === 0 && (
                <NoMatchingColumns label={L.noMatchingColumns} />
              )}
              {searchedAvailableColumns.length > 0 && (
                <>
                  <div className="dt-dd-section">{L.availableColumnsSection}</div>
                  {isColsSearching
                    ? searchedAvailableColumns.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          data-col-key={col.key}
                          data-dd-row
                          onClick={() => {
                            pendingColFocusKey.current = col.key
                            toggleColVisibility(col.key)
                          }}
                          className="dt-dd-item dt-dd-item--click"
                        >
                          <span className="dt-flex1">{col.label}</span>
                          {col.category && (
                            <span className="dt-dd-item-category">{col.category}</span>
                          )}
                        </button>
                      ))
                    : [
                        ...categorizedAvailableCols.uncategorized.map((col) => (
                          <button
                            key={col.key}
                            type="button"
                            data-col-key={col.key}
                            data-dd-row
                            onClick={() => {
                              pendingColFocusKey.current = col.key
                              toggleColVisibility(col.key)
                            }}
                            className="dt-dd-item dt-dd-item--click"
                          >
                            <span className="dt-flex1">{col.label}</span>
                          </button>
                        )),
                        ...categorizedAvailableCols.categories.map((category) => (
                          <CategorySubmenu
                            key={category.name}
                            name={category.name}
                            isOpen={openColsCategory === category.name}
                            onOpen={() => setOpenColsCategory(category.name)}
                            onClose={() =>
                              setOpenColsCategory((c) => (c === category.name ? null : c))
                            }
                          >
                            {category.columns.map((col) => (
                              <button
                                key={col.key}
                                type="button"
                                data-col-key={col.key}
                                data-dd-row
                                onClick={() => {
                                  pendingColFocusKey.current = col.key
                                  toggleColVisibility(col.key)
                                }}
                                className="dt-dd-item dt-dd-item--click"
                              >
                                <span className="dt-flex1">{col.label}</span>
                              </button>
                            ))}
                          </CategorySubmenu>
                        )),
                      ]}
                </>
              )}
            </Dropdown>
          )}

          {/* Group before Sort — data is grouped first, then ordered (groups themselves, then
              rows within them), matching the Sort dropdown's own "Group order" section coming
              before "Active sorts" and the active bar's group-chips-before-sort-chips order.
              Both still "shape" the view (vs. Search/Filter narrowing it below) — see the
              divider below. */}
          {groupableCols.length > 0 && (
            <Dropdown
              open={openGroupDD}
              setOpen={setOpenGroupDD}
              trigger={
                <ToolbarBtn active={groupBy.length > 0} grouped={groupBy.length > 0}>
                  {L.group}
                </ToolbarBtn>
              }
              extraTrigger={
                groupBy.length > 0 && (
                  <button
                    type="button"
                    onClick={clearGroups}
                    title={L.clearGroups}
                    aria-label={L.clearGroups}
                    className="dt-btn-clear"
                  >
                    ×
                  </button>
                )
              }
              onDragOver={onGroupRowsDragOver}
              onDrop={onGroupRowsDrop}
            >
              {groupBy.length > 0 && (
                <>
                  <div className="dt-dd-section">{L.activeGroupsSection}</div>
                  {groupBy.map((key, i) => {
                    const col = groupableCols.find((c) => c.key === key)
                    return (
                      // Same treatment as the Sort active rows, minus a click action — a group
                      // entry has nothing to toggle (no direction), so the row is
                      // draggable/focusable purely for reordering (drag, or Alt+↑/↓ when
                      // focused); `×` remove is the only button. dragover/drop are handled at
                      // the Dropdown panel level (see above), not per-row — that's what lets a
                      // drop past the last row still resolve to a valid target.
                      <div
                        key={key}
                        data-group-key={key}
                        data-dd-row
                        draggable
                        tabIndex={0}
                        onDragStart={() => onGroupRowDragStart(key)}
                        onDragEnd={onGroupRowDragEnd}
                        onKeyDown={(e) => {
                          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                            e.preventDefault()
                            moveGroupBy(key, e.key === 'ArrowUp' ? -1 : 1)
                          } else if (e.key === 'Delete' || e.key === 'Backspace') {
                            // Keyboard equivalent of this row's own × button — matches the
                            // Filter dropdown's identical Delete/Backspace-on-a-focused-active-
                            // row shortcut.
                            e.preventDefault()
                            pendingGroupFocusKey.current = key
                            removeGroup(key)
                          } else if (e.key === 'Enter' || e.key === ' ') {
                            // No click action of its own (unlike Sort's active rows, which
                            // toggle direction) — but still needs to preventDefault, or Space's
                            // native default action scrolls the nearest scrollable ancestor (this
                            // panel, or the whole page once the panel itself has nothing left to
                            // scroll) out from under the still-focused row, which reads as "focus
                            // was lost" even though it wasn't.
                            e.preventDefault()
                          }
                        }}
                        className={`dt-dd-item dt-dd-item--col dt-dd-item--grouprow${dragOverClass(dragOverGroupKey === key, dragOverGroupAfter)}`}
                      >
                        <span aria-hidden="true" className="dt-dd-drag-handle">
                          ⠿
                        </span>
                        <span className="dt-sort-idx">{i + 1}</span>
                        <span className="dt-flex1">{col?.label ?? key}</span>
                        <button
                          type="button"
                          draggable={false}
                          title={L.removeGroup(col?.label ?? key)}
                          aria-label={L.removeGroup(col?.label ?? key)}
                          onClick={() => {
                            // Same reasoning as Sort's remove-focus hand-off above.
                            pendingGroupFocusKey.current = key
                            removeGroup(key)
                          }}
                          className="dt-item-remove"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </>
              )}
              {addableGroupCols.length > 0 && (
                <>
                  {/* Same search + alphabetize treatment as Sort's add list above, for the same
                      reason. */}
                  <div className="dt-dd-search-row">
                    <DdSearchInput
                      value={ddSearchTerms.group ?? ''}
                      onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, group: v })}
                      placeholder={L.filterSearchPlaceholder}
                      clearLabel={L.clearSearch}
                    />
                  </div>
                  <div className="dt-dd-section">{L.groupSection}</div>
                  {isGroupSearching && searchedFlatAddableGroupCols.length === 0 && (
                    <NoMatchingColumns label={L.noMatchingColumns} />
                  )}
                  {isGroupSearching
                    ? searchedFlatAddableGroupCols.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          data-group-add-key={col.key}
                          data-dd-row
                          onClick={() => {
                            pendingGroupFocusKey.current = col.key
                            toggleGroup(col.key)
                          }}
                          className="dt-dd-item dt-dd-item--click"
                        >
                          <span className="dt-flex1">{col.label}</span>
                          {col.category && (
                            <span className="dt-dd-item-category">{col.category}</span>
                          )}
                        </button>
                      ))
                    : [
                        ...categorizedAddableGroupCols.uncategorized.map((col) => (
                          <button
                            key={col.key}
                            type="button"
                            data-group-add-key={col.key}
                            data-dd-row
                            onClick={() => {
                              // Same reasoning as Sort's activate-focus hand-off above.
                              pendingGroupFocusKey.current = col.key
                              toggleGroup(col.key)
                            }}
                            className="dt-dd-item dt-dd-item--click"
                          >
                            <span className="dt-flex1">{col.label}</span>
                          </button>
                        )),
                        ...categorizedAddableGroupCols.categories.map((category) => (
                          <CategorySubmenu
                            key={category.name}
                            name={category.name}
                            isOpen={openGroupCategory === category.name}
                            onOpen={() => setOpenGroupCategory(category.name)}
                            onClose={() =>
                              setOpenGroupCategory((c) => (c === category.name ? null : c))
                            }
                          >
                            {category.columns.map((col) => (
                              <button
                                key={col.key}
                                type="button"
                                data-group-add-key={col.key}
                                data-dd-row
                                onClick={() => {
                                  pendingGroupFocusKey.current = col.key
                                  toggleGroup(col.key)
                                }}
                                className="dt-dd-item dt-dd-item--click"
                              >
                                <span className="dt-flex1">{col.label}</span>
                              </button>
                            ))}
                          </CategorySubmenu>
                        )),
                      ]}
                </>
              )}
            </Dropdown>
          )}

          {/* Sort */}
          {sortableCols.length > 0 && (
            <Dropdown
              open={openSortDD}
              setOpen={setOpenSortDD}
              trigger={
                <ToolbarBtn active={sorts.length > 0} grouped={sorts.length > 0}>
                  {L.sort}
                </ToolbarBtn>
              }
              extraTrigger={
                sorts.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSorts}
                    title={L.clearSorts}
                    aria-label={L.clearSorts}
                    className="dt-btn-clear"
                  >
                    ×
                  </button>
                )
              }
              onDragOver={onSortRowsDragOver}
              onDrop={onSortRowsDrop}
            >
              {groupSortEntries.length > 0 && (
                <>
                  <div className="dt-dd-section">{L.groupOrderSection}</div>
                  <div className="dt-dd-hint">{L.groupOrderHint}</div>
                  {groupSortEntries.map((entry, i) => {
                    const col = columns.find((c) => c.key === entry.key)
                    // Not draggable, no Alt+↑/↓ reorder — nesting order always follows groupBy's
                    // own order (see the Group dropdown), so reordering here would be a no-op;
                    // direction is still toggleable/removable in place, same as any other entry.
                    return (
                      <div
                        key={entry.key}
                        tabIndex={0}
                        onClick={() => toggleSortDir(entry.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleSortDir(entry.key)
                          } else if (e.key === 'Delete' || e.key === 'Backspace') {
                            // Keyboard equivalent of this row's own × button — matches the Filter
                            // dropdown's identical Delete/Backspace-on-a-focused-active-row
                            // shortcut. This row isn't draggable/reorderable, but removing its
                            // sort entry still needs the same focus hand-off as any other.
                            e.preventDefault()
                            pendingSortFocusKey.current = entry.key
                            removeSort(entry.key)
                          }
                        }}
                        className="dt-dd-item dt-dd-item--col dt-dd-item--sortrow dt-dd-item--locked"
                      >
                        <span className="dt-sort-idx">{i + 1}</span>
                        <span className="dt-flex1">{col?.label ?? entry.key}</span>
                        <span className="dt-sort-icon dt-sort-icon--active">
                          {getSortIcon(entry.key)}
                        </span>
                        <button
                          type="button"
                          draggable={false}
                          title={L.removeSort(col?.label ?? entry.key)}
                          aria-label={L.removeSort(col?.label ?? entry.key)}
                          onClick={(e) => {
                            e.stopPropagation()
                            pendingSortFocusKey.current = entry.key
                            removeSort(entry.key)
                          }}
                          className="dt-item-remove"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </>
              )}
              {nonGroupSortEntries.length > 0 && (
                <>
                  <div className="dt-dd-section">{L.activeSortsSection}</div>
                  {nonGroupSortEntries.map((entry, i) => {
                    const col = columns.find((c) => c.key === entry.key)
                    return (
                      // The whole row is the click target (toggles direction) and the drag source
                      // (reorder priority); `×` stays a separate <button> (draggable=false so
                      // starting a drag from it doesn't also drag the row) since removing isn't
                      // something a row click/drag should ever trigger. tabIndex + onKeyDown give
                      // it Alt+↑/↓ reorder and Enter/Space-to-toggle from the keyboard — a plain
                      // div gets no free keyboard activation the way a real <button> would (unlike
                      // the add-list below, which doesn't need custom keyboard handling).
                      // dragover/drop are handled at the Dropdown panel level (see above), not
                      // per-row — that's what lets a drop past the last row still resolve to a
                      // valid target.
                      <div
                        key={entry.key}
                        data-sort-key={entry.key}
                        data-dd-row
                        draggable
                        tabIndex={0}
                        onDragStart={() => onSortRowDragStart(entry.key)}
                        onDragEnd={onSortRowDragEnd}
                        onClick={() => toggleSortDir(entry.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleSortDir(entry.key)
                          } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                            e.preventDefault()
                            // Swap with the neighbor within this non-group subset (by key, via
                            // moveSort/reorderSort), not the raw sorts-array neighbor (moveSortBy)
                            // — a group entry can sit between two non-group ones in the underlying
                            // array, and swapping with it would silently do nothing visible here.
                            const delta = e.key === 'ArrowUp' ? -1 : 1
                            const neighbor = nonGroupSortEntries[i + delta]
                            if (neighbor) moveSort(entry.key, neighbor.key, delta > 0)
                          } else if (e.key === 'Delete' || e.key === 'Backspace') {
                            // Keyboard equivalent of this row's own × button — matches the Filter
                            // dropdown's identical Delete/Backspace-on-a-focused-active-row
                            // shortcut.
                            e.preventDefault()
                            pendingSortFocusKey.current = entry.key
                            removeSort(entry.key)
                          }
                        }}
                        className={`dt-dd-item dt-dd-item--col dt-dd-item--sortrow${dragOverClass(dragOverSortKey === entry.key, dragOverSortAfter)}`}
                      >
                        <span aria-hidden="true" className="dt-dd-drag-handle">
                          ⠿
                        </span>
                        <span className="dt-sort-idx">{i + 1}</span>
                        <span className="dt-flex1">{col?.label ?? entry.key}</span>
                        <span className="dt-sort-icon dt-sort-icon--active">
                          {getSortIcon(entry.key)}
                        </span>
                        <button
                          type="button"
                          draggable={false}
                          title={L.removeSort(col?.label ?? entry.key)}
                          aria-label={L.removeSort(col?.label ?? entry.key)}
                          onClick={(e) => {
                            e.stopPropagation()
                            // Removing this entry unmounts this whole row (a different JSX subtree
                            // than the addable button it's about to become again — see
                            // pendingSortFocusKey above), so focus needs an explicit hand-off.
                            pendingSortFocusKey.current = entry.key
                            removeSort(entry.key)
                          }}
                          className="dt-item-remove"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </>
              )}
              {addableSortCols.length > 0 && (
                <>
                  {/* Search box narrows this "add" list only — the active-sorts section above
                    keeps its own priority order and is never hidden by it, since it's a short,
                    already-visible list with its own remove/reorder controls. */}
                  <div className="dt-dd-search-row">
                    <DdSearchInput
                      value={ddSearchTerms.sort ?? ''}
                      onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, sort: v })}
                      placeholder={L.filterSearchPlaceholder}
                      clearLabel={L.clearSearch}
                    />
                  </div>
                  <div className="dt-dd-section">{L.sortSection}</div>
                  {isSortSearching && searchedFlatAddableSortCols.length === 0 && (
                    <NoMatchingColumns label={L.noMatchingColumns} />
                  )}
                  {isSortSearching
                    ? searchedFlatAddableSortCols.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          data-sort-add-key={col.key}
                          data-dd-row
                          onClick={() => {
                            pendingSortFocusKey.current = col.key
                            toggleSort(col.key)
                          }}
                          className="dt-dd-item dt-dd-item--click"
                        >
                          <span className="dt-flex1">{col.label}</span>
                          {col.category && (
                            <span className="dt-dd-item-category">{col.category}</span>
                          )}
                        </button>
                      ))
                    : [
                        // A real <button> (not a div) so it's a native Tab stop and Enter/Space
                        // "click" it for free — no manual tabIndex/keydown wiring needed, unlike
                        // the active rows above (which need custom keyboard handling anyway for
                        // Alt+↑/↓).
                        ...categorizedAddableSortCols.uncategorized.map((col) => (
                          <button
                            key={col.key}
                            type="button"
                            data-sort-add-key={col.key}
                            data-dd-row
                            onClick={() => {
                              // Activating this column moves it into the active section above (a
                              // different JSX subtree, so a different DOM node) — see
                              // pendingSortFocusKey.
                              pendingSortFocusKey.current = col.key
                              toggleSort(col.key)
                            }}
                            className="dt-dd-item dt-dd-item--click"
                          >
                            <span className="dt-flex1">{col.label}</span>
                          </button>
                        )),
                        ...categorizedAddableSortCols.categories.map((category) => (
                          <CategorySubmenu
                            key={category.name}
                            name={category.name}
                            isOpen={openSortCategory === category.name}
                            onOpen={() => setOpenSortCategory(category.name)}
                            onClose={() =>
                              setOpenSortCategory((c) => (c === category.name ? null : c))
                            }
                          >
                            {category.columns.map((col) => (
                              <button
                                key={col.key}
                                type="button"
                                data-sort-add-key={col.key}
                                data-dd-row
                                onClick={() => {
                                  pendingSortFocusKey.current = col.key
                                  toggleSort(col.key)
                                }}
                                className="dt-dd-item dt-dd-item--click"
                              >
                                <span className="dt-flex1">{col.label}</span>
                              </button>
                            ))}
                          </CategorySubmenu>
                        )),
                      ]}
                </>
              )}
            </Dropdown>
          )}

          {endFirst && toolbarEndEl}
          {/* Divider between the "shape" controls above (Columns/Sort/Group) and the "find"
              controls below (Search/Filter). */}
          {!endFirst && <span className="dt-toolbar-divider" />}

          {showSearch !== false && (
            <span className="dt-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="dt-search-input"
                placeholder={L.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery !== '' && (
                <button
                  type="button"
                  className="dt-search-clear"
                  onClick={() => {
                    setSearchQuery('')
                    focusSearch()
                  }}
                  title={L.clearSearch}
                  aria-label={L.clearSearch}
                >
                  ×
                </button>
              )}
            </span>
          )}

          {/* Filter */}
          {filterableCols.length > 0 && (
            <Dropdown
              open={openFilterDD}
              setOpen={setOpenFilterDD}
              trigger={
                <ToolbarBtn active={activeFilterCount > 0} grouped={activeFilterCount > 0}>
                  {L.filter}
                </ToolbarBtn>
              }
              extraTrigger={
                activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    title={L.clearFilters}
                    aria-label={L.clearFilters}
                    className="dt-btn-clear"
                  >
                    ×
                  </button>
                )
              }
            >
              <div
                className={`dt-filter-panel${narrowFilter ? ' dt-filter-panel--narrow' : ''}`}
                onKeyDown={handleFilterPanelKeyDown}
              >
                {(!narrowFilter || !filterShowValues) && (
                  <div className="dt-filter-cols" data-filter-cols>
                    {/* Narrows the column list itself — separate from filterSearchTerms, which
                      narrows the *values* shown in the right-hand detail pane for whichever
                      column is currently selected. Order follows filterColOrderKeys (a snapshot
                      taken when the dropdown opens — active-filter columns first, then the rest,
                      alphabetized within each group) instead of a plain alphabetize, since
                      active-filter columns are the ones most worth finding at a glance in a long
                      list. */}
                    <DdSearchInput
                      value={ddSearchTerms.filter ?? ''}
                      onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, filter: v })}
                      placeholder={L.filterSearchPlaceholder}
                      clearLabel={L.clearSearch}
                      filterCols
                    />
                    {searchedFilterableCols.length === 0 && (
                      <NoMatchingColumns label={L.noMatchingColumns} />
                    )}
                    {categorizedFilterCols.uncategorized.map(renderFilterColRow)}
                    {categorizedFilterCols.categories.map((category) => {
                      // While searching, a category only ever renders here at all when it has a
                      // matching column (categorizedFilterCols buckets the already-searched list)
                      // — so force it open rather than let a stale collapsed snapshot hide the very
                      // match the search just surfaced, with no visible sign it's there.
                      // collapsedCategories itself is left untouched: clearing the search reverts
                      // to whatever collapse state the user had (manually toggled, or the open-time
                      // snapshot), exactly as before this fix.
                      const isCollapsed =
                        !isFilterColSearching && collapsedCategories.has(category.name)
                      return (
                        <div key={category.name} className="dt-filter-category">
                          <button
                            type="button"
                            className="dt-filter-category-header"
                            data-dd-row
                            data-filter-category-header={category.name}
                            aria-expanded={!isCollapsed}
                            onClick={() => toggleCategoryCollapsed(category.name)}
                          >
                            <span className="dt-filter-category-toggle">
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                            <span className="dt-flex1">{category.name}</span>
                          </button>
                          {!isCollapsed && (
                            <div className="dt-filter-category-cols">
                              {category.columns.map(renderFilterColRow)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {narrowFilter && filterShowValues && (
                  <button
                    type="button"
                    className="dt-dd-item dt-dd-item--click dt-filter-back"
                    data-filter-back
                    onClick={() => {
                      setFilterShowValues(false)
                      pendingFilterColFocusKey.current = filterActiveKey
                    }}
                  >
                    ‹ {L.columns} · {filterDetailCol?.label}
                  </button>
                )}
                {filterDetailCol && (!narrowFilter || filterShowValues) && (
                  <FilterPane
                    key={filterDetailCol.key}
                    table={table}
                    data={data}
                    columns={columns}
                    col={filterDetailCol}
                  />
                )}
              </div>
            </Dropdown>
          )}

          {/* "Clear all" sits alone at the far right of the actions row (`.dt-clear-all`'s
              margin-left: auto) — nothing else in the row needs to reflow when it mounts/unmounts,
              unlike the old layout where it sat between search and the stats text. */}
          {hasActiveState && (
            <button
              type="button"
              className="dt-btn dt-clear-all"
              onClick={() => {
                clearAll()
                focusSearch()
              }}
            >
              {L.clearAll}
            </button>
          )}
          {!endFirst && toolbarEndEl}
        </div>
      </div>

      {/* Active state bar — always rendered (even with nothing active) rather than only
          appearing once a filter is set — this gives the row-count stats a single stable home
          instead of bouncing between "end of the toolbar row" and nowhere, and means toggling a
          sort/filter/group never changes the toolbar's height. Shows one chip per active sort
          entry, group column, and filter column — sort/group chips were previously only visible
          as a bare count on their toolbar button (see above); giving them the same at-a-glance
          chip treatment filters already had removes that asymmetry. Sort/group chips reuse the
          plain neutral `S.chip` look (the same one the removed count badges used) — filter
          chips keep their existing blue `S.chipFilter` tint, the one deliberate color accent in
          this bar, since filters already carried that "this is narrowing your view" meaning
          before this change. */}
      <div style={S.activeBar}>
        {/* Each chip's body is a real <button> (a sibling of the × button, not nested inside it —
            a <button> can't contain another interactive element, same reasoning as the toolbar's
            grouped clear buttons above) that does something specific to that chip's own kind of
            active state, so tweaking an already-active sort/group/filter no longer requires
            reopening its dropdown and re-navigating to the same entry. */}
        {/* Group chips render before sort chips — matches the Sort dropdown's own "Group order"
            section coming before "Active sorts", since grouping is the structural, primary
            concern and tie-break sorting is secondary. */}
        {groupBy.map((key) => {
          const col = groupableCols.find((c) => c.key === key)
          return (
            <span key={key} style={S.chip}>
              {/* Opens the Group dropdown focused on this entry's row — there's no single
                    obvious inline toggle for a group entry the way direction is for sort, so
                    getting straight to it (ready to reorder/remove) is the most useful available
                    action. Reuses pendingGroupFocusKey (see above) since it already matches on
                    the same data-group-key the dropdown's own active row carries. */}
              <button
                type="button"
                onClick={() => {
                  pendingGroupFocusKey.current = key
                  setOpenGroupDD(true)
                }}
                style={S.chipBody}
                aria-label={L.groupedBy(col?.label ?? key)}
              >
                {/* ⊞ tells it apart from the same column's sort chip (U6), groupedBy for screen readers (U28) */}
                <span aria-hidden="true">⊞</span> {col?.label ?? key}
              </button>
              <button
                type="button"
                title={L.removeGroup(col?.label ?? key)}
                aria-label={L.removeGroup(col?.label ?? key)}
                onClick={() => removeGroup(key)}
                style={S.chipX}
              >
                ×
              </button>
            </span>
          )
        })}
        {sorts.map((entry) => {
          const col = columns.find((c) => c.key === entry.key)
          return (
            <span key={entry.key} style={S.chip}>
              {/* Toggles direction in place — the same action the Sort dropdown's own
                    active-sort row already uses — no dropdown needed for the single most common
                    tweak. `entry.key` keeps this button's identity (and DOM node) stable across
                    the toggle, so it stays focused for free with no explicit refocus needed,
                    unlike Group/Filter above (whose click opens a not-yet-mounted dropdown
                    panel). */}
              <button type="button" onClick={() => toggleSortDir(entry.key)} style={S.chipBody}>
                {getSortIcon(entry.key)} {col?.label ?? entry.key}
              </button>
              <button
                type="button"
                title={L.removeSort(col?.label ?? entry.key)}
                aria-label={L.removeSort(col?.label ?? entry.key)}
                onClick={() => removeSort(entry.key)}
                style={S.chipX}
              >
                ×
              </button>
            </span>
          )
        })}
        {activeFilterCount > 0 &&
          Object.entries(filters)
            .filter(([, v]) => v.size > 0)
            .map(([key, vals]) => (
              <span key={key} style={S.chip}>
                {/* Opens the Filter dropdown straight to this column's detail pane, instead of
                    making you reopen the dropdown and re-find the column in the left list to
                    tweak a filter you already have active. Setting filterActiveCol here (rather
                    than relying solely on the column button's own onFocus/"focus follows
                    selection") means the right pane is already correct on the very first render,
                    before focus even lands on the button — both state updates are batched into
                    the same commit. */}
                <button
                  type="button"
                  onClick={openFilterColumn(key)}
                  style={{ ...S.chipBody, ...S.chipFilter }}
                >
                  {columns.find((c) => c.key === key)?.label}:{' '}
                  {summarizeFilterValues(
                    vals,
                    L.moreValues,
                    (v) =>
                      formatFilterValue(
                        columns.find((c) => c.key === key),
                        v,
                        L.emptyValue,
                      ),
                    chipSeparator(
                      filterMatchMode(
                        filterModes,
                        key,
                        columns.find((c) => c.key === key),
                      ),
                    ),
                  )}
                </button>
                <button
                  type="button"
                  title={L.clearColumnFilter}
                  aria-label={L.clearColumnFilter}
                  onClick={() => clearColumnFilter(key, 'include')}
                  style={{ ...S.chipX, ...S.chipFilter }}
                >
                  ×
                </button>
              </span>
            ))}
        {activeFilterCount > 0 &&
          // Exclude filters (see cycleFilterValue in the docs) get their own chip, distinguished
          // by a "≠" prefix instead of a translated word — same reasoning the sort/value-sort
          // icons already use symbols (↑/↓, ABC/#) rather than growing every locale file.
          // chipExclude tints it apart from a plain include chip so the two read as opposite
          // actions at a glance, not just different text.
          Object.entries(excludeFilters)
            .filter(([, v]) => v.size > 0)
            .map(([key, vals]) => {
              const col = columns.find((c) => c.key === key)
              // Names the kept values when fewer are kept than hidden
              const chip = exclusionChip(
                vals,
                table.filter.valueMap[key],
                !!col && isExcludeOnlyColumn(data, col),
              )
              const tint = chip.kept ? S.chipFilter : S.chipExclude
              return (
                <span key={`exclude-${key}`} style={S.chip}>
                  <button
                    type="button"
                    onClick={openFilterColumn(key)}
                    style={{ ...S.chipBody, ...tint }}
                  >
                    {col?.label}: {chip.kept ? '' : '≠ '}
                    {summarizeFilterValues(chip.values, L.moreValues, (v) =>
                      formatFilterValue(col, v, L.emptyValue),
                    )}
                  </button>
                  <button
                    type="button"
                    title={L.clearColumnFilter}
                    aria-label={L.clearColumnFilter}
                    onClick={() => clearColumnFilter(key, 'exclude')}
                    style={{ ...S.chipX, ...tint }}
                  >
                    ×
                  </button>
                </span>
              )
            })}
        {activeFilterCount > 0 &&
          // A range filter (number or date) didn't get a chip at all before — it's a distinct
          // active filter from the checklist above, so it needs its own (a date column can have
          // both active at once).
          Object.entries(rangeFilters)
            .filter(([, rf]) => rf.min !== '' || rf.max !== '')
            .map(([key, rf]) => (
              <span key={`range-${key}`} style={S.chip}>
                <button
                  type="button"
                  onClick={openFilterColumn(key)}
                  style={{ ...S.chipBody, ...S.chipFilter }}
                >
                  {columns.find((c) => c.key === key)?.label}:{' '}
                  {rangeChipText(
                    columns.find((c) => c.key === key),
                    rf,
                    L.emptyValue,
                  )}
                </button>
                <button
                  type="button"
                  title={L.clearColumnFilter}
                  aria-label={L.clearColumnFilter}
                  onClick={() => clearColumnFilter(key, 'range')}
                  style={{ ...S.chipX, ...S.chipFilter }}
                >
                  ×
                </button>
              </span>
            ))}
        <span style={S.stats}>
          {L.rowCount(processedData.length, data.length)}
          {groupBy.length > 0 && L.groupCount(new Set(groupedData.map((g) => g.key)).size)}
        </span>
      </div>

      {/* Table */}
      <div className="dt-table-wrap">
        <table className="dt-table">
          <thead>
            <tr>
              {selectable && (
                <th
                  className="dt-th dt-check-cell"
                  style={{ width: 36 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (e.target === e.currentTarget) toggleSelectAll(processedData)
                  }}
                >
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    aria-label={L.selectAll}
                    onChange={() => toggleSelectAll(processedData)}
                  />
                </th>
              )}
              {groupBy.length > 0 && <th className="dt-th dt-th--no-sort" style={{ width: 28 }} />}
              {/* Only sorts entries for a currently-rendered header count toward numbering — a
                  groupBy column can have its own sort entry (sortWithinGroups uses it to order
                  the groups themselves), but it has no header of its own to attach a number to,
                  and leaving it in would shift every later header's number for no visible reason. */}
              {(() => {
                const headerSorts = sorts.filter((s) => activeColumns.some((c) => c.key === s.key))
                return activeColumns.map((col) => {
                  const sortDir = headerSorts.find((s) => s.key === col.key)?.dir
                  const isSorted = sortDir !== undefined
                  // A number is only useful to disambiguate priority when more than one visible
                  // header is sorted — with just one, "1↑" is noise next to a plain "↑".
                  const sortIdx =
                    isSorted && headerSorts.length > 1
                      ? getHeaderSortIndex(headerSorts, col.key)
                      : null
                  const icon = isSorted ? getHeaderSortIcon(headerSorts, col.key) : '↕'
                  const labelAndIcon = (
                    <>
                      {col.label}
                      {col.sortable !== false && (
                        <span
                          className={`dt-sort-icon${isSorted ? ' dt-sort-icon--active' : ''}`}
                          aria-hidden="true"
                        >
                          {sortIdx ? `${sortIdx}${icon}` : icon}
                        </span>
                      )}
                    </>
                  )
                  return (
                    <th
                      key={col.key}
                      aria-sort={
                        sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                      className={`dt-th${dragOverColKey === col.key ? ' dt-dd-item--drag-over' : ''}`}
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
                      style={{ width: col.width }}
                      // Plain click: sort by this column alone, discarding other active sorts.
                      // Shift-click: add this column to the multi-sort (or flip its direction if
                      // it's already in it) — never removes, so it can't surprise-clear a sort or
                      // bump a column to the end of the priority stack; that's the chip ×/dropdown's job.
                      // No-op entirely when the column opts out via sortable: false.
                      onClick={(e) => {
                        if (col.sortable === false) return
                        if (e.shiftKey) appendOrToggleSort(col.key)
                        else replaceSort(col.key)
                      }}
                    >
                      <span className="dt-th-inner">
                        {/* Takes the free space before the label, since the menu's auto margin defeats justifyContent */}
                        {col.align === 'end' && <span className="dt-th-spacer" />}
                        {/* A button so keyboard users can sort; its click bubbles to the <th>'s handler */}
                        {col.sortable === false ? (
                          labelAndIcon
                        ) : (
                          <button type="button" className="dt-th-sort">
                            {labelAndIcon}
                          </button>
                        )}
                        <HeaderMenu
                          menuLabel={L.columnMenu(col.label, false)}
                          column={col.label}
                          label={L.columnMenu(
                            col.label,
                            columnHasActiveFilter(col.key, filters, excludeFilters, rangeFilters),
                          )}
                          labels={L}
                          items={getHeaderMenuItems(
                            col,
                            groupBy,
                            activeColumns.length,
                            columnHasActiveFilter(col.key, filters, excludeFilters, rangeFilters),
                          )}
                          filtered={columnHasActiveFilter(
                            col.key,
                            filters,
                            excludeFilters,
                            rangeFilters,
                          )}
                          filterPane={
                            <FilterPane table={table} data={data} columns={columns} col={col} />
                          }
                          onClearFilter={() => {
                            clearColumnFilter(col.key, 'include')
                            clearColumnFilter(col.key, 'exclude')
                            clearColumnFilter(col.key, 'range')
                          }}
                          onGroup={() => toggleGroup(col.key)}
                          onHide={() => toggleColVisibility(col.key)}
                        />
                      </span>
                    </th>
                  )
                })
              })()}
            </tr>
          </thead>
          <tbody>
            {groupedData.map(({ key: gkey, keyParts, rows, continued, sampleRow }) => {
              const isCollapsed =
                gkey !== null && isGroupCollapsed(collapsedGroups, gkey, defaultGroupsCollapsed)
              return [
                gkey !== null && (
                  <tr
                    key={`g-${gkey}`}
                    ref={(el) => {
                      if (el) rowRefs.current.set(gkey, el)
                      else rowRefs.current.delete(gkey)
                    }}
                    tabIndex={isFocusTarget({ kind: 'group', key: gkey }) ? 0 : -1}
                    aria-expanded={!isCollapsed}
                    onKeyDown={(e) => handleKeyDown(e, { kind: 'group', key: gkey })}
                    onFocus={() => setFocusTarget({ kind: 'group', key: gkey })}
                    className="dt-group-row"
                    onClick={() => toggleGroupCollapse(gkey)}
                  >
                    {selectable && (
                      <td
                        className="dt-group-td dt-check-cell"
                        style={{ width: 36 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (e.target === e.currentTarget) toggleSelectAll(rows)
                        }}
                      >
                        <input
                          ref={(el) => {
                            if (el) el.indeterminate = groupSomeSelected(rows)
                          }}
                          type="checkbox"
                          checked={groupAllSelected(rows)}
                          aria-label={L.selectGroup(
                            groupText(columns, groupBy, keyParts, sampleRow!),
                          )}
                          onChange={() => toggleSelectAll(rows)}
                        />
                      </td>
                    )}
                    <td className="dt-group-td" style={{ width: 28 }}>
                      {isCollapsed ? '▶' : '▼'}
                    </td>
                    <td colSpan={activeColumns.length} className="dt-group-td">
                      {groupBy.map((g, i) => {
                        const col = columns.find((c) => c.key === g)
                        // A bucketed group (see groupValue/groupFormat) has no single row whose
                        // real value *is* the group — the sample row's own value/format would
                        // show e.g. a raw "47%" instead of the "40–50%" bucket it landed in — so
                        // its label renders from the group's own keyPart via groupFormat instead
                        // of the normal cellValue/format pipeline.
                        const label = col?.groupValue
                          ? (col.groupFormat?.(keyParts[i]) ?? keyParts[i])
                          : (() => {
                              const raw = col ? getColumnValue(col, sampleRow!) : undefined
                              const value = Array.isArray(raw) ? keyParts[i] : raw
                              return col ? formatValue(value, sampleRow!, col) : String(value ?? '')
                            })()
                        return (
                          <span key={g}>
                            {i > 0 && <span className="dt-group-sep"> › </span>}
                            <span className="dt-group-colname">{col?.label ?? g}:</span> {label}
                          </span>
                        )
                      })}
                      {continued && (
                        <>
                          {' '}
                          <span className="dt-group-continued">{L.groupContinued}</span>
                        </>
                      )}{' '}
                      <span className="dt-group-count">{L.rowsInGroup(rows.length)}</span>
                    </td>
                  </tr>
                ),
                gkey !== null && hasAggregates && (
                  <tr key={`agg-${gkey}`} className="dt-agg-row">
                    {selectable && <td className="dt-agg-td" style={{ width: 36 }} />}
                    <td className="dt-agg-td" style={{ width: 28 }} />
                    {activeColumns.map((col) => {
                      const v = computeAggregate(col, rows)
                      return (
                        <td key={col.key} className="dt-agg-td" style={{ textAlign: col.align }}>
                          {v !== undefined && v !== null
                            ? col.format
                              ? col.format(v, sampleRow!)
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
                      key={String(
                        rowKey ? (asRecord(row)[rowKey] ?? `${gkey}-${ri}`) : `${gkey}-${ri}`,
                      )}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row, el)
                        else rowRefs.current.delete(row)
                      }}
                      tabIndex={
                        rowNavEnabled ? (isFocusTarget({ kind: 'row', row }) ? 0 : -1) : undefined
                      }
                      aria-selected={selectable ? selection.has(row) : undefined}
                      aria-current={row === currentRow ? 'true' : undefined}
                      className={rowClass(
                        !!selectable && selection.has(row),
                        ri % 2 !== 0,
                        !!onRowClick,
                        row === currentRow,
                      )}
                      onKeyDown={
                        rowNavEnabled ? (e) => handleKeyDown(e, { kind: 'row', row }) : undefined
                      }
                      onFocus={
                        rowNavEnabled ? () => setFocusTarget({ kind: 'row', row }) : undefined
                      }
                      onClick={onRowClick ? (e) => onRowClick(row, e) : undefined}
                    >
                      {selectable && (
                        <td
                          className="dt-td dt-check-cell"
                          style={{ width: 36 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (e.target === e.currentTarget) toggleRowSelection(row, e.shiftKey)
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selection.has(row)}
                            readOnly
                            aria-label={L.selectRow(rowText(activeColumns, row))}
                            tabIndex={-1}
                            onClick={(e) => toggleRowSelection(row, e.shiftKey)}
                          />
                        </td>
                      )}
                      {gkey !== null && <td className="dt-td" style={{ width: 28 }} />}
                      {activeColumns.map((col) => (
                        <td key={col.key} className="dt-td" style={{ textAlign: col.align }}>
                          {cellValue(row, col)}
                        </td>
                      ))}
                    </tr>
                  )),
              ]
            })}
            {processedData.length === 0 && (
              <tr>
                <td
                  colSpan={
                    activeColumns.length + (selectable ? 1 : 0) + (groupBy.length > 0 ? 1 : 0)
                  }
                  className="dt-td dt-empty"
                >
                  {data.length === 0 ? (
                    L.noRows
                  ) : (
                    <>
                      {L.noMatchingRows}{' '}
                      <button
                        type="button"
                        className="dt-btn"
                        onClick={() => {
                          clearFilters()
                          setSearchQuery('')
                          focusSearch()
                        }}
                      >
                        {L.clearSearchAndFilters}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && showsPager(visibleItems.length, pageSizes) && (
        <div style={S.pagination}>
          {numPages > 1 && (
            <>
              <button
                onClick={() => setPage(1)}
                aria-label={L.firstPage}
                disabled={page === 1}
                style={{ ...S.pageBtn, ...(page === 1 ? S.pageBtnDisabled : {}) }}
              >
                «
              </button>
              <button
                onClick={() => setPage(page - 1)}
                aria-label={L.previousPage}
                disabled={page === 1}
                style={{ ...S.pageBtn, ...(page === 1 ? S.pageBtnDisabled : {}) }}
              >
                ‹
              </button>
              <span style={S.pageInfo}>{L.pageOf(page, numPages)}</span>
              <button
                onClick={() => setPage(page + 1)}
                aria-label={L.nextPage}
                disabled={page >= numPages}
                style={{ ...S.pageBtn, ...(page >= numPages ? S.pageBtnDisabled : {}) }}
              >
                ›
              </button>
              <button
                onClick={() => setPage(numPages)}
                aria-label={L.lastPage}
                disabled={page >= numPages}
                style={{ ...S.pageBtn, ...(page >= numPages ? S.pageBtnDisabled : {}) }}
              >
                »
              </button>
            </>
          )}
          <label style={S.rowsPerPageGroup}>
            <span style={S.rowsPerPageLabel}>{L.rowsPerPage}:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={S.pageSelect}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
