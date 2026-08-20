import { For, Show, createMemo } from 'solid-js'
import { getSortIcon } from '@vates/data-table-core'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'

interface ActiveBarProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  groupableCols: ColumnDef<TRow>[]
  totalRows: number
  onOpenGroup: () => void
  onOpenFilter: (key: string) => void
}

const FILTER_CHIP_MAX = 3

function summarizeFilterValues<TRow extends object>(
  vals: Set<string>,
  L: TableState<TRow>['labels'],
): string {
  const arr = [...vals]
  if (arr.length <= FILTER_CHIP_MAX) return arr.join(', ')
  return `${arr.slice(0, FILTER_CHIP_MAX).join(', ')}, ${L.moreValues(arr.length - FILTER_CHIP_MAX)}`
}

// Always rendered (even with nothing active) so the row-count stats have a single stable home and
// toggling a sort/filter/group never shifts the toolbar's height — see CLAUDE.md's "Toolbar
// layout (shape/find clusters, active state bar)". One chip per active sort entry, group column,
// and filter (include/exclude/range each get their own, since a column can carry more than one at
// once), followed by row-count/group-count stats pinned at the far right.
//
// Simplification vs. the fuller documented behavior: a group/filter chip's body opens the
// relevant dropdown (via onOpenGroup/onOpenFilter) but doesn't additionally focus that specific
// entry's row inside it — the fancier "focus follows chip click" behavior is deferred alongside
// the other roving-focus niceties noted in Dropdown.tsx/TableBody.tsx.
export function ActiveBar<TRow extends object>(props: ActiveBarProps<TRow>) {
  const { table } = props

  const pageGroupCount = createMemo(() => new Set(table.groupedData().map((g) => g.key)).size)

  return (
    <div class="dt-active-bar">
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
              <button type="button" class="dt-chip-x" onClick={() => table.sort.remove(entry.key)}>
                ×
              </button>
            </span>
          )
        }}
      </For>
      <For each={table.group.by()}>
        {(key) => {
          const col = () => props.groupableCols.find((c) => c.key === key)
          return (
            <span class="dt-chip">
              <button type="button" class="dt-chip-body" onClick={props.onOpenGroup}>
                {col()?.label ?? key}
              </button>
              <button type="button" class="dt-chip-x" onClick={() => table.group.remove(key)}>
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
                {summarizeFilterValues(vals, table.labels)}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                onClick={() => table.filter.clearColumn(key, 'include')}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <For each={Object.entries(table.filter.exclude()).filter(([, v]) => v.size > 0)}>
          {([key, vals]) => (
            <span class="dt-chip dt-chip--filter dt-chip--exclude">
              <button type="button" class="dt-chip-body" onClick={() => props.onOpenFilter(key)}>
                {props.columns.find((c) => c.key === key)?.label ?? key}: ≠{' '}
                {summarizeFilterValues(vals, table.labels)}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                onClick={() => table.filter.clearColumn(key, 'exclude')}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <For
          each={Object.entries(table.filter.ranges()).filter(
            ([, rf]) => rf.min !== '' || rf.max !== '',
          )}
        >
          {([key, rf]) => (
            <span class="dt-chip dt-chip--filter">
              <button type="button" class="dt-chip-body" onClick={() => props.onOpenFilter(key)}>
                {props.columns.find((c) => c.key === key)?.label ?? key}: {rf.min}–{rf.max}
              </button>
              <button
                type="button"
                class="dt-chip-x"
                onClick={() => table.filter.clearColumn(key, 'range')}
              >
                ×
              </button>
            </span>
          )}
        </For>
      </Show>
      <span class="dt-stats">
        {table.labels.rowCount(table.processedData().length, props.totalRows)}
        {table.group.by().length > 0 ? table.labels.groupCount(pageGroupCount()) : ''}
      </span>
    </div>
  )
}
