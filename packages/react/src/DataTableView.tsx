import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  computeAggregate,
  computeStringValueCounts,
  getColumnValue,
  filterValuesBySearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir as toggleValueSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  findDateTreeNode,
  selectDateRange,
  selectRange,
  isGroupCollapsed,
  isSameVisibleItem,
  indexOfVisibleItem,
  paginateVisibleItems,
  mergePageSizeOptions,
  computeVirtualRange,
  getSortIndex as getHeaderSortIndex,
  getSortIcon as getHeaderSortIcon,
  summarizeFilterValues,
  type DateTreeNode,
  type ValueSort,
  type VisibleItem,
} from '@vates/data-table-core'
import { Dropdown } from './components/Dropdown'
import { ToolbarBtn } from './components/ToolbarBtn'
import { useDropdownReorder } from './hooks/useDropdownReorder'
import type { ColumnDef, DataTableViewProps } from './types'

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
  wrap: {
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'var(--color-text-primary)',
  } as CSSProperties,
  toolbar: {
    padding: '12px 0',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  } as CSSProperties,
  toolbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  } as CSSProperties,
  // Separates the "shape" controls (Columns/Sort/Group — what's shown and in what order) from
  // the "find" controls (Search/Filter — which rows are shown at all).
  toolbarDivider: {
    width: 1,
    height: 22,
    background: 'var(--color-border-secondary)',
    flexShrink: 0,
    margin: '0 2px',
  } as CSSProperties,
  clearAll: {
    marginLeft: 'auto',
    padding: '5px 10px',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
  } as CSSProperties,
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
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
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
    background: 'var(--color-background-tertiary)',
    color: 'var(--color-text-secondary)',
    borderBottom: '1px solid var(--color-border-secondary)',
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
  // Applied to a checklist row's <label> when that value is excluded (see cycleFilterValue) —
  // tints the label text to match the checkbox's own accentColor override at its call site.
  filterValueExcluded: {
    color: 'var(--color-text-danger)',
  } as CSSProperties,
  // A chip is two sibling <button>s (chipBody + chipX below), not one inert <span> — a <button>
  // can't contain another interactive element, same reasoning already used for the toolbar's
  // grouped clear buttons (btnClear). `chip` itself carries no padding/background/border anymore;
  // that moved onto chipBody/chipX individually, each keeping only its own outer corner rounded
  // and sharing a border between them so the pair still reads as one pill.
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
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
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    lineHeight: 1.4,
  } as CSSProperties,
  chipX: {
    cursor: 'pointer',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: '0 12px 12px 0',
    padding: '2px 8px 2px 2px',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    lineHeight: 1.4,
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
  groupRow: {
    background: 'var(--color-background-secondary)',
    borderLeft: '3px solid var(--color-border-secondary)',
    fontWeight: 600,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  } as CSSProperties,
  groupTd: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--color-border-secondary)',
  } as CSSProperties,
  // Adjoining × button for the Sort/Group/Filter toolbar buttons — see Dropdown's `extraTrigger`
  // and ToolbarBtn's `grouped` prop. Replaces the old in-panel "Clear sorts"/etc. footer rows
  // with a one-click affordance that doesn't require opening the dropdown first.
  btnClear: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 8px',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: '0 6px 6px 0',
    fontSize: 14,
    lineHeight: 1,
    cursor: 'pointer',
    color: 'var(--color-text-tertiary)',
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
  itemRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: 13,
    color: 'var(--color-text-tertiary)',
    lineHeight: 1,
  } as CSSProperties,
  // Button reset merged onto ddItem for rows rendered as <button> (add-lists, filter column
  // selector) instead of <div> — needed for keyboard reachability (see those call sites).
  ddItemButton: {
    border: 'none',
    background: 'none',
    fontFamily: 'inherit',
    textAlign: 'left',
    margin: 0,
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,
  pageInfo: {
    fontSize: 12,
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
    fontSize: 12,
    color: 'var(--color-text-secondary)',
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
  searchWrap: {
    position: 'relative',
    display: 'inline-flex',
    flex: 1,
    minWidth: 160,
    maxWidth: 280,
  } as CSSProperties,
  searchInput: {
    padding: '4px 24px 4px 8px',
    fontSize: 13,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    width: '100%',
  } as CSSProperties,
  searchClear: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: 14,
    lineHeight: 1,
    color: 'var(--color-text-tertiary)',
    fontFamily: 'inherit',
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
  // overflow:hidden is a safety net for the date tree (see filterDateTreeWrap below) — without
  // it, content that outgrows maxHeight would bleed past the panel onto the page instead of
  // being clipped/scrolled, since maxHeight alone doesn't clip.
  filterPanel: {
    display: 'flex',
    minWidth: 460,
    maxHeight: 380,
    overflow: 'hidden',
  } as CSSProperties,
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
    padding: '5px 8px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  } as CSSProperties,
  // Wraps the Columns/Sort/Group dropdowns' own column-search box — sticky so it stays put while
  // a long list scrolls underneath it (the panel itself scrolls, see Dropdown.tsx's maxHeight).
  ddSearchRow: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    background: 'var(--color-background-primary)',
    padding: '6px 12px',
    zIndex: 1,
  } as CSSProperties,
  // Same idea, scoped to the Filter dropdown's left column pane (its own scrollable box).
  filterColsSearch: {
    position: 'sticky',
    top: 0,
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 4,
    background: 'var(--color-background-primary)',
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

/** Formats a bound (epoch ms for a date column, a plain number otherwise) back into the string
 * shape `RangeFilter.min`/`.max` uses — shared by the slider's onChange and the plain min/max
 * inputs' own data-derived default value. */
function formatRangeBound(n: number, col: { type?: string }): string {
  return col.type === 'date' ? new Date(n).toISOString().slice(0, 10) : String(n)
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
  onChange,
}: {
  bounds: { min: number; max: number }
  low: number
  high: number
  step: number | 'any'
  onChange: (low: number, high: number) => void
}) {
  useEffect(() => {
    ensureRangeSliderStyles()
  }, [])
  const handleThumb = (raw: number, other: number) =>
    onChange(Math.min(raw, other), Math.max(raw, other))
  const pctLo = ((low - bounds.min) / (bounds.max - bounds.min)) * 100
  const pctHi = ((high - bounds.min) / (bounds.max - bounds.min)) * 100
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
        onChange={(e) => handleThumb(Number(e.target.value), low)}
        style={thumbStyle}
      />
    </div>
  )
}

