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
  filterOpenState,
  applyColumnOrderSnapshot,
  groupColumnsByCategory,
  columnMatchesSearch,
  watchMedia,
  FILTER_NARROW_QUERY,
  filterDetailFocusTarget,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { DropdownClearButton, DropdownTriggerButton, NoMatchingColumns } from './DropdownParts'
import { FilterPane } from './FilterPane'

export interface FilterDropdownHandle {
  selectColumn: (key: string) => void
  focusColumn: (key: string) => void
}

interface FilterDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  ref?: (handle: FilterDropdownHandle) => void
}

// Master-detail filter panel (docs/filter-dropdown.md): filterable columns on the left, the chosen one's FilterPane on the right
export function FilterDropdown<TRow extends object>(props: FilterDropdownProps<TRow>) {
  const { table } = props
  const filterableCols = createMemo(() => props.columns.filter((c) => c.filterable !== false))

  function hasActiveFilter(col: ColumnDef<TRow>): boolean {
    return columnHasActiveFilter(
      col.key,
      table.filter.include(),
      table.filter.exclude(),
      table.filter.ranges(),
    )
  }

  const [activeKey, setActiveKey] = createSignal<string | null>(null)
  // Narrows the column list; FilterPane has its own value search
  const [colSearchTerm, setColSearchTerm] = createSignal('')
  const isColSearching = createMemo(() => colSearchTerm().trim().length > 0)

  // Column order snapshot taken on open (see `orderFilterColumnsByActive`); null: alphabetical
  const [orderKeys, setOrderKeys] = createSignal<string[] | null>(null)
  // Collapsed categories: seeded on open, then changed only by the user
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
  // Narrow screen (U16): one pane at a time — the column list, or the chosen column's values
  const [narrow, setNarrow] = createSignal(false)
  onCleanup(watchMedia(FILTER_NARROW_QUERY, setNarrow))
  const [showValues, setShowValues] = createSignal(false)
  function focusActiveColumn(): void {
    panelEl?.querySelector<HTMLElement>('.dt-filter-cols .dt-filter-col-item--active')?.focus()
  }
  // A number column has no value rows: fall back to its first field, else the back button
  function focusFirstValue(): boolean {
    const first =
      filterDetailFocusTarget(panelEl?.querySelector('.dt-filter-detail')) ??
      panelEl?.querySelector<HTMLElement>('.dt-filter-back')
    first?.focus()
    return !!first
  }

  // A render effect, so the first render of the opened list reads the new snapshot
  createRenderEffect(() => {
    const open = props.isOpen
    if (open && !wasOpen) {
      setShowValues(false)
      // Untracked: only opening takes a new snapshot, not a filter change while open
      untrack(() => {
        const state = filterOpenState(
          filterableCols(),
          table.filter.include(),
          table.filter.exclude(),
          table.filter.ranges(),
          activeKey(),
        )
        setOrderKeys(state.orderKeys)
        setCollapsedCategories(state.collapsed)
        setActiveKey(state.shownKey)
        setColSearchTerm('')
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

  // Collapsible category sections, not submenus (→ crosses panes), kept in the active-first order (docs/columns.md)
  const categorizedFilterCols = createMemo(() => groupColumnsByCategory(searchedFilterableCols()))
  const activeCol = createMemo(
    () => filterableCols().find((c) => c.key === activeKey()) ?? filterableCols()[0] ?? null,
  )

  // --- Left/right pane-crossing (FilterPane handles its own row nav) ---
  // Runs before Dropdown's nav, which still gets the keys it leaves alone
  let panelEl: HTMLDivElement | undefined

  // Selects by state, so neither the column search nor a collapsed category can hide the column
  // (U25); called by a chip before opening the panel, so the open-time state starts from it.
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
  }
  // Called after opening: queued after Dropdown's own focus-on-open microtask, so this one wins
  function focusColumn(key: string): void {
    queueMicrotask(() =>
      panelEl?.querySelector<HTMLElement>(`[data-filter-col-key="${key}"]`)?.focus(),
    )
  }
  props.ref?.({ selectColumn, focusColumn })
  function isEditableTarget(el: Element | null): boolean {
    return el instanceof HTMLInputElement && ['text', 'number', 'date', 'range'].includes(el.type)
  }
  function handlePanelKeyDown(e: KeyboardEvent): void {
    if (!panelEl) return
    const target = e.target as HTMLElement
    // Delete/Backspace clears the focused column's filter, if it has one (no needless page reset)
    if ((e.key === 'Delete' || e.key === 'Backspace') && target.matches('.dt-filter-col-item')) {
      const key = target.dataset.filterColKey
      const col = key && filterableCols().find((c) => c.key === key)
      if (col && hasActiveFilter(col)) {
        e.preventDefault()
        table.filter.clearColumn(col.key)
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
      // The row carries the highlight so it spans the clear button; the button's class keys the ← refocus
      <div class={`dt-filter-col-row${isSelected() ? ' dt-filter-col-row--active' : ''}`}>
        <button
          type="button"
          class={`dt-filter-col-item${isSelected() ? ' dt-filter-col-item--active' : ''}`}
          data-dd-row
          data-filter-col-key={col.key}
          aria-current={isSelected() || undefined}
          onClick={() => {
            setActiveKey(col.key)
            if (!narrow()) return
            setShowValues(true)
            focusFirstValue()
          }}
        >
          <span>{col.label}</span>
        </button>
        {/* Clears this column's filter; a sibling, as buttons can't nest (docs/toolbar.md) */}
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
              table.filter.clearColumn(col.key)
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
            // Focusing a column by any means shows it; `focusin` bubbles, so one listener covers all
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
            <NoMatchingColumns
              when={searchedFilterableCols().length === 0}
              label={table.labels().noMatchingColumns}
            />
            <For each={categorizedFilterCols().uncategorized}>
              {(col) => <FilterColRow col={col} />}
            </For>
            <For each={categorizedFilterCols().categories}>
              {(category) => {
                // Force-open while searching so a stale collapse can't hide a match; `collapsedCategories` is kept
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
              ‹ {table.labels().columns} · {activeCol()?.label}
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
