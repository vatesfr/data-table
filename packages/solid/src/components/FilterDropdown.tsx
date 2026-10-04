import {
  For,
  Show,
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js'
import {
  columnHasActiveFilter,
  orderFilterColumnsByActive,
  applyColumnOrderSnapshot,
  groupColumnsByCategory,
  columnMatchesSearch,
  watchMedia,
  FILTER_NARROW_QUERY,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { DropdownClearButton, DropdownTriggerButton } from './DropdownParts'
import { FilterPane, detailFocusables } from './FilterPane'

export interface FilterDropdownHandle {
  selectColumn: (key: string) => void
}

interface FilterDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  ref?: (handle: FilterDropdownHandle) => void
}

// Master-detail filter panel (see docs/filter-dropdown.md's "Filter dropdown"): a left pane listing every
// filterable column (dot-marked when active), a right pane showing the selected column's
// controls — checklist (string, virtualized — see "Checklist virtualization" above), range +
// slider (number), or a Year›Month›Day tree + range + slider (date, never virtualized — every
// currently-expanded row is already naturally hierarchical/collapsed by default).
//
// Implements pane-crossing (ArrowRight/ArrowLeft between the left column list and the right
// detail pane), right-pane Up/Down/Home/End nav, and focus-follows-selection, at parity with
// React/Vue — see `handlePanelKeyDown`/`focusChecklistIndex` below and the `onFocusIn` on
// `.dt-filter-cols`.
export function FilterDropdown<TRow extends object>(props: FilterDropdownProps<TRow>) {
  const { table } = props
  const filterableCols = createMemo(() => props.columns.filter((c) => c.filterable !== false))

  // Whether `col` currently has any active filter — shared by the left-pane per-row clear
  // button below and the open-time ordering snapshot (see `orderKeys` below).
  function hasActiveFilter(col: ColumnDef<TRow>): boolean {
    return columnHasActiveFilter(
      col.key,
      table.filter.include(),
      table.filter.exclude(),
      table.filter.ranges(),
    )
  }

  const [activeKey, setActiveKey] = createSignal<string | null>(null)
  // Narrows the left pane's *column list* — a separate concern from `searchTerms` below, which
  // narrows the active column's *values* in the right detail pane (see docs/dropdown-keyboard-nav.md's "Dropdown
  // column search and keyboard navigation").
  const [colSearchTerm, setColSearchTerm] = createSignal('')
  const isColSearching = createMemo(() => colSearchTerm().trim().length > 0)

  // Snapshot of the left pane's column order, captured only at the moment the dropdown opens —
  // see `orderFilterColumnsByActive`'s own doc comment (core) for why this is a snapshot rather
  // than a live sort. `null` while closed/never opened, meaning "no snapshot yet, fall back to
  // plain alpha order" (see `applyColumnOrderSnapshot`).
  const [orderKeys, setOrderKeys] = createSignal<string[] | null>(null)
  // Which categories are collapsed. Seeded on open (see the createRenderEffect right below) and
  // otherwise only ever changed by the user directly toggling a header — never recomputed live
  // just because some filter elsewhere changes while the panel stays open. Session-local UI
  // state, not persisted (same tier as `filterActiveCol`).
  const [collapsedCategories, setCollapsedCategories] = createSignal<Set<string>>(new Set())
  function toggleCategoryCollapsed(name: string): void {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  let wasOpen = false
  // createRenderEffect (not createEffect): must resolve synchronously in the same update flush
  // that flips the panel's `<Show>` open, so the very first render of the left-pane list already
  // reads the fresh snapshot instead of one stale tick of plain alpha order — same reasoning as
  // `data`/`columns`' own accessor-tracking effects in createTableState.ts.
  // Narrow screen (U16): one pane at a time — the column list, or the chosen column's values
  const [narrow, setNarrow] = createSignal(false)
  onCleanup(watchMedia(FILTER_NARROW_QUERY, setNarrow))
  const [showValues, setShowValues] = createSignal(false)
  function focusActiveColumn(): void {
    panelEl?.querySelector<HTMLElement>('.dt-filter-cols .dt-filter-col-item--active')?.focus()
  }
  // A number column has no value rows: fall back to its first field, else the back button
  function focusFirstValue(): boolean {
    const detailEl = panelEl?.querySelector('.dt-filter-detail')
    const first =
      (detailEl &&
        (detailFocusables(detailEl)[0] ?? detailEl.querySelector<HTMLElement>('input'))) ??
      panelEl?.querySelector<HTMLElement>('.dt-filter-back')
    first?.focus()
    return !!first
  }

  createRenderEffect(() => {
    const open = props.isOpen
    if (open && !wasOpen) {
      setShowValues(false)
      // Untracked: this must not re-run (and thus can't accidentally reorder mid-session) just
      // because a filter changes while the panel is open — only `props.isOpen`'s own transition
      // to `true` should ever produce a new snapshot.
      untrack(() => {
        setOrderKeys(
          orderFilterColumnsByActive(
            filterableCols(),
            table.filter.include(),
            table.filter.exclude(),
            table.filter.ranges(),
          ),
        )
        // Same snapshot-on-open idea as orderKeys above, for the opposite reason: a category
        // starts collapsed by default (matching Columns/Sort/Group's own CategorySubmenu, which
        // always starts closed), except one containing an active filter at the moment the panel
        // opens starts expanded instead — so opening the dropdown never hides the very filter
        // you're currently using behind a collapsed section with no visual sign why. A snapshot,
        // not a live recomputation, so toggling a category by hand mid-session isn't overridden
        // the moment some unrelated filter elsewhere changes (see collapsedCategories' own note).
        const startCollapsed = new Set<string>()
        for (const category of groupColumnsByCategory(filterableCols()).categories) {
          if (!category.columns.some(hasActiveFilter)) startCollapsed.add(category.name)
        }
        setCollapsedCategories(startCollapsed)
      })
    }
    wasOpen = open
  })

  // Matches by category (see ColumnDefBase.category) as well as label — typing "Work" surfaces
  // every column filed under that category, not just one whose own label contains "Work".
  const searchedFilterableCols = createMemo(() => {
    const cols = filterableCols().filter((c) => columnMatchesSearch(c, colSearchTerm()))
    return applyColumnOrderSnapshot(cols, orderKeys())
  })

  // Buckets the (already searched/ordered) left-pane column list by `ColumnDefBase.category` —
  // see docs/columns.md's "Column categories" section. Uncategorized columns render as plain rows,
  // exactly as before this feature existed; each category renders as its own collapsible
  // section instead of a flyout submenu (unlike Columns/Sort/Group) — a submenu would need
  // ArrowRight, already taken here for left-pane→detail-pane crossing (see `handlePanelKeyDown`).
  //
  // Deliberately NOT re-sorted alphabetically afterward, unlike Sort/Group's own categorized
  // addable lists (which do re-sort — see their identical `categorizedAddableCols` comment):
  // `searchedFilterableCols()` is already ordered by `orderFilterColumnsByActive` (active-filtered
  // columns first, then alphabetical — not purely alphabetical the way Sort/Group's
  // never-yet-active lists are, since those have no "already active" concept to bubble up).
  // `groupColumnsByCategory`'s first-appearance ordering already reflects that: a category
  // containing an active-filtered column naturally lands early because its first member does.
  // Re-sorting categories alphabetically on top of this would undo exactly that — a category's
  // alphabetical position has no relationship to whether it contains the column the user is
  // actively filtering on, so an active filter's own category could jump arbitrarily far down the
  // list the moment its name doesn't happen to sort first.
  const categorizedFilterCols = createMemo(() => groupColumnsByCategory(searchedFilterableCols()))
  const activeCol = createMemo(
    () => filterableCols().find((c) => c.key === activeKey()) ?? filterableCols()[0] ?? null,
  )

  // --- Left/right pane-crossing (FilterPane handles its own row nav) ---
  // A separate handler from Dropdown.tsx's own generic roving nav (which only ever reaches this
  // panel's left-pane `.dt-filter-col-item` buttons via `data-dd-row`) — this one needs to reach
  // into filter-specific DOM (the right pane) that the generic handler knows
  // nothing about. Bound on `.dt-filter-panel` itself, a descendant of Dropdown's own panel, so it
  // runs *before* the generic handler via bubbling — deliberately not calling
  // preventDefault/stopPropagation for a key it doesn't itself handle, so a plain ArrowUp/Down/
  // Home/End on a left-pane button still reaches Dropdown.tsx's own handler untouched.
  let panelEl: HTMLDivElement | undefined

  // Selects by state, so neither the column search nor a collapsed category can hide the column
  // (U25); called by a chip right after opening the panel.
  function selectColumn(key: string): void {
    setActiveKey(key)
    setColSearchTerm('')
    const category = filterableCols().find((c) => c.key === key)?.category
    if (category)
      setCollapsedCategories((prev) => {
        const next = new Set(prev)
        next.delete(category)
        return next
      })
    // Queued after Dropdown's own focus-on-open microtask (see Dropdown.tsx), so this one wins
    queueMicrotask(() =>
      panelEl?.querySelector<HTMLElement>(`[data-filter-col-key="${key}"]`)?.focus(),
    )
  }
  props.ref?.({ selectColumn })
  function isEditableTarget(el: Element | null): boolean {
    return el instanceof HTMLInputElement && ['text', 'number', 'date', 'range'].includes(el.type)
  }
  function handlePanelKeyDown(e: KeyboardEvent): void {
    if (!panelEl) return
    const target = e.target as HTMLElement
    // Delete/Backspace on a focused left-pane column row clears that column's filter — the
    // keyboard equivalent of clicking its `×` clear button (see `hasActiveFilter`/the render
    // below). Guarded to an actually-active column so pressing it on an inert row is a true no-op
    // (no page-reset churn from `table.filter.clearColumn`'s unconditional `setPageState(1)`).
    if ((e.key === 'Delete' || e.key === 'Backspace') && target.matches('.dt-filter-col-item')) {
      const key = target.dataset.filterColKey
      const col = key && filterableCols().find((c) => c.key === key)
      if (col && hasActiveFilter(col)) {
        e.preventDefault()
        table.filter.clearColumn(col.key, 'include')
        table.filter.clearColumn(col.key, 'exclude')
        table.filter.clearColumn(col.key, 'range')
      }
      return
    }
    if (e.key === 'ArrowRight' && target.matches('.dt-filter-col-item')) {
      setShowValues(true)
      if (focusFirstValue()) e.preventDefault()
      return
    }
    if (e.key !== 'ArrowLeft' || !target.closest('.dt-filter-detail')) return
    if (isEditableTarget(document.activeElement)) return
    e.preventDefault()
    setShowValues(false)
    focusActiveColumn()
  }

  // One left-pane column row — shared by the flat uncategorized list and each category section
  // below, so the two render identically apart from indentation.
  function FilterColRow(rowProps: { col: ColumnDef<TRow> }) {
    const col = rowProps.col
    const hasActive = createMemo(() => hasActiveFilter(col))
    const isSelected = createMemo(() => activeCol()?.key === col.key)
    return (
      // The row (not just the item button) carries the selected/hover background, so the
      // highlight spans the clear button too instead of stopping short of it —
      // `.dt-filter-col-item--active` stays on the button as well, purely so
      // `handlePanelKeyDown`'s ArrowLeft refocus lookup and the button's own font-weight bump
      // still have something to key off.
      <div class={`dt-filter-col-row${isSelected() ? ' dt-filter-col-row--active' : ''}`}>
        <button
          type="button"
          class={`dt-filter-col-item${isSelected() ? ' dt-filter-col-item--active' : ''}`}
          data-dd-row
          data-filter-col-key={col.key}
          onClick={() => {
            setActiveKey(col.key)
            if (!narrow()) return
            setShowValues(true)
            focusFirstValue()
          }}
        >
          <span>{col.label}</span>
        </button>
        {/* Replaces the plain active-filter dot: a one-click way to drop this column's filter
            without opening it first, matching the toolbar's own per-dropdown × buttons — see
            docs/toolbar.md's "Toolbar clear buttons". A sibling of the column button rather than
            nested inside it, since a <button> can't contain another interactive element. */}
        <Show when={hasActive()}>
          <button
            type="button"
            class="dt-filter-col-clear"
            title={table.labels().clearColumnFilter}
            aria-label={table.labels().clearColumnFilter}
            onClick={(e) => {
              e.stopPropagation()
              // Clears every kind at once — this button means "drop this column's filter
              // entirely", unlike the active-bar's own per-kind chips.
              table.filter.clearColumn(col.key, 'include')
              table.filter.clearColumn(col.key, 'exclude')
              table.filter.clearColumn(col.key, 'range')
            }}
          >
            ×
          </button>
        </Show>
      </div>
    )
  }

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <DropdownTriggerButton
          active={table.filter.activeCount() > 0}
          label={table.labels().filter}
          onClick={props.onToggle}
        />
      }
      extraTrigger={
        <DropdownClearButton
          show={table.filter.activeCount() > 0}
          label={table.labels().clearFilters}
          onClear={table.filter.clear}
        />
      }
      onEscapeClearable={() => {
        const active = document.activeElement
        if (active?.matches?.('.dt-filter-cols-search') && colSearchTerm()) {
          setColSearchTerm('')
          return true
        }
        return false
      }}
    >
      <div
        class="dt-filter-panel"
        classList={{ 'dt-filter-panel--narrow': narrow() }}
        ref={panelEl}
        onKeyDown={handlePanelKeyDown}
      >
        <Show when={!narrow() || !showValues()}>
          <div
            class="dt-filter-cols"
            data-filter-cols
            // Listbox/radiogroup-style: focusing a column button by any means (click, Tab, the
            // arrow-nav above) drives which column's detail pane shows — not just an explicit
            // click/activate step. `focusin` (unlike `focus`) bubbles, so one delegated listener
            // here covers every column button without per-row wiring.
            onFocusIn={(e) => {
              const key = (e.target as HTMLElement).closest<HTMLElement>('.dt-filter-col-item')
                ?.dataset.filterColKey
              if (key) setActiveKey(key)
            }}
          >
            <span class="dt-dd-search-wrap dt-filter-cols-search-wrap">
              <input
                type="text"
                class="dt-dd-search dt-filter-cols-search"
                data-dd-search
                placeholder={table.labels().filterSearchPlaceholder}
                value={colSearchTerm()}
                onInput={(e) => setColSearchTerm(e.currentTarget.value)}
              />
              <Show when={colSearchTerm()}>
                <button
                  type="button"
                  class="dt-dd-search-clear"
                  title={table.labels().clearSearch}
                  aria-label={table.labels().clearSearch}
                  onClick={() => setColSearchTerm('')}
                >
                  ×
                </button>
              </Show>
            </span>
            <For each={categorizedFilterCols().uncategorized}>
              {(col) => <FilterColRow col={col} />}
            </For>
            <For each={categorizedFilterCols().categories}>
              {(category) => {
                // While searching, a category only ever renders here at all when it has a matching
                // column (categorizedFilterCols buckets the already-searched list) — so force it
                // open rather than let a stale collapsed snapshot hide the very match the search
                // just surfaced, with no visible sign it's there. `collapsedCategories` itself is
                // left untouched: clearing the search reverts to whatever collapse state the user
                // had (manually toggled, or the open-time snapshot), exactly as before this fix.
                const isCollapsed = createMemo(
                  () => !isColSearching() && collapsedCategories().has(category.name),
                )
                return (
                  <div class="dt-filter-category">
                    <button
                      type="button"
                      class="dt-filter-category-header"
                      data-dd-row
                      aria-expanded={!isCollapsed()}
                      onClick={() => toggleCategoryCollapsed(category.name)}
                    >
                      <span class="dt-filter-category-toggle">{isCollapsed() ? '▶' : '▼'}</span>
                      <span class="dt-flex1">{category.name}</span>
                    </button>
                    <Show when={!isCollapsed()}>
                      <div class="dt-filter-category-cols">
                        <For each={category.columns}>{(col) => <FilterColRow col={col} />}</For>
                      </div>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
        <Show when={!narrow() || showValues()}>
          <Show when={narrow()}>
            <button
              type="button"
              class="dt-dd-item dt-dd-item--click dt-filter-back"
              data-filter-back
              onClick={() => {
                setShowValues(false)
                focusActiveColumn()
              }}
            >
              ‹ {table.labels().columns}
            </button>
          </Show>
          <Show when={activeCol()} keyed>
            {(col) => <FilterPane table={table} col={col} />}
          </Show>
        </Show>
      </div>
    </Dropdown>
  )
}
