import { For, Index, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import {
  getColumnAlign,
  getColumnValue,
  rowText,
  groupText,
  computeAggregate,
  formatAggregate,
  getSortIcon,
  getSortIndex,
  isGroupCollapsed,
  isSameVisibleItem,
  paginateVisibleItems,
  planRowNav,
  type VisibleItem,
  applyCheckboxState,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { HeaderMenu } from './HeaderMenu'
import { focusSearch } from './SearchBox'

interface TableBodyProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  rowKey?: keyof TRow & string
  selectable?: boolean
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
  currentRow?: TRow | null
  rowClass?: (row: TRow) => string | undefined
}

// Joins an array value with ", ", as React/Vue do
function stringifyValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ')
  return String(v ?? '')
}

// Cell rendering priority (docs/packages.md): col.render → col.format → `fallback` (`stringifyValue`, or `String` for a group key)
function renderCell<TRow extends object>(
  col: ColumnDef<TRow>,
  value: unknown,
  contextRow: TRow,
  fallback: (v: unknown) => string = stringifyValue,
): Node | string {
  if (col.render) return col.render(value, contextRow)
  if (col.format) return col.format(value, contextRow)
  return fallback(value)
}

function cellValue<TRow extends object>(col: ColumnDef<TRow>, row: TRow): Node | string {
  return renderCell(col, getColumnValue(col, row), row)
}

// aggregateFormat, else render, else format (formatAggregate); nothing for an empty aggregate
function aggValue<TRow extends object>(col: ColumnDef<TRow>, rows: TRow[]): Node | string {
  if (!col.render || col.aggregateFormat) return formatAggregate(col, rows)
  const v = computeAggregate(col, rows)
  return v === undefined || v === null ? '' : col.render(v, rows[0])
}