/**
 * The Columns/Sort/Group/Filter dropdowns' own column-search box — narrows that dropdown's
 * column list by label, with Escape clearing the term (stopping propagation so it doesn't also
 * close the dropdown itself). `extraStyle` covers the one difference between call sites: the
 * Filter dropdown's left pane merges in `S.filterColsSearch` instead of wrapping the input in
 * `S.ddSearchRow` the way Columns/Sort/Group do.
 */
function DdSearchInput({
  value,
  onChange,
  placeholder,
  extraStyle,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  extraStyle?: CSSProperties
}) {
  return (
    <input
      type="text"
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
      style={{ ...S.ddSearch, ...extraStyle }}
    />
  )
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
  const [focusTarget, setFocusTarget] = useState<VisibleItem<TRow> | null>(null)
  const rowRefs = useRef(new Map<TRow | string, HTMLTableRowElement>())
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterActiveCol, setFilterActiveCol] = useState<string | null>(null)
  const [filterSearchTerms, setFilterSearchTerms] = useState<Record<string, string>>({})
  const [filterSelectionAnchor, setFilterSelectionAnchor] = useState<Record<string, string>>({})
  const [expandedDateNodes, setExpandedDateNodes] = useState<Record<string, Set<string>>>({})
  const [filterValueSort, setFilterValueSort] = useState<Record<string, ValueSort>>({})
  const [filterListScrollTop, setFilterListScrollTop] = useState(0)
  const filterListRef = useRef<HTMLDivElement>(null)
  const filterListRafPending = useRef(false)
  // Narrows the *column list* itself in the Columns/Sort/Group dropdowns and the Filter
  // dropdown's left column pane — a separate concern from `filterSearchTerms` above, which
  // narrows one column's *values* in the Filter dropdown's right detail pane. Keyed by dropdown
  // id ('cols'/'sort'/'group'/'filter'), same ephemeral-UI-state category as `filterActiveCol`.
  const [ddSearchTerms, setDdSearchTerms] = useState<Record<string, string>>({})
  // Root ref purely so the two pending-focus effects below can scope their DOM queries to *this*
  // table instance — a plain `document.querySelector` by column key would risk matching another
  // <DataTable> on the same page whose columns happen to share a key.
  const rootRef = useRef<HTMLDivElement>(null)
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
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (pendingSortFocusKey.current) {
      const key = pendingSortFocusKey.current
      pendingSortFocusKey.current = null
      for (const el of root.querySelectorAll<HTMLElement>('[data-sort-key], [data-sort-add-key]')) {
        if (el.dataset.sortKey === key || el.dataset.sortAddKey === key) {
          el.focus()
          break
        }
      }
    }
    if (pendingGroupFocusKey.current) {
      const key = pendingGroupFocusKey.current
      pendingGroupFocusKey.current = null
      for (const el of root.querySelectorAll<HTMLElement>(
        '[data-group-key], [data-group-add-key]',
      )) {
        if (el.dataset.groupKey === key || el.dataset.groupAddKey === key) {
          el.focus()
          break
        }
      }
    }
    if (pendingFilterColFocusKey.current) {
      const key = pendingFilterColFocusKey.current
      pendingFilterColFocusKey.current = null
      for (const el of root.querySelectorAll<HTMLElement>('[data-filter-col-key]')) {
        if (el.dataset.filterColKey === key) {
          el.focus()
          break
        }
      }
    }
  })

  // `table`'s own fields are namespaced by concern (see CLAUDE.md's "Namespaced TableState") —
  // destructured here into the same bare local names this component's ~2600 lines already use
  // throughout, so nothing below this block needed to change when the namespacing landed.
  const { processedData, groupedData, visibleItems, labels: L, clearAll } = table
  const {
    visible: visibleCols,
    active: activeColumns,
    ordered: orderedColumns,
    toggleVisibility: toggleColVisibility,
    move: moveColumn,
    moveBy: moveColumnBy,
  } = table.columns
  const {
    entries: sorts,
    toggle: toggleSort,
    replace: replaceSort,
    appendOrToggle: appendOrToggleSort,
    remove: removeSort,
    toggleDir: toggleSortDir,
    moveBy: moveSortBy,
    move: moveSort,
    clear: clearSorts,
    icon: getSortIcon,
    index: getSortIndex,
  } = table.sort
  const {
    include: filters,
    exclude: excludeFilters,
    ranges: rangeFilters,
    activeCount: activeFilterCount,
    valueMap: stringValueMap,
    toggleAll: toggleFilterAll,
    setValues: setFilterValues,
    cycleValue: cycleFilterValue,
    clearExcludeValues,
    setRange: setRangeFilter,
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

  // Kept independent from dragColKey/dragOverColKey above (the <th> header drag state), even
  // though both ultimately reorder columnOrder — mirrors vanilla giving each dropdown its own
  // drag state instead of a shared one.
  const {
    dragKey: dragColRowKey,
    dragOverKey: dragOverColRowKey,
    dragOverAfter: dragOverColRowAfter,
    onRowDragStart: onColRowDragStart,
    onRowDragEnd: onColRowDragEnd,
    onDragOver: onColRowsDragOver,
    onDrop: onColRowsDrop,
  } = useDropdownReorder('data-col-row-key', moveColumn)
  const {
    dragKey: dragSortKey,
    dragOverKey: dragOverSortKey,
    dragOverAfter: dragOverSortAfter,
    onRowDragStart: onSortRowDragStart,
    onRowDragEnd: onSortRowDragEnd,
    onDragOver: onSortRowsDragOver,
    onDrop: onSortRowsDrop,
  } = useDropdownReorder('data-sort-key', moveSort)
  const {
    dragKey: dragGroupKey,
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

  // Roving tabindex: exactly one item (a data row or a group header row) is a Tab stop at a
  // time (the rest are tabIndex={-1}), arrow keys move it, matching how the checklist/date-tree
  // checkboxes reuse the same anchor idea for range selection. Data rows only join the tab
  // sequence when they're actually interactive; group headers always do, since collapsing a
  // group is already a click away regardless of selectable/onRowClick.
  const rowNavEnabled = selectable || !!onRowClick
  const pageVisibleItems = paginateVisibleItems(visibleItems, page, pageSize)
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
  // `visibleItems` (from `table`) already covers the *full* filtered/grouped dataset, so jumping
  // to an arbitrary page is just slicing it again (with the same continuation-header handling as
  // the current page), no re-grouping needed.
  const visibleItemsForPage = (p: number): VisibleItem<TRow>[] =>
    paginateVisibleItems(visibleItems, p, pageSize).filter(
      (item) => item.kind === 'group' || rowNavEnabled,
    )

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
        } else if (delta === 1 && page < numPages) {
          const next = visibleItemsForPage(page + 1)[0]
          if (next) {
            e.preventDefault()
            if (e.shiftKey && selectable && next.kind === 'row') toggleRowSelection(next.row, true)
            pendingFocusTarget.current = next
            setPage(page + 1)
          }
        } else if (delta === -1 && page > 1) {
          const prevItems = visibleItemsForPage(page - 1)
          const next = prevItems[prevItems.length - 1]
          if (next) {
            e.preventDefault()
            if (e.shiftKey && selectable && next.kind === 'row') toggleRowSelection(next.row, true)
            pendingFocusTarget.current = next
            setPage(page - 1)
          }
        }
        break
      }
      case 'Home':
      case 'End': {
        if (e.ctrlKey || e.metaKey) {
          const targetPage = e.key === 'Home' ? 1 : numPages
          const targetItems = targetPage === page ? navigableItems : visibleItemsForPage(targetPage)
          const next = e.key === 'Home' ? targetItems[0] : targetItems[targetItems.length - 1]
          if (next) {
            e.preventDefault()
            if (e.shiftKey && selectable && next.kind === 'row') toggleRowSelection(next.row, true)
            if (targetPage === page) focusItem(next)
            else {
              pendingFocusTarget.current = next
              setPage(targetPage)
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
  // Sort/Group dropdowns split into an "active" section (priority order, reorderable) and an
  // "add" section (everything else) — reordering only ever makes sense among active entries.
  const addableSortCols = columns.filter(
    (c) => c.sortable !== false && getSortIndex(c.key) === null,
  )
  const addableGroupCols = groupableCols.filter((c) => !groupBy.includes(c.key))
  // Narrows a dropdown's own column list by label (see `ddSearchTerms`) — the Columns dropdown
  // keeps its own `orderedColumns` order untouched (it doubles as the drag-to-reorder surface,
  // so its order carries meaning no alphabetization should disturb); Sort/Group's addable lists
  // and the Filter dropdown's left pane have no such order to preserve (none of these columns
  // are sorted/grouped/filtered yet), so they're alphabetized by label to make a long list
  // easier to scan.
  const searchCols = <T extends { label: string }>(cols: T[], term: string): T[] => {
    const t = term.trim().toLowerCase()
    return t ? cols.filter((c) => c.label.toLowerCase().includes(t)) : cols
  }
  const searchedOrderedColumns = searchCols(orderedColumns, ddSearchTerms.cols ?? '')
  const searchedAddableSortCols = searchCols(addableSortCols, ddSearchTerms.sort ?? '')
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
  const searchedAddableGroupCols = searchCols(addableGroupCols, ddSearchTerms.group ?? '')
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
  const searchedFilterableCols = searchCols(filterableCols, ddSearchTerms.filter ?? '')
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
  const filterActiveKey =
    filterActiveCol && filterableCols.some((c) => c.key === filterActiveCol)
      ? filterActiveCol
      : (filterableCols[0]?.key ?? null)
  const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
  // The filter dropdown is master-detail — only filterDetailCol's checklist is ever rendered —
  // so facet counts only need computing for that one column, not every filterable column (see
  // computeStringValueCounts's targetKeys param). Deliberately not wrapped in a manual useMemo:
  // this package's vite.config.ts doesn't wire in the actual React Compiler babel plugin yet, so
  // this genuinely does recompute on every render for now — but eslint.config.mjs's
  // eslint-plugin-react-hooks@7 `recommended` ruleset already enforces the compiler's own
  // constraints (`react-hooks/preserve-manual-memoization`) in preparation for enabling it, and
  // that rule actively rejects hand-written `useMemo` here (its dependency-mutability analysis
  // can't verify these particular deps stay safe to preserve). Adding manual memoization now would
  // have to be undone the moment the compiler is actually wired in, so this is intentionally left
  // for the compiler to take over rather than hand-optimized in a way that fights it.
  const stringValueCounts = computeStringValueCounts(
    data,
    filters,
    rangeFilters,
    columns,
    L.emptyValue,
    filterActiveKey ? [filterActiveKey] : [],
    excludeFilters,
  )
  // Bounds are the column's actual min/max across the full, unfiltered `data` (not
  // filtered/processed data) — see computeValueBounds — so they don't shift under a mid-drag
  // user just because some other filter narrowed the row set. Computed once by the caller (see
  // filterDetailBounds below) and shared with the plain min/max inputs' own default value, rather
  // than recomputed here on every render.
  const renderRangeSliderFor = (
    col: ColumnDef<TRow>,
    bounds: { min: number; max: number } | null,
  ) => {
    if (!bounds || bounds.min >= bounds.max) return null
    const rf = rangeFilters[col.key]
    const isDate = col.type === 'date'
    const toNum = (v: string) => (isDate ? new Date(v).getTime() : Number(v))
    const low = rf?.min ? toNum(rf.min) : bounds.min
    const high = rf?.max ? toNum(rf.max) : bounds.max
    return (
      <RangeSlider
        bounds={bounds}
        low={Math.min(low, high)}
        high={Math.max(low, high)}
        step={isDate ? 24 * 60 * 60 * 1000 : 'any'}
        onChange={(lo, hi) => {
          setRangeFilter(col.key, 'min', formatRangeBound(lo, col))
          setRangeFilter(col.key, 'max', formatRangeBound(hi, col))
        }}
      />
    )
  }
  // Unset min/max inputs default to this same bounds value (via formatRangeBound) rather than
  // sitting empty — a blank box gives no hint of what range is even meaningful for this column,
  // and it means the slider's own thumbs (which already fell back to these bounds) no longer
  // visually disagree with the text inputs next to them.
  const filterDetailBounds =
    filterDetailCol && (filterDetailCol.type === 'number' || filterDetailCol.type === 'date')
      ? computeValueBounds(data, filterDetailCol)
      : null
  const valueSortFor = (key: string) =>
    filterValueSort[key] ??
    columns.find((c) => c.key === key)?.defaultValueSort ??
    DEFAULT_VALUE_SORT
  const cycleFilterValueSort = (col: ColumnDef<TRow>) => {
    const current = valueSortFor(col.key)
    const next =
      col.type === 'date'
        ? { ...current, dir: toggleValueSortDir(current.dir) }
        : cycleValueSort(current)
    setFilterValueSort({ ...filterValueSort, [col.key]: next })
  }
  const filterDetailValues =
    filterDetailCol && filterDetailCol.type !== 'number'
      ? sortFilterValues(
          filterValuesByCount(
            // Narrowed by the date range filter (if any), same as by search — a value outside
            // the active range never becomes a tree leaf, rather than merely being ANDed onto
            // the final row set once ticked. A no-op for string columns (they never populate
            // rangeFilters).
            filterValuesByRange(
              filterValuesBySearch(
                stringValueMap[filterDetailCol.key] ?? [],
                filterSearchTerms[filterDetailCol.key] ?? '',
              ),
              rangeFilters[filterDetailCol.key],
              filterDetailCol.parseDate,
            ),
            stringValueCounts[filterDetailCol.key] ?? new Map(),
            filters[filterDetailCol.key] ?? new Set(),
          ),
          stringValueCounts[filterDetailCol.key] ?? new Map(),
          valueSortFor(filterDetailCol.key),
          filterDetailCol.compare,
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

  // Reset the virtualized checklist's scroll position whenever the values it's scrolled
  // through change identity — switching columns or narrowing by search both shift what row 0
  // even means, so staying scrolled to the same pixel offset would show an unrelated slice.
  // Comparing against the previous render (rather than an effect) is React's own documented
  // pattern for "adjust state when a prop changes" — https://react.dev/reference/react/useState#storing-information-from-previous-renders —
  // and avoids the cascading-render lint error a setState-in-effect would trigger.
  const filterListSearchTerm = filterDetailCol ? (filterSearchTerms[filterDetailCol.key] ?? '') : ''
  const filterListResetKey = `${filterActiveKey ?? ''}::${filterListSearchTerm}`
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
  const pendingFilterValueFocus = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!pendingFilterValueFocus.current) return
    const value = pendingFilterValueFocus.current
    pendingFilterValueFocus.current = null
    const list = filterListRef.current
    if (!list) return
    for (const cb of list.querySelectorAll<HTMLInputElement>('input[data-dd-value-row]')) {
      if (cb.dataset.value === value) {
        cb.focus()
        break
      }
    }
  }, [filterListScrollTop])

  const focusChecklistIndex = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= filterDetailValues.length) return
    const value = filterDetailValues[targetIdx]
    const rowTop = targetIdx * FILTER_LIST_ITEM_HEIGHT
    let newScrollTop = filterListScrollTop
    if (rowTop < filterListScrollTop) newScrollTop = rowTop
    else if (rowTop + FILTER_LIST_ITEM_HEIGHT > filterListScrollTop + FILTER_LIST_VIEWPORT_HEIGHT) {
      newScrollTop = rowTop + FILTER_LIST_ITEM_HEIGHT - FILTER_LIST_VIEWPORT_HEIGHT
    }
    newScrollTop = Math.max(0, newScrollTop)
    if (newScrollTop !== filterListScrollTop) {
      pendingFilterValueFocus.current = value
      if (filterListRef.current) filterListRef.current.scrollTop = newScrollTop
      setFilterListScrollTop(newScrollTop)
      return
    }
    // Already in the rendered window — focus directly, no need to wait for a re-render.
    const list = filterListRef.current
    if (!list) return
    for (const cb of list.querySelectorAll<HTMLInputElement>('input[data-dd-value-row]')) {
      if (cb.dataset.value === value) {
        cb.focus()
        break
      }
    }
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

    if (targetEl.closest('[data-filter-col-key]') && e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
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

    if (
      filterDetailEl &&
      (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End')
    ) {
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
      if (!active || focusables.indexOf(active) === -1) return

      // The flat checklist is virtualized — crossing out of the rendered window, or Home/End
      // (which must reach the *logical* first/last value, not just whatever's currently
      // rendered), needs the scroll-then-focus dance in focusChecklistIndex above. The date tree
      // has no such window (every currently-expanded row is already in the DOM), so it falls
      // straight through to the plain DOM-order nav below.
      if (filterListRef.current && filterDetailCol && filterDetailCol.type !== 'date') {
        const activeValue =
          active instanceof HTMLInputElement && active.dataset.value !== undefined
            ? active.dataset.value
            : undefined
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
              focusChecklistIndex(targetIdx)
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
              data-dd-value-row
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

  return (
    <div style={S.wrap} ref={rootRef}>
      <div style={S.toolbar}>
        <div style={S.toolbarActions}>
          {/* Columns */}
          <Dropdown
            open={openColsDD}
            setOpen={setOpenColsDD}
            trigger={<ToolbarBtn active={openColsDD}>{L.columns}</ToolbarBtn>}
            onDragOver={onColRowsDragOver}
            onDrop={onColRowsDrop}
          >
            {/* Narrows the list below by label (see ddSearchTerms) — ordering itself is left
                untouched (still orderedColumns, i.e. real table column order): this list also
                doubles as the drag-to-reorder surface, so its order carries meaning no
                alphabetization should disturb. */}
            <div style={S.ddSearchRow}>
              <DdSearchInput
                value={ddSearchTerms.cols ?? ''}
                onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, cols: v })}
                placeholder={L.filterSearchPlaceholder}
              />
            </div>
            <div style={S.ddSection}>{L.columnsSection}</div>
            {searchedOrderedColumns.map((col) => (
              // Draggable (+ Alt+↑/↓ on the checkbox below) reorders columnOrder, replacing the
              // old ▲▼ buttons — same treatment as the Sort/Group active rows. The row itself gets
              // no tabIndex: the checkbox is already a native Tab stop, so a second one on the row
              // would just be a redundant, visually-identical stop for the same rectangle.
              // dragover/drop are handled at the Dropdown panel level (see above), not per-row —
              // that's what lets a drop past the last row still resolve to a valid target.
              <div
                key={col.key}
                data-col-row-key={col.key}
                data-dd-row
                draggable
                onDragStart={() => onColRowDragStart(col.key)}
                onDragEnd={onColRowDragEnd}
                style={{
                  ...S.ddItem,
                  justifyContent: 'space-between',
                  cursor: 'grab',
                  opacity: dragColRowKey === col.key ? 0.4 : 1,
                  boxShadow:
                    dragOverColRowKey === col.key
                      ? `inset 0 ${dragOverColRowAfter ? '-2px' : '2px'} 0 var(--color-text-primary)`
                      : undefined,
                }}
              >
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
                    onKeyDown={(e) => {
                      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                        e.preventDefault()
                        moveColumnBy(col.key, e.key === 'ArrowUp' ? -1 : 1)
                      }
                    }}
                    style={{ margin: 0 }}
                  />
                  {col.label}
                </label>
              </div>
            ))}
          </Dropdown>

          {/* Sort */}
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
                  style={S.btnClear}
                >
                  ×
                </button>
              )
            }
            onDragOver={onSortRowsDragOver}
            onDrop={onSortRowsDrop}
          >
            {sorts.length > 0 && (
              <>
                <div style={S.ddSection}>{L.activeSortsSection}</div>
                {sorts.map((entry, i) => {
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
                          moveSortBy(entry.key, e.key === 'ArrowUp' ? -1 : 1)
                        }
                      }}
                      style={{
                        ...S.ddItem,
                        justifyContent: 'space-between',
                        opacity: dragSortKey === entry.key ? 0.4 : 1,
                        boxShadow:
                          dragOverSortKey === entry.key
                            ? `inset 0 ${dragOverSortAfter ? '-2px' : '2px'} 0 var(--color-text-primary)`
                            : undefined,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          fontSize: 11,
                          color: 'var(--color-text-tertiary)',
                          fontWeight: 500,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ flex: 1 }}>{col?.label ?? entry.key}</span>
                      <span style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>
                        {getSortIcon(entry.key)}
                      </span>
                      <button
                        type="button"
                        draggable={false}
                        onClick={(e) => {
                          e.stopPropagation()
                          // Removing this entry unmounts this whole row (a different JSX subtree
                          // than the addable button it's about to become again — see
                          // pendingSortFocusKey above), so focus needs an explicit hand-off.
                          pendingSortFocusKey.current = entry.key
                          removeSort(entry.key)
                        }}
                        style={S.itemRemove}
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
                <div style={S.ddSearchRow}>
                  <DdSearchInput
                    value={ddSearchTerms.sort ?? ''}
                    onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, sort: v })}
                    placeholder={L.filterSearchPlaceholder}
                  />
                </div>
                <div style={S.ddSection}>{L.sortSection}</div>
                {searchedAddableSortCols.map((col) => (
                  // A real <button> (not a div) so it's a native Tab stop and Enter/Space
                  // "click" it for free — no manual tabIndex/keydown wiring needed, unlike the
                  // active rows above (which need custom keyboard handling anyway for Alt+↑/↓).
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
                    style={{ ...S.ddItem, ...S.ddItemButton }}
                  >
                    <span style={{ flex: 1 }}>{col.label}</span>
                  </button>
                ))}
              </>
            )}
          </Dropdown>

          {/* Group — placed right after Sort (both "shape" the view — order/columns) rather than
              after Filter, so the toolbar reads as two clusters: Columns/Sort/Group shape the
              view, Search/Filter narrow it — see the divider below. */}
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
                    style={S.btnClear}
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
                  <div style={S.ddSection}>{L.activeGroupsSection}</div>
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
                          }
                        }}
                        style={{
                          ...S.ddItem,
                          justifyContent: 'space-between',
                          cursor: 'grab',
                          opacity: dragGroupKey === key ? 0.4 : 1,
                          boxShadow:
                            dragOverGroupKey === key
                              ? `inset 0 ${dragOverGroupAfter ? '-2px' : '2px'} 0 var(--color-text-primary)`
                              : undefined,
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            fontWeight: 500,
                          }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ flex: 1 }}>{col?.label ?? key}</span>
                        <button
                          type="button"
                          draggable={false}
                          onClick={() => {
                            // Same reasoning as Sort's remove-focus hand-off above.
                            pendingGroupFocusKey.current = key
                            removeGroup(key)
                          }}
                          style={S.itemRemove}
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
                  <div style={S.ddSearchRow}>
                    <DdSearchInput
                      value={ddSearchTerms.group ?? ''}
                      onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, group: v })}
                      placeholder={L.filterSearchPlaceholder}
                    />
                  </div>
                  <div style={S.ddSection}>{L.groupSection}</div>
                  {searchedAddableGroupCols.map((col) => (
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
                      style={{ ...S.ddItem, ...S.ddItemButton }}
                    >
                      <span style={{ flex: 1 }}>{col.label}</span>
                    </button>
                  ))}
                </>
              )}
            </Dropdown>
          )}

          {/* Divider between the "shape" controls above (Columns/Sort/Group) and the "find"
              controls below (Search/Filter). */}
          <span style={S.toolbarDivider} />

          <span style={S.searchWrap}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={L.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={S.searchInput}
            />
            {searchQuery !== '' && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  searchInputRef.current?.focus()
                }}
                title={L.clearSearch}
                aria-label={L.clearSearch}
                style={S.searchClear}
              >
                ×
              </button>
            )}
          </span>

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
                    style={S.btnClear}
                  >
                    ×
                  </button>
                )
              }
            >
              <div style={S.filterPanel} onKeyDown={handleFilterPanelKeyDown}>
                <div style={S.filterCols} data-filter-cols>
                  {/* Narrows the column list itself — separate from filterSearchTerms, which
                      narrows the *values* shown in the right-hand detail pane for whichever
                      column is currently selected. No inherent order to preserve here (unlike
                      the Columns dropdown, this list isn't reorderable), so it's alphabetized. */}
                  <DdSearchInput
                    value={ddSearchTerms.filter ?? ''}
                    onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, filter: v })}
                    placeholder={L.filterSearchPlaceholder}
                    extraStyle={S.filterColsSearch}
                  />
                  {searchedFilterableCols.map((col) => {
                    const rf = rangeFilters[col.key]
                    // A date column can have both an active checklist selection (tree) *and* an
                    // active range filter above it at once — either one alone should light the
                    // dot, not just whichever one a plain type-based ternary happened to check.
                    const hasActive =
                      (filters[col.key]?.size ?? 0) > 0 ||
                      (excludeFilters[col.key]?.size ?? 0) > 0 ||
                      (rf !== undefined && (rf.min !== '' || rf.max !== ''))
                    return (
                      // A real <button> (not a div) so it's a native Tab stop and Enter/Space
                      // "click" it for free — same fix as the Sort/Group add-lists above; this
                      // had the identical gap. `onFocus` (not just `onClick`) is what actually
                      // shows this column's detail pane — a listbox/radiogroup-style "focus
                      // follows selection", so arrow-key nav or Tab landing here needs no
                      // separate Enter/Space "activate" step; a click still works the same way,
                      // since focusing a button on click fires the same event. Guarded against
                      // re-selecting the already-active column so focusing it back (e.g. via
                      // ArrowLeft from the right pane) doesn't trigger a pointless state update.
                      <button
                        key={col.key}
                        type="button"
                        data-filter-col-key={col.key}
                        data-dd-row
                        onFocus={() => {
                          if (col.key !== filterActiveKey) setFilterActiveCol(col.key)
                        }}
                        onClick={() => setFilterActiveCol(col.key)}
                        style={{
                          ...S.filterColItem,
                          ...S.ddItemButton,
                          ...(col.key === filterActiveKey ? S.filterColItemActive : {}),
                        }}
                      >
                        <span>{col.label}</span>
                        {hasActive && <span style={S.filterColDot} />}
                      </button>
                    )
                  })}
                </div>
                <div style={S.filterDetail} data-filter-detail>
                  {filterDetailCol &&
                    (filterDetailCol.type === 'number' ? (
                      <div style={{ padding: '4px 14px 8px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder={L.min}
                            value={
                              rangeFilters[filterDetailCol.key]?.min ??
                              (filterDetailBounds
                                ? formatRangeBound(filterDetailBounds.min, filterDetailCol)
                                : '')
                            }
                            onChange={(e) =>
                              setRangeFilter(filterDetailCol.key, 'min', e.target.value)
                            }
                            style={S.rangeInput}
                          />
                          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                            –
                          </span>
                          <input
                            type="number"
                            placeholder={L.max}
                            value={
                              rangeFilters[filterDetailCol.key]?.max ??
                              (filterDetailBounds
                                ? formatRangeBound(filterDetailBounds.max, filterDetailCol)
                                : '')
                            }
                            onChange={(e) =>
                              setRangeFilter(filterDetailCol.key, 'max', e.target.value)
                            }
                            style={S.rangeInput}
                          />
                        </div>
                        {renderRangeSliderFor(filterDetailCol, filterDetailBounds)}
                      </div>
                    ) : (
                      <>
                        {filterDetailCol.type === 'date' && (
                          <div style={{ padding: '4px 14px 8px' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="date"
                                aria-label={L.min}
                                value={
                                  rangeFilters[filterDetailCol.key]?.min ??
                                  (filterDetailBounds
                                    ? formatRangeBound(filterDetailBounds.min, filterDetailCol)
                                    : '')
                                }
                                onChange={(e) =>
                                  setRangeFilter(filterDetailCol.key, 'min', e.target.value)
                                }
                                style={{ ...S.rangeInput, width: 118 }}
                              />
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                                –
                              </span>
                              <input
                                type="date"
                                aria-label={L.max}
                                value={
                                  rangeFilters[filterDetailCol.key]?.max ??
                                  (filterDetailBounds
                                    ? formatRangeBound(filterDetailBounds.max, filterDetailCol)
                                    : '')
                                }
                                onChange={(e) =>
                                  setRangeFilter(filterDetailCol.key, 'max', e.target.value)
                                }
                                style={{ ...S.rangeInput, width: 118 }}
                              />
                            </div>
                            {renderRangeSliderFor(filterDetailCol, filterDetailBounds)}
                          </div>
                        )}
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
                            data-dd-value-search
                            placeholder={L.filterSearchPlaceholder}
                            value={filterSearchTerms[filterDetailCol.key] ?? ''}
                            onChange={(e) =>
                              setFilterSearchTerms({
                                ...filterSearchTerms,
                                [filterDetailCol.key]: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' && e.currentTarget.value !== '') {
                                e.preventDefault()
                                e.stopPropagation()
                                setFilterSearchTerms({
                                  ...filterSearchTerms,
                                  [filterDetailCol.key]: '',
                                })
                              }
                            }}
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
                        {filterDetailCol.type === 'date' ? (
                          <div style={S.filterDateTreeWrap}>
                            {renderDateTreeNodes(
                              filterDetailTree,
                              filterDetailCol.key,
                              0,
                              filterDetailCol.parseDate,
                            )}
                          </div>
                        ) : (
                          (() => {
                            // Virtualized: only the rows scrolled into view (+ overscan) are
                            // ever mounted, regardless of how many thousands of distinct values
                            // filterDetailValues holds — see computeVirtualRange/FILTER_LIST_*.
                            // Select-all/shift-range above still operate on the full array, so
                            // behavior is unaffected by how much of it is actually rendered.
                            const { startIndex, endIndex, offsetY, totalHeight } =
                              filterListVirtualRange
                            return (
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
                                      const excluded =
                                        excludeFilters[filterDetailCol.key]?.has(v) ?? false
                                      return (
                                        <label
                                          key={v}
                                          style={{
                                            ...S.ddItem,
                                            height: FILTER_LIST_ITEM_HEIGHT,
                                            boxSizing: 'border-box',
                                            cursor: 'pointer',
                                            ...(excluded ? S.filterValueExcluded : null),
                                          }}
                                        >
                                          {/* Tri-state checkbox: unchecked (neutral) → checked
                                            (include) → indeterminate (exclude, the browser's dash
                                            glyph reused as the "not this" indicator) → back to
                                            unchecked, via cycleFilterValue. `indeterminate` isn't a
                                            prop React can set declaratively, so a callback ref sets
                                            it imperatively, same pattern as the date tree's node
                                            checkboxes above and the select-all checkboxes. */}
                                          <input
                                            type="checkbox"
                                            data-dd-value-row
                                            data-value={v}
                                            checked={filters[filterDetailCol.key]?.has(v) ?? false}
                                            readOnly
                                            ref={(el) => {
                                              if (el) el.indeterminate = excluded
                                            }}
                                            onClick={(e) => {
                                              const key = filterDetailCol.key
                                              const anchor = filterSelectionAnchor[key]
                                              if (e.shiftKey && anchor != null) {
                                                const shouldSelect = !(
                                                  filters[key]?.has(v) ?? false
                                                )
                                                const range = selectRange(
                                                  filterDetailValues,
                                                  anchor,
                                                  v,
                                                )
                                                setFilterValues(key, range, shouldSelect)
                                                // Shift-range stays include-only (see the docs) — clear
                                                // the swept range out of the exclude set too, so a
                                                // previously-excluded value doesn't end up in both.
                                                if (shouldSelect) clearExcludeValues(key, range)
                                              } else {
                                                cycleFilterValue(key, v)
                                              }
                                              setFilterSelectionAnchor({
                                                ...filterSelectionAnchor,
                                                [key]: v,
                                              })
                                            }}
                                            title={
                                              excluded ? L.filterExcludedTitle : L.filterValueTitle
                                            }
                                            style={{
                                              margin: 0,
                                              ...(excluded
                                                ? { accentColor: 'var(--color-text-danger)' }
                                                : null),
                                            }}
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
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })()
                        )}
                      </>
                    ))}
                </div>
              </div>
            </Dropdown>
          )}

          {/* "Clear all" sits alone at the far right of the actions row (marginLeft: 'auto', see
              S.clearAll) — nothing else in the row needs to reflow when it mounts/unmounts,
              unlike the old layout where it sat between search and the stats text. */}
          {hasActiveState && (
            <button onClick={clearAll} style={S.clearAll}>
              {L.clearAll}
            </button>
          )}
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
        {sorts.map((entry) => {
          const col = columns.find((c) => c.key === entry.key)
          return (
            <span key={entry.key} style={S.chip}>
              {/* Toggles direction in place — the same action the Sort dropdown's own
                  active-sort row already uses — no dropdown needed for the single most common
                  tweak. `entry.key` keeps this button's identity (and DOM node) stable across
                  the toggle, so it stays focused for free with no explicit refocus needed, unlike
                  Group/Filter below (whose click opens a not-yet-mounted dropdown panel). */}
              <button type="button" onClick={() => toggleSortDir(entry.key)} style={S.chipBody}>
                {getSortIcon(entry.key)} {col?.label ?? entry.key}
              </button>
              <button type="button" onClick={() => removeSort(entry.key)} style={S.chipX}>
                ×
              </button>
            </span>
          )
        })}
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
              >
                {col?.label ?? key}
              </button>
              <button type="button" onClick={() => removeGroup(key)} style={S.chipX}>
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
                  onClick={() => {
                    setFilterActiveCol(key)
                    setOpenFilterDD(true)
                    pendingFilterColFocusKey.current = key
                  }}
                  style={{ ...S.chipBody, ...S.chipFilter }}
                >
                  {columns.find((c) => c.key === key)?.label}:{' '}
                  {summarizeFilterValues(vals, L.moreValues)}
                </button>
                <button
                  type="button"
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
            .map(([key, vals]) => (
              <span key={`exclude-${key}`} style={S.chip}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterActiveCol(key)
                    setOpenFilterDD(true)
                    pendingFilterColFocusKey.current = key
                  }}
                  style={{ ...S.chipBody, ...S.chipExclude }}
                >
                  {columns.find((c) => c.key === key)?.label}: ≠{' '}
                  {summarizeFilterValues(vals, L.moreValues)}
                </button>
                <button
                  type="button"
                  onClick={() => clearColumnFilter(key, 'exclude')}
                  style={{ ...S.chipX, ...S.chipExclude }}
                >
                  ×
                </button>
              </span>
            ))}
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
                  onClick={() => {
                    setFilterActiveCol(key)
                    setOpenFilterDD(true)
                    pendingFilterColFocusKey.current = key
                  }}
                  style={{ ...S.chipBody, ...S.chipFilter }}
                >
                  {columns.find((c) => c.key === key)?.label}: {rf.min}–{rf.max}
                </button>
                <button
                  type="button"
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
              {/* Only sorts entries for a currently-rendered header count toward numbering — a
                  groupBy column can have its own sort entry (sortWithinGroups uses it to order
                  the groups themselves), but it has no header of its own to attach a number to,
                  and leaving it in would shift every later header's number for no visible reason. */}
              {(() => {
                const headerSorts = sorts.filter((s) => activeColumns.some((c) => c.key === s.key))
                return activeColumns.map((col) => {
                  const isSorted = headerSorts.some((s) => s.key === col.key)
                  // A number is only useful to disambiguate priority when more than one visible
                  // header is sorted — with just one, "1↑" is noise next to a plain "↑".
                  const sortIdx =
                    isSorted && headerSorts.length > 1
                      ? getHeaderSortIndex(headerSorts, col.key)
                      : null
                  const icon = isSorted ? getHeaderSortIcon(headerSorts, col.key) : '↕'
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {col.label}
                        <span
                          style={{
                            fontSize: 10,
                            color: isSorted
                              ? 'var(--color-text-primary)'
                              : 'var(--color-border-secondary)',
                          }}
                        >
                          {sortIdx ? `${sortIdx}${icon}` : icon}
                        </span>
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
                            {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>›</span>}
                            <span style={{ marginRight: 4, opacity: 0.6 }}>{col?.label}:</span>
                            {label}
                          </span>
                        )
                      })}
                      {continued && (
                        <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.6 }}>
                          {L.groupContinued}
                        </span>
                      )}
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
                      onKeyDown={
                        rowNavEnabled ? (e) => handleKeyDown(e, { kind: 'row', row }) : undefined
                      }
                      onFocus={
                        rowNavEnabled ? () => setFocusTarget({ kind: 'row', row }) : undefined
                      }
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
                                : 'color-mix(in srgb, var(--color-background-secondary) 45%, transparent)',
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
          <span style={S.rowsPerPageGroup}>
            <span style={S.rowsPerPageLabel}>{L.rowsPerPage}:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={S.pageSelect}
            >
              {mergePageSizeOptions([10, 20, 50, 100], pageSize).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
        </div>
      )}
    </div>
  )
}
