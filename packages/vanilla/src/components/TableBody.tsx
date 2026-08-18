import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import {
  getColumnValue,
  computeAggregate,
  getSortIcon,
  getSortIndex,
  isGroupCollapsed,
  isSameVisibleItem,
  type VisibleItem,
} from '@vates/data-table-core'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'

interface TableBodyProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  rowKey?: keyof TRow & string
  selectable?: boolean
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
}

function cellValue<TRow extends object>(col: ColumnDef<TRow>, row: TRow): Node | string {
  const value = getColumnValue(col, row)
  // col.render returns a real DOM Node — Solid can render an arbitrary Node as a JSX child
  // directly, so (unlike the old innerHTML-string version) no placeholder-and-patch mechanism is
  // needed at all here: this is a clean simplification the Solid migration gets for free.
  if (col.render) return col.render(value, row)
  if (col.format) return col.format(value, row)
  return String(value ?? '')
}

function aggValue<TRow extends object>(
  col: ColumnDef<TRow>,
  rows: TRow[],
  sampleRow: TRow,
): Node | string {
  if (!col.aggregate) return ''
  const v = computeAggregate(col, rows)
  return col.format ? col.format(v, sampleRow) : String(v ?? '')
}

// Table header + body: sortable/draggable header cells, group headers (collapse toggle,
// select-all, aggregate row), data rows (selection, row click), and a page-scoped roving-tabindex
// keyboard nav (see CLAUDE.md's "Keyboard navigation").
//
// Simplification vs. the fuller documented behavior: arrow-key navigation crossing a page
// boundary (and Ctrl+Home/Ctrl+End jumping to the true first/last item across *all* pages) is
// deferred — Up/Down/Home/End here operate within the current page only. This is the single
// most involved piece of the original keyboard-nav design (stashing a pending focus target across
// an async page-change re-render) and depends on Pagination.tsx existing first; flagged as a
// follow-up once the full view is assembled and there's a real pagination control to test against.
export function TableBody<TRow extends object>(props: TableBodyProps<TRow>) {
  const { table } = props
  const rowNavEnabled = createMemo(() => !!props.selectable || !!props.onRowClick)
  const hasAgg = createMemo(() => table.activeColumns().some((c) => c.aggregate))

  const [focusTarget, setFocusTarget] = createSignal<VisibleItem<TRow> | null>(null)
  const rowRefs = new Map<TRow | string, HTMLElement>()

  const navigableItems = createMemo(() => {
    const items: VisibleItem<TRow>[] = []
    for (const g of table.groupedData()) {
      if (g.key !== null) items.push({ kind: 'group', key: g.key })
      const collapsed =
        g.key !== null &&
        isGroupCollapsed(table.collapsedGroups(), g.key, table.defaultGroupsCollapsed)
      if (!collapsed || g.key === null) for (const row of g.rows) items.push({ kind: 'row', row })
    }
    return items.filter((item) => item.kind === 'group' || rowNavEnabled())
  })

  const effectiveFocusTarget = createMemo(() => {
    const items = navigableItems()
    const ft = focusTarget()
    return ft && items.some((i) => isSameVisibleItem(i, ft)) ? ft : (items[0] ?? null)
  })

  function isFocusTarget(item: VisibleItem<TRow>): boolean {
    const eft = effectiveFocusTarget()
    return !!eft && isSameVisibleItem(eft, item)
  }

  function refKey(item: VisibleItem<TRow>): TRow | string {
    return item.kind === 'row' ? item.row : `group:${item.key}`
  }

  function focusItem(item: VisibleItem<TRow>): void {
    setFocusTarget(item)
    rowRefs.get(refKey(item))?.focus()
  }

  function moveFocus(delta: number): void {
    const items = navigableItems()
    const idx = items.findIndex((i) => isSameVisibleItem(i, effectiveFocusTarget()!))
    const next = items[idx + delta]
    if (next) focusItem(next)
  }

  const procIdxMap = createMemo(() => new Map(table.processedData().map((r, i) => [r, i])))

  // --- Header drag-and-drop reorder ---
  const [dragColKey, setDragColKey] = createSignal<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = createSignal<string | null>(null)
  let headerRow: HTMLTableRowElement | undefined
  function headerCellEls(): { key: string; el: HTMLElement }[] {
    if (!headerRow) return []
    return [...headerRow.querySelectorAll<HTMLElement>('[data-col-key]')].map((el) => ({
      key: el.dataset.colKey!,
      el,
    }))
  }
  function handleHeaderDragOver(e: DragEvent): void {
    e.preventDefault()
    const hit = resolveDropRowHorizontal(e.clientX, headerCellEls())
    if (hit) setDragOverColKey(hit)
  }
  function handleHeaderDrop(e: DragEvent): void {
    e.preventDefault()
    const from = dragColKey()
    const hit = resolveDropRowHorizontal(e.clientX, headerCellEls())
    if (from && hit && hit !== from) table.moveColumn(from, hit, false)
    setDragColKey(null)
    setDragOverColKey(null)
  }
  // Header reordering is horizontal (columns, not rows) — resolveDropRow is row-height-based, so
  // this is a small horizontal variant: nearest column by clientX, always inserting before it
  // (matching the old vanilla behavior's deliberate "always insert before" simplification for
  // header drag specifically — see CLAUDE.md's "Column reordering").
  function resolveDropRowHorizontal(
    clientX: number,
    cells: { key: string; el: HTMLElement }[],
  ): string | null {
    for (const { key, el } of cells) {
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return key
    }
    return null
  }

  const headerSorts = createMemo(() =>
    table.sorts().filter((s) => table.activeColumns().some((c) => c.key === s.key)),
  )

  const allSelected = createMemo(
    () =>
      table.processedData().length > 0 &&
      table.processedData().every((r) => table.selection().has(r)),
  )
  const someSelected = createMemo(
    () => !allSelected() && table.processedData().some((r) => table.selection().has(r)),
  )
  let selectAllEl: HTMLInputElement | undefined
  createEffect(() => {
    if (selectAllEl) selectAllEl.indeterminate = someSelected()
  })

  function handleHeaderClick(key: string, e: MouseEvent): void {
    if (e.shiftKey) table.appendOrToggleSort(key)
    else table.replaceSort(key)
  }

  return (
    <div class="dt-table-wrap">
      <table class="dt-table">
        <thead>
          <tr ref={headerRow} onDragOver={handleHeaderDragOver} onDrop={handleHeaderDrop}>
            <Show when={props.selectable}>
              <th class="dt-th dt-th--no-sort" style={{ width: '36px' }}>
                <input
                  type="checkbox"
                  checked={allSelected()}
                  ref={selectAllEl}
                  onClick={() => table.toggleSelectAll(table.processedData())}
                />
              </th>
            </Show>
            <Show when={table.groupBy().length > 0}>
              <th class="dt-th dt-th--no-sort" style={{ width: '28px' }} />
            </Show>
            <For each={table.activeColumns()}>
              {(col) => {
                const isSorted = createMemo(() => headerSorts().some((s) => s.key === col.key))
                const sortIdx = createMemo(() =>
                  isSorted() && headerSorts().length > 1
                    ? getSortIndex(headerSorts(), col.key)
                    : null,
                )
                const icon = createMemo(() =>
                  isSorted() ? getSortIcon(headerSorts(), col.key) : '↕',
                )
                return (
                  <th
                    class="dt-th"
                    classList={{ 'dt-dd-item--drag-over': dragOverColKey() === col.key }}
                    draggable="true"
                    data-col-key={col.key}
                    style={col.width ? { width: `${col.width}px` } : undefined}
                    onDragStart={() => setDragColKey(col.key)}
                    onDragEnd={() => {
                      setDragColKey(null)
                      setDragOverColKey(null)
                    }}
                    onClick={(e) => handleHeaderClick(col.key, e)}
                  >
                    <span class="dt-th-inner">
                      {col.label}{' '}
                      <span class={`dt-sort-icon${isSorted() ? ' dt-sort-icon--active' : ''}`}>
                        {sortIdx() ? `${sortIdx()}${icon()}` : icon()}
                      </span>
                    </span>
                  </th>
                )
              }}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={table.groupedData()}>
            {(group) => (
              <Show
                when={group.key !== null}
                fallback={
                  <For each={group.rows}>
                    {(row, ri) => (
                      <DataRow
                        table={table}
                        columns={props.columns}
                        row={row}
                        procIdx={procIdxMap().get(row) ?? -1}
                        odd={ri() % 2 !== 0}
                        rowKey={props.rowKey}
                        selectable={props.selectable}
                        onRowClick={props.onRowClick}
                        tabIndex={
                          rowNavEnabled()
                            ? isFocusTarget({ kind: 'row', row })
                              ? 0
                              : -1
                            : undefined
                        }
                        onFocusRow={() => setFocusTarget({ kind: 'row', row })}
                        onArrow={(delta) => moveFocus(delta)}
                        registerRef={(el) => rowRefs.set(row, el)}
                      />
                    )}
                  </For>
                }
              >
                <GroupHeaderRow
                  table={table}
                  columns={props.columns}
                  group={group}
                  selectable={props.selectable}
                  hasAgg={hasAgg()}
                  tabIndex={isFocusTarget({ kind: 'group', key: group.key! }) ? 0 : -1}
                  onFocusGroup={() => setFocusTarget({ kind: 'group', key: group.key! })}
                  onArrow={(delta) => moveFocus(delta)}
                  registerRef={(el) => rowRefs.set(`group:${group.key}`, el)}
                />
                <Show
                  when={
                    !isGroupCollapsed(
                      table.collapsedGroups(),
                      group.key!,
                      table.defaultGroupsCollapsed,
                    )
                  }
                >
                  <For each={group.rows}>
                    {(row, ri) => (
                      <DataRow
                        table={table}
                        columns={props.columns}
                        row={row}
                        procIdx={procIdxMap().get(row) ?? -1}
                        odd={ri() % 2 !== 0}
                        rowKey={props.rowKey}
                        selectable={props.selectable}
                        onRowClick={props.onRowClick}
                        indentGroup
                        tabIndex={
                          rowNavEnabled()
                            ? isFocusTarget({ kind: 'row', row })
                              ? 0
                              : -1
                            : undefined
                        }
                        onFocusRow={() => setFocusTarget({ kind: 'row', row })}
                        onArrow={(delta) => moveFocus(delta)}
                        registerRef={(el) => rowRefs.set(row, el)}
                      />
                    )}
                  </For>
                </Show>
              </Show>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

interface GroupHeaderRowProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  group: ReturnType<TableState<TRow>['groupedData']>[number]
  selectable?: boolean
  hasAgg: boolean
  tabIndex: number
  onFocusGroup: () => void
  onArrow: (delta: number) => void
  registerRef: (el: HTMLElement) => void
}

function GroupHeaderRow<TRow extends object>(props: GroupHeaderRowProps<TRow>) {
  const { table, group } = props
  const isCollapsed = createMemo(() =>
    isGroupCollapsed(table.collapsedGroups(), group.key!, table.defaultGroupsCollapsed),
  )
  const groupAllSelected = createMemo(
    () => group.rows.length > 0 && group.rows.every((r) => table.selection().has(r)),
  )
  const groupSomeSelected = createMemo(
    () => !groupAllSelected() && group.rows.some((r) => table.selection().has(r)),
  )
  let cbEl: HTMLInputElement | undefined
  createEffect(() => {
    if (cbEl) cbEl.indeterminate = groupSomeSelected()
  })

  return (
    <>
      <tr
        class="dt-group-row"
        tabIndex={props.tabIndex}
        aria-expanded={!isCollapsed()}
        ref={(el) => props.registerRef(el)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-no-collapse]')) return
          table.toggleGroupCollapse(group.key!)
        }}
        onFocus={props.onFocusGroup}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            props.onArrow(1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            props.onArrow(-1)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            table.toggleGroupCollapse(group.key!)
          } else if (e.key === ' ' && props.selectable) {
            e.preventDefault()
            table.toggleSelectAll(group.rows)
          }
        }}
      >
        <Show when={props.selectable}>
          <td class="dt-group-td" style={{ width: '36px' }} data-no-collapse>
            <input
              type="checkbox"
              checked={groupAllSelected()}
              ref={cbEl}
              onClick={(e) => {
                e.stopPropagation()
                table.toggleSelectAll(group.rows)
              }}
            />
          </td>
        </Show>
        <td class="dt-group-td" style={{ width: '28px' }}>
          {isCollapsed() ? '▶' : '▼'}
        </td>
        <td class="dt-group-td" colspan={table.activeColumns().length}>
          <For each={table.groupBy()}>
            {(gColKey, gi) => {
              const gCol = props.columns.find((c) => c.key === gColKey)
              return (
                <>
                  <Show when={gi() > 0}>
                    <span class="dt-group-sep"> › </span>
                  </Show>
                  <span class="dt-group-colname">{gCol?.label ?? gColKey}:</span>{' '}
                  {gCol?.groupValue
                    ? (gCol.groupFormat?.(group.keyParts[gi()]) ?? group.keyParts[gi()])
                    : renderGroupCellValue(gCol, group.sampleRow!, group.keyParts[gi()])}
                </>
              )
            }}
          </For>
          <Show when={group.continued}>
            {' '}
            <span class="dt-group-continued">{table.L.groupContinued}</span>
          </Show>{' '}
          <span class="dt-group-count">{table.L.rowsInGroup(group.rows.length)}</span>
        </td>
      </tr>
      <Show when={props.hasAgg}>
        <tr class="dt-agg-row">
          <Show when={props.selectable}>
            <td class="dt-agg-td" style={{ width: '36px' }} />
          </Show>
          <td class="dt-agg-td" style={{ width: '28px' }} />
          <For each={table.activeColumns()}>
            {(col) => <td class="dt-agg-td">{aggValue(col, group.rows, group.sampleRow!)}</td>}
          </For>
        </tr>
      </Show>
    </>
  )
}