// Table header + body: sortable/draggable header cells, group headers (collapse toggle,
// select-all, aggregate row), data rows (selection, row click), and a roving-tabindex keyboard
// nav planned by core's `planRowNav` (see docs/keyboard-navigation.md).
export function TableBody<TRow extends object>(props: TableBodyProps<TRow>) {
  const { table } = props
  const rowNavEnabled = createMemo(() => !!props.selectable || !!props.onRowClick)
  const hasAgg = createMemo(() => table.columns.active().some((c) => c.aggregate))

  // In `createTableState` so `focus.moveTo` reaches it from outside
  const focusTarget = table.focus.target
  const setFocusTarget = table.focus.setTarget
  const rowRefs = new Map<TRow | string, HTMLElement>()
  // Pruned on the row's disposal, or a table fed fresh rows would keep every detached node
  function trackRowRef(key: TRow | string, el: HTMLElement): void {
    rowRefs.set(key, el)
    onCleanup(() => {
      if (rowRefs.get(key) === el) rowRefs.delete(key)
    })
  }

  const navigableItems = createMemo(() =>
    paginateVisibleItems(
      table.visibleItems(),
      table.pagination.page(),
      table.pagination.pageSize(),
    ).filter((item) => item.kind === 'group' || rowNavEnabled()),
  )

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

  // Scrolls `focus.target` into view for `moveTo`, which doesn't focus; the row is mounted by now
  let lastScrolledFocusTarget: VisibleItem<TRow> | null = null
  createEffect(() => {
    const target = focusTarget()
    if (target && target.kind === 'row' && target !== lastScrolledFocusTarget) {
      const el = rowRefs.get(target.row)
      if (el) {
        el.scrollIntoView?.({ block: 'nearest' })
        // `moveTo(row, { focus: true })`: only this layer holds the row's node
        if (table.focus.consumeDomFocus()) el.focus({ preventScroll: true })
        lastScrolledFocusTarget = target
      }
    }
  })

  // Solid's signal writes mount the new page before `setPage` returns, so focus can follow at once
  function handleKeyDown(e: KeyboardEvent, target: VisibleItem<TRow>): void {
    const plan = planRowNav(e, target, {
      visibleItems: table.visibleItems(),
      navigableItems: navigableItems(),
      page: table.pagination.page(),
      numPages: table.pagination.numPages(),
      pageSize: table.pagination.pageSize(),
      selectable: !!props.selectable,
      rowClickable: !!props.onRowClick,
    })
    if (!plan) return
    e.preventDefault()
    if (plan.kind === 'focus') {
      if (plan.extend) table.selection.toggle(plan.extend, true)
      if (plan.page) table.pagination.setPage(plan.page)
      focusItem(plan.item)
    } else if (plan.kind === 'toggleRow') table.selection.toggle(plan.row, e.shiftKey)
    else if (plan.kind === 'toggleGroupSelection') {
      const group = table.groupedData().find((g) => g.key === plan.key)
      if (group) table.selection.toggleAll(group.rows)
    } else if (plan.kind === 'toggleCollapse') table.group.toggleCollapse(plan.key)
    else props.onRowClick?.(plan.row, e)
  }

  const procIdxMap = createMemo(() => new Map(table.processedData().map((r, i) => [r, i])))

  // --- Header drag-and-drop reorder ---
  const [dragColKey, setDragColKey] = createSignal<string | null>(null)
  // The open header menu's column: its <th> stops being draggable, or dragging a control inside
  // the menu (a range slider) would drag the column instead
  const [menuColKey, setMenuColKey] = createSignal<string | null>(null)
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
    if (from && hit && hit !== from) table.columns.move(from, hit, false)
    setDragColKey(null)
    setDragOverColKey(null)
  }
  // Header drop target: the column under clientX, always inserting before it (docs/column-reordering.md)
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
    table.sort.entries().filter((s) => table.columns.active().some((c) => c.key === s.key)),
  )

  const allSelected = createMemo(
    () =>
      table.processedData().length > 0 &&
      table.processedData().every((r) => table.selection.all().has(r)),
  )
  const someSelected = createMemo(
    () => !allSelected() && table.processedData().some((r) => table.selection.all().has(r)),
  )
  // Rewrites both properties: a native click can flip `.checked` while `allSelected()` stays put (checkboxSync.ts)
  let selectAllEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(selectAllEl, allSelected(), someSelected())
  })

  function handleHeaderClick(col: ColumnDef<TRow>, e: MouseEvent): void {
    if (col.sortable === false) return
    if (e.shiftKey) table.sort.appendOrToggle(col.key)
    else table.sort.replace(col.key)
  }

  return (
    <div class="dt-table-wrap">
      <table class="dt-table">
        <thead>
          <tr ref={headerRow} onDragOver={handleHeaderDragOver} onDrop={handleHeaderDrop}>
            <Show when={props.selectable}>
              <th
                class="dt-th dt-check-cell"
                style={{ width: '36px' }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) table.selection.toggleAll(table.processedData())
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected()}
                  ref={selectAllEl}
                  aria-label={table.labels().selectAll}
                  onClick={() => table.selection.toggleAll(table.processedData())}
                />
              </th>
            </Show>
            <Show when={table.group.by().length > 0}>
              <th class="dt-th dt-th--no-sort" style={{ width: '28px' }} />
            </Show>
            <For each={table.columns.active()}>
              {(col) => {
                const sortDir = createMemo(() => headerSorts().find((s) => s.key === col.key)?.dir)
                const isSorted = () => sortDir() !== undefined
                const sortIdx = createMemo(() =>
                  isSorted() && headerSorts().length > 1
                    ? getSortIndex(headerSorts(), col.key)
                    : null,
                )
                const icon = createMemo(() =>
                  isSorted() ? getSortIcon(headerSorts(), col.key) : '↕',
                )
                const labelAndIcon = () => (
                  <>
                    {col.label}
                    <span
                      class={`dt-sort-icon${isSorted() ? ' dt-sort-icon--active' : ''}`}
                      aria-hidden="true"
                    >
                      {sortIdx() ? `${sortIdx()}${icon()}` : icon()}
                    </span>
                  </>
                )
                return (
                  <th
                    class="dt-th"
                    classList={{
                      'dt-pinned': col.pinned,
                      'dt-dd-item--drag-over': dragOverColKey() === col.key,
                    }}
                    draggable={menuColKey() === col.key ? 'false' : 'true'}
                    data-col-key={col.key}
                    aria-sort={
                      sortDir() ? (sortDir() === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    style={col.width ? { width: `${col.width}px` } : undefined}
                    onDragStart={() => setDragColKey(col.key)}
                    onDragEnd={() => {
                      setDragColKey(null)
                      setDragOverColKey(null)
                    }}
                    onClick={(e) => handleHeaderClick(col, e)}
                  >
                    <span class="dt-th-inner">
                      {/* Takes the free space before the label, since the menu's auto margin defeats justify-content */}
                      <Show when={getColumnAlign(col)}>
                        <span class="dt-th-spacer" />
                      </Show>
                      {/* A button so keyboard users can sort; its click bubbles to the <th>'s handler */}
                      <Show when={col.sortable !== false} fallback={col.label}>
                        <button type="button" class="dt-th-sort">
                          {labelAndIcon()}
                        </button>
                      </Show>
                      <HeaderMenu
                        table={table}
                        col={col}
                        onOpenChange={(open) =>
                          setMenuColKey((cur) => (open ? col.key : cur === col.key ? null : cur))
                        }
                      />
                    </span>
                  </th>
                )
              }}
            </For>
          </tr>
        </thead>
        <tbody>
          {/* Index, not For: groups are fresh objects on every recompute, and remounting drops focus on collapse */}
          <Index each={table.groupedData()}>
            {(group) => (
              <Show
                when={group().key !== null}
                fallback={
                  <For each={group().pageRows}>
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
                        current={props.currentRow === row}
                        extraClass={props.rowClass?.(row)}
                        tabIndex={
                          rowNavEnabled()
                            ? isFocusTarget({ kind: 'row', row })
                              ? 0
                              : -1
                            : undefined
                        }
                        onFocusRow={() => setFocusTarget({ kind: 'row', row })}
                        onKeyDown={handleKeyDown}
                        registerRef={(el) => trackRowRef(row, el)}
                      />
                    )}
                  </For>
                }
              >
                <GroupHeaderRow
                  table={table}
                  columns={props.columns}
                  group={group()}
                  selectable={props.selectable}
                  hasAgg={hasAgg()}
                  tabIndex={isFocusTarget({ kind: 'group', key: group().key! }) ? 0 : -1}
                  onFocusGroup={() => setFocusTarget({ kind: 'group', key: group().key! })}
                  onKeyDown={handleKeyDown}
                  registerRef={(el) => trackRowRef(`group:${group().key}`, el)}
                />
                <Show
                  when={
                    !isGroupCollapsed(
                      table.group.collapsed(),
                      group().key!,
                      table.group.defaultCollapsed(),
                    )
                  }
                >
                  <For each={group().pageRows}>
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
                        current={props.currentRow === row}
                        extraClass={props.rowClass?.(row)}
                        indentGroup
                        tabIndex={
                          rowNavEnabled()
                            ? isFocusTarget({ kind: 'row', row })
                              ? 0
                              : -1
                            : undefined
                        }
                        onFocusRow={() => setFocusTarget({ kind: 'row', row })}
                        onKeyDown={handleKeyDown}
                        registerRef={(el) => trackRowRef(row, el)}
                      />
                    )}
                  </For>
                </Show>
              </Show>
            )}
          </Index>
          <Show when={table.processedData().length === 0}>
            <tr>
              <td
                class="dt-td dt-empty"
                colspan={
                  table.columns.active().length +
                  (props.selectable ? 1 : 0) +
                  (table.group.by().length > 0 ? 1 : 0)
                }
              >
                <Show when={table.data().length > 0} fallback={table.labels().noRows}>
                  {table.labels().noMatchingRows}{' '}
                  <button
                    type="button"
                    class="dt-btn"
                    onClick={(e) => {
                      const root = e.currentTarget.closest('.dt')
                      table.filter.clear()
                      table.search.setQuery('')
                      focusSearch(root)
                    }}
                  >
                    {table.labels().clearSearchAndFilters}
                  </button>
                </Show>
              </td>
            </tr>
          </Show>
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
  onKeyDown: (e: KeyboardEvent, item: VisibleItem<TRow>) => void
  registerRef: (el: HTMLElement) => void
}

