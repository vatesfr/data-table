import { For, Show, createMemo } from 'solid-js'
import {
  exclusionChip,
  formatFilterValue,
  rangeChipText,
  getSortIcon,
  exclusionValueKeys,
  exclusionValues,
  summarizeFilterValues,
  filterMatchMode,
  chipSeparator,
  chipRemovalFocusTarget,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'

interface ActiveBarProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  groupableCols: ColumnDef<TRow>[]
  totalRows: number
  onOpenGroup: (key: string) => void
  onOpenFilter: (key: string) => void
}

// A filter value as the column displays it (its `format`), for the chips below
function chipValues<TRow extends object>(
  table: TableState<TRow>,
  col: ColumnDef<TRow> | undefined,
  vals: Set<string>,
  separator?: string,
): string {
  const L = table.labels()
  return summarizeFilterValues(
    vals,
    L.moreValues,
    (v) => formatFilterValue(col, v, L.emptyValue),
    separator,
  )
}

// Before a chip's × removes it, so focus doesn't drop to the page (U30)
function focusChipNeighbor(e: MouseEvent & { currentTarget: HTMLElement }): void {
  chipRemovalFocusTarget(e.currentTarget)?.focus()
}

// Always rendered, so toggling state never shifts the toolbar's height (docs/toolbar.md)
export function ActiveBar<TRow extends object>(props: ActiveBarProps<TRow>) {
  const { table } = props

  const pageGroupCount = createMemo(() => new Set(table.groupedData().map((g) => g.key)).size)
  const exclusionKeys = createMemo(() =>
    exclusionValueKeys(table.data(), props.columns, table.filter.include(), table.filter.exclude()),
  )
  const allValues = createMemo(() =>
    exclusionValues(table.data(), props.columns, exclusionKeys(), table.labels().emptyValue),
  )

  return (
    <div class="dt-active-bar">
      {/* Group chips first, as in the Sort dropdown: grouping is the primary order */}
      <For each={table.group.by()}>
        {(key) => {
          const label = () => props.groupableCols.find((c) => c.key === key)?.label ?? key
          return (
            <span class="dt-chip">
              {/* ⊞ tells it apart from the same column's sort chip (U6), groupedBy for screen readers (U28) */}
              <button
                type="button"
                class="dt-chip-body"
                aria-label={table.labels().groupedBy(label())}
                onClick={() => props.onOpenGroup(key)}
              >
                <span aria-hidden="true">⊞</span> {label()}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                title={table.labels().removeGroup(label())}
                aria-label={table.labels().removeGroup(label())}
                onClick={(e) => {
                  focusChipNeighbor(e)
                  table.group.remove(key)
                }}
              >
                ×
              </button>
            </span>
          )
        }}
      </For>
      <For each={table.sort.entries()}>
        {(entry) => {
          const col = () => props.columns.find((c) => c.key === entry.key)
          return (
            <span class="dt-chip">
              <button
                type="button"
                class="dt-chip-body"
                onClick={() => table.sort.toggleDir(entry.key)}
              >
                {getSortIcon(table.sort.entries(), entry.key)} {col()?.label ?? entry.key}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                title={table.labels().removeSort(col()?.label ?? entry.key)}
                aria-label={table.labels().removeSort(col()?.label ?? entry.key)}
                onClick={(e) => {
                  focusChipNeighbor(e)
                  table.sort.remove(entry.key)
                }}
              >
                ×
              </button>
            </span>
          )
        }}
      </For>
      <Show when={table.filter.activeCount() > 0}>
        <For each={Object.entries(table.filter.include()).filter(([, v]) => v.size > 0)}>
          {([key, vals]) => (
            <span class="dt-chip dt-chip--filter">
              <button type="button" class="dt-chip-body" onClick={() => props.onOpenFilter(key)}>
                {props.columns.find((c) => c.key === key)?.label ?? key}:{' '}
                {chipValues(
                  table,
                  props.columns.find((c) => c.key === key),
                  vals,
                  chipSeparator(
                    filterMatchMode(
                      table.filter.modes(),
                      key,
                      props.columns.find((c) => c.key === key),
                      table.data(),
                    ),
                  ),
                )}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                title={table.labels().clearColumnFilter}
                aria-label={table.labels().clearColumnFilter}
                onClick={(e) => {
                  focusChipNeighbor(e)
                  table.filter.clearColumn(key, 'include')
                }}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <For each={Object.entries(table.filter.exclude()).filter(([, v]) => v.size > 0)}>
          {([key, vals]) => {
            const col = props.columns.find((c) => c.key === key)
            // Names the kept values when fewer are kept than hidden
            const chip = createMemo(() => exclusionChip(vals, allValues()[key]))
            return (
              <span
                class="dt-chip dt-chip--filter"
                classList={{ 'dt-chip--exclude': !chip().kept }}
              >
                <button type="button" class="dt-chip-body" onClick={() => props.onOpenFilter(key)}>
                  {col?.label ?? key}: {chip().kept ? '' : '≠ '}
                  {chipValues(table, col, chip().values)}
                </button>
                <button
                  type="button"
                  class="dt-chip-x"
                  title={table.labels().clearColumnFilter}
                  aria-label={table.labels().clearColumnFilter}
                  onClick={(e) => {
                    focusChipNeighbor(e)
                    table.filter.clearColumn(key, 'exclude')
                  }}
                >
                  ×
                </button>
              </span>
            )
          }}
        </For>
        <For
          each={Object.entries(table.filter.ranges()).filter(
            ([, rf]) => rf.min !== '' || rf.max !== '',
          )}
        >
          {([key, rf]) => (
            <span class="dt-chip dt-chip--filter">
              <button type="button" class="dt-chip-body" onClick={() => props.onOpenFilter(key)}>
                {props.columns.find((c) => c.key === key)?.label ?? key}:{' '}
                {rangeChipText(
                  props.columns.find((c) => c.key === key),
                  rf,
                  table.labels().emptyValue,
                )}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                title={table.labels().clearColumnFilter}
                aria-label={table.labels().clearColumnFilter}
                onClick={(e) => {
                  focusChipNeighbor(e)
                  table.filter.clearColumn(key, 'range')
                }}
              >
                ×
              </button>
            </span>
          )}
        </For>
      </Show>
      <span class="dt-stats">
        {table.labels().rowCount(table.processedData().length, props.totalRows)}
        {table.group.by().length > 0 ? table.labels().groupCount(pageGroupCount()) : ''}
      </span>
    </div>
  )
}