// A group header's value can't just go through the normal cellValue(col, row) pipeline: for a
// multi-value column (a row fanned out into several groups, see "Grouped columns"), the row's own
// real value is the whole array, but the group it's rendered under is just one of that array's
// entries (keyPart) — so `value` below substitutes keyPart in exactly that case, same as the old
// vanilla code's own `Array.isArray(raw) ? keyParts[gi] : raw`.
function renderGroupCellValue<TRow extends object>(
  col: ColumnDef<TRow> | undefined,
  sampleRow: TRow,
  keyPart: string,
): Node | string {
  if (!col) return String(keyPart ?? '')
  const raw = getColumnValue(col, sampleRow)
  const value = Array.isArray(raw) ? keyPart : raw
  if (col.render) return col.render(value, sampleRow)
  if (col.format) return col.format(value, sampleRow)
  return String(value ?? '')
}

interface DataRowProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  row: TRow
  procIdx: number
  odd: boolean
  rowKey?: keyof TRow & string
  selectable?: boolean
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
  indentGroup?: boolean
  tabIndex?: number
  onFocusRow: () => void
  onArrow: (delta: number) => void
  registerRef: (el: HTMLElement) => void
}

function DataRow<TRow extends object>(props: DataRowProps<TRow>) {
  const { table, row } = props
  const isSelected = createMemo(() => table.selection().has(row))
  const rk = createMemo(() =>
    props.rowKey
      ? String((row as Record<string, unknown>)[props.rowKey] ?? props.procIdx)
      : props.procIdx,
  )

  function handleClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('[data-no-row-click]')) return
    props.onRowClick?.(row, e)
  }

  return (
    <tr
      class="dt-tr"
      classList={{
        'dt-tr--selected': isSelected(),
        'dt-tr--odd': !isSelected() && props.odd,
        'dt-tr--clickable': !!props.onRowClick,
      }}
      data-row-key={String(rk())}
      data-proc-idx={props.procIdx}
      tabIndex={props.tabIndex}
      aria-selected={props.selectable ? isSelected() : undefined}
      ref={(el) => props.registerRef(el)}
      onClick={handleClick}
      onFocus={props.onFocusRow}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          props.onArrow(1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          props.onArrow(-1)
        } else if (e.key === ' ' && props.selectable) {
          e.preventDefault()
          table.toggleRowSelection(row, e.shiftKey)
        } else if (e.key === 'Enter' && props.onRowClick) {
          e.preventDefault()
          props.onRowClick(row, e)
        }
      }}
    >
      <Show when={props.selectable}>
        <td class="dt-td" style={{ width: '36px' }} data-no-row-click>
          <input
            type="checkbox"
            tabIndex={-1}
            checked={isSelected()}
            onClick={(e) => table.toggleRowSelection(row, (e as MouseEvent).shiftKey)}
          />
        </td>
      </Show>
      <Show when={props.indentGroup}>
        <td class="dt-td" style={{ width: '28px' }} />
      </Show>
      <For each={table.activeColumns()}>
        {(col) => <td class="dt-td">{cellValue(col, row)}</td>}
      </For>
    </tr>
  )
}