function GroupHeaderRow<TRow extends object>(props: GroupHeaderRowProps<TRow>) {
  const { table } = props
  const isCollapsed = createMemo(() =>
    isGroupCollapsed(table.group.collapsed(), props.group.key!, table.group.defaultCollapsed()),
  )
  const groupAllSelected = createMemo(
    () =>
      props.group.rows.length > 0 && props.group.rows.every((r) => table.selection.all().has(r)),
  )
  const groupSomeSelected = createMemo(
    () => !groupAllSelected() && props.group.rows.some((r) => table.selection.all().has(r)),
  )
  // Both properties, as for the header select-all
  let cbEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(cbEl, groupAllSelected(), groupSomeSelected())
  })

  return (
    <>
      <tr
        class="dt-group-row"
        data-gkey={props.group.key}
        tabIndex={props.tabIndex}
        aria-expanded={!isCollapsed()}
        ref={(el) => props.registerRef(el)}
        onClick={() => table.group.toggleCollapse(props.group.key!)}
        onFocus={props.onFocusGroup}
        onKeyDown={(e) => props.onKeyDown(e, { kind: 'group', key: props.group.key! })}
      >
        <Show when={props.selectable}>
          <td
            class="dt-group-td dt-check-cell"
            style={{ width: '36px' }}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return
              e.stopPropagation()
              table.selection.toggleAll(props.group.rows)
            }}
          >
            <input
              type="checkbox"
              checked={groupAllSelected()}
              ref={cbEl}
              aria-label={table
                .labels()
                .selectGroup(
                  groupText(
                    props.columns,
                    table.group.by(),
                    props.group.keyParts,
                    props.group.rows[0],
                  ),
                )}
              onClick={(e) => {
                e.stopPropagation()
                table.selection.toggleAll(props.group.rows)
              }}
            />
          </td>
        </Show>
        <td class="dt-group-td" style={{ width: '28px' }}>
          {isCollapsed() ? '▶' : '▼'}
        </td>
        <td class="dt-group-td" colspan={table.columns.active().length}>
          <For each={table.group.by()}>
            {(gColKey, gi) => {
              const gCol = props.columns.find((c) => c.key === gColKey)
              return (
                <>
                  <Show when={gi() > 0}>
                    <span class="dt-group-sep"> › </span>
                  </Show>
                  <span class="dt-group-colname">{gCol?.label ?? gColKey}:</span>{' '}
                  {gCol?.groupValue
                    ? (gCol.groupFormat?.(props.group.keyParts[gi()]) ?? props.group.keyParts[gi()])
                    : renderGroupCellValue(gCol, props.group.rows[0], props.group.keyParts[gi()])}
                </>
              )
            }}
          </For>
          <Show when={props.group.continued}>
            {' '}
            <span class="dt-group-continued">{table.labels().groupContinued}</span>
          </Show>{' '}
          <span class="dt-group-count">{table.labels().rowsInGroup(props.group.rows.length)}</span>
        </td>
      </tr>
      <Show when={props.hasAgg}>
        <tr class="dt-agg-row">
          <Show when={props.selectable}>
            <td class="dt-agg-td" style={{ width: '36px' }} />
          </Show>
          <td class="dt-agg-td" style={{ width: '28px' }} />
          <For each={table.columns.active()}>
            {(col) => (
              <td
                class="dt-agg-td"
                classList={{ 'dt-pinned': col.pinned }}
                data-col-key={col.key}
                style={{ 'text-align': getColumnAlign(col) }}
              >
                {aggValue(col, props.group.rows)}
              </td>
            )}
          </For>
        </tr>
      </Show>
    </>
  )
}

// A multi-value column's group header shows the group's own entry (keyPart), not the row's whole array
function renderGroupCellValue<TRow extends object>(
  col: ColumnDef<TRow> | undefined,
  sampleRow: TRow,
  keyPart: string,
): Node | string {
  if (!col) return String(keyPart ?? '')
  const raw = getColumnValue(col, sampleRow)
  const value = Array.isArray(raw) ? keyPart : raw
  return renderCell(col, value, sampleRow, (v) => String(v ?? ''))
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
  current?: boolean
  extraClass?: string
  tabIndex?: number
  onFocusRow: () => void
  onKeyDown: (e: KeyboardEvent, item: VisibleItem<TRow>) => void
  registerRef: (el: HTMLElement) => void
}

function DataRow<TRow extends object>(props: DataRowProps<TRow>) {
  const { table, row } = props
  const isSelected = createMemo(() => table.selection.all().has(row))
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
      // A class string, not classList: a computed key would bundle Solid's generic classList helper
      class={`dt-tr${isSelected() ? ' dt-tr--selected' : props.odd ? ' dt-tr--odd' : ''}${props.onRowClick ? ' dt-tr--clickable' : ''}${props.current ? ' dt-tr--current' : ''}${props.extraClass ? ` ${props.extraClass}` : ''}`}
      data-row-key={String(rk())}
      data-proc-idx={props.procIdx}
      tabIndex={props.tabIndex}
      aria-selected={props.selectable ? isSelected() : undefined}
      aria-current={props.current ? 'true' : undefined}
      ref={(el) => props.registerRef(el)}
      onClick={handleClick}
      onFocus={props.onFocusRow}
      onKeyDown={(e) => props.onKeyDown(e, { kind: 'row', row })}
    >
      <Show when={props.selectable}>
        <td
          class="dt-td dt-check-cell"
          style={{ width: '36px' }}
          data-no-row-click
          onClick={(e) => {
            if (e.target === e.currentTarget) table.selection.toggle(row, e.shiftKey)
          }}
        >
          <input
            type="checkbox"
            tabIndex={-1}
            checked={isSelected()}
            aria-label={table.labels().selectRow(rowText(table.columns.active(), row))}
            onClick={(e) => table.selection.toggle(row, (e as MouseEvent).shiftKey)}
          />
        </td>
      </Show>
      <Show when={props.indentGroup}>
        <td class="dt-td" style={{ width: '28px' }} />
      </Show>
      <For each={table.columns.active()}>
        {(col) => (
          <td
            class="dt-td"
            classList={{ 'dt-pinned': col.pinned }}
            data-col-key={col.key}
            style={{ 'text-align': getColumnAlign(col) }}
          >
            {cellValue(col, row)}
          </td>
        )}
      </For>
    </tr>
  )
}
