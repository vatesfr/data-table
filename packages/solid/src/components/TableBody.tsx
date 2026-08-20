import { For, Index, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
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
import { applyCheckboxState } from './checkboxSync'

interface TableBodyProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  rowKey?: keyof TRow & string
  selectable?: boolean
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
}

// A multi-value (array) column's raw value has no natural single-string representation, so it's
// joined with ", " rather than falling through to Array.prototype.toString's bare comma-join —
// matches React/Vue's own cellValue/formatValue.
function stringifyValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ')
  return String(v ?? '')
}

function cellValue<TRow extends object>(col: ColumnDef<TRow>, row: TRow): Node | string {
  const value = getColumnValue(col, row)
  // col.render returns a real DOM Node — Solid can render an arbitrary Node as a JSX child
  // directly, so (unlike the old innerHTML-string version) no placeholder-and-patch mechanism is
  // needed at all here: this is a clean simplification the Solid migration gets for free.
  if (col.render) return col.render(value, row)
  if (col.format) return col.format(value, row)
  return stringifyValue(value)
}

function aggValue<TRow extends object>(
  col: ColumnDef<TRow>,
  rows: TRow[],
  sampleRow: TRow,
): Node | string {
  if (!col.aggregate) return ''
  const v = computeAggregate(col, rows)
  // render applies uniformly to data cells, group-header cells, and aggregate cells (see
  // CLAUDE.md's "Cell rendering priority") — this branch was missing here, so a custom `render`
  // on an aggregate column was silently ignored while it worked everywhere else.
  if (col.render) return col.render(v, sampleRow)
  return col.format ? col.format(v, sampleRow) : stringifyValue(v)
}

// Table header + body: sortable/draggable header cells, group headers (collapse toggle,
// select-all, aggregate row), data rows (selection, row click), and a page-scoped roving-tabindex
// keyboard nav (see CLAUDE.md's "Keyboard navigation") — ArrowUp/ArrowDown/Home/End move focus,
// Shift+ArrowUp/Down/Home/End additionally extend row selection to the target first (mirroring a
// shift-click, via the same toggleRowSelection(row, true) anchor/range logic).
//
// Simplification vs. the fuller documented behavior: arrow-key navigation crossing a page
// boundary (and Ctrl+Home/Ctrl+End jumping to the true first/last item across *all* pages) is
// deferred — Home/End here jump to the first/last item of the current page only. This is the
// single most involved piece of the original keyboard-nav design (stashing a pending focus target
// across an async page-change re-render); flagged as a follow-up once Pagination.tsx's real page
// boundaries exist to test against.
export function TableBody<TRow extends object>(props: TableBodyProps<TRow>) {
  const { table } = props
  const rowNavEnabled = createMemo(() => !!props.selectable || !!props.onRowClick)
  const hasAgg = createMemo(() => table.columns.active().some((c) => c.aggregate))

  const [focusTarget, setFocusTarget] = createSignal<VisibleItem<TRow> | null>(null)
  const rowRefs = new Map<TRow | string, HTMLElement>()
  // Registers a row/group-header's DOM node and prunes it again once that row/header component
  // instance is disposed (filtered out, replaced by setData, or its group collapsed away) — a
  // long-lived table that periodically calls setData with fresh row objects (see CLAUDE.md's
  // scroll/focus-restore design, written with exactly that streaming/live-update use case in
  // mind) would otherwise accumulate one Map entry, pinning a detached DOM node and the old row
  // object, for every row ever seen over the table's lifetime. `onCleanup` here ties to whichever
  // component is actually mounting at call time (DataRow/GroupHeaderRow's own instance, not
  // TableBody's) since Solid's owner tracking is dynamic, not lexically scoped to where this
  // function was defined.
  function trackRowRef(key: TRow | string, el: HTMLElement): void {
    rowRefs.set(key, el)
    onCleanup(() => {
      if (rowRefs.get(key) === el) rowRefs.delete(key)
    })
  }

  const navigableItems = createMemo(() => {
    const items: VisibleItem<TRow>[] = []
    for (const g of table.groupedData()) {
      if (g.key !== null) items.push({ kind: 'group', key: g.key })
      const collapsed =
        g.key !== null &&
        isGroupCollapsed(table.group.collapsed(), g.key, table.group.defaultCollapsed())
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

  // Shift+Arrow/Home/End additionally extends row selection to the target before moving focus —
  // `toggleRowSelection(row, true)` reuses the exact same shift-click anchor/range logic already
  // used for a mouse shift-click (see createTableState's toggleRowSelection), just fed a
  // keyboard-derived target instead of a click target. Only applies when the target is a row —
  // landing on a group header via a shift-key press just moves focus, since a header isn't a
  // rangeable selection unit.
  function moveFocus(delta: number, shiftKey = false): void {
    const items = navigableItems()
    const idx = items.findIndex((i) => isSameVisibleItem(i, effectiveFocusTarget()!))
    const next = items[idx + delta]
    if (!next) return
    if (shiftKey && next.kind === 'row') table.selection.toggle(next.row, true)
    focusItem(next)
  }

  // Home/End jump to the first/last navigable item *of the current page* — crossing to another
  // page's first/last item (Ctrl+Home/Ctrl+End's documented behavior) stays deferred alongside
  // the rest of the cross-page keyboard nav noted above.
  function jumpFocus(toEnd: boolean, shiftKey = false): void {
    const items = navigableItems()
    const next = toEnd ? items[items.length - 1] : items[0]
    if (!next) return
    if (shiftKey && next.kind === 'row') table.selection.toggle(next.row, true)
    focusItem(next)
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
    if (from && hit && hit !== from) table.columns.move(from, hit, false)
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
  // Unconditionally rewrites both .checked and .indeterminate (not just a plain JSX `checked`
  // binding) — Solid's compiled setter only writes `.checked` when the *tracked value* changes,
  // but a native checkbox click's own pre-click activation can flip `.checked` on its own even
  // when `allSelected()` doesn't change (e.g. clearing a partial selection: allSelected() is
  // false both before and after), leaving the DOM out of sync with the empty selection. See
  // checkboxSync.ts.
  let selectAllEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(selectAllEl, allSelected(), someSelected())
  })

  function handleHeaderClick(key: string, e: MouseEvent): void {
    if (e.shiftKey) table.sort.appendOrToggle(key)
    else table.sort.replace(key)
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
                  onClick={() => table.selection.toggleAll(table.processedData())}
                />
              </th>
            </Show>
            <Show when={table.group.by().length > 0}>
              <th class="dt-th dt-th--no-sort" style={{ width: '28px' }} />
            </Show>
            <For each={table.columns.active()}>
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
          {/* Index, not For: paginateVisibleGroups/groupedData() returns fresh PagedGroup object
              references on every recompute (even when only a group's collapsed state changed),
              which would make For — keyed by item reference — remount every group's header/rows
              on any collapse toggle, dropping DOM focus to <body> along the way. Index instead
              tracks by array position, so the same slot (and the same GroupHeaderRow/DataRow
              component instances) is reused whenever the group count/order is unchanged, exactly
              the case for a plain collapse/expand. `group` becomes an accessor (`group()`) here,
              per Index's signature. */}
          <Index each={table.groupedData()}>
            {(group) => (
              <Show
                when={group().key !== null}
                fallback={
                  <For each={group().rows}>
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
                        onArrow={(delta, shiftKey) => moveFocus(delta, shiftKey)}
                        onJump={(toEnd, shiftKey) => jumpFocus(toEnd, shiftKey)}
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
                  onArrow={(delta) => moveFocus(delta)}
                  onJump={(toEnd) => jumpFocus(toEnd)}
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
                  <For each={group().rows}>
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
                        onArrow={(delta, shiftKey) => moveFocus(delta, shiftKey)}
                        onJump={(toEnd, shiftKey) => jumpFocus(toEnd, shiftKey)}
                        registerRef={(el) => trackRowRef(row, el)}
                      />
                    )}
                  </For>
                </Show>
              </Show>
            )}
          </Index>
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
  onJump: (toEnd: boolean) => void
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
  // See the header select-all checkbox's own comment above (same fix, same reason): unconditional
  // rewrite of both properties, not just indeterminate, so a native click's own pre-click
  // activation can't leave `.checked` out of sync with an unchanged `groupAllSelected()`.
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
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            props.onArrow(1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            props.onArrow(-1)
          } else if (e.key === 'Home') {
            e.preventDefault()
            props.onJump(false)
          } else if (e.key === 'End') {
            e.preventDefault()
            props.onJump(true)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            table.group.toggleCollapse(props.group.key!)
          } else if (e.key === ' ' && props.selectable) {
            e.preventDefault()
            table.selection.toggleAll(props.group.rows)
          }
        }}
      >
        <Show when={props.selectable}>
          <td class="dt-group-td" style={{ width: '36px' }}>
            <input
              type="checkbox"
              checked={groupAllSelected()}
              ref={cbEl}
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
                    : renderGroupCellValue(
                        gCol,
                        props.group.sampleRow!,
                        props.group.keyParts[gi()],
                      )}
                </>
              )
            }}
          </For>
          <Show when={props.group.continued}>
            {' '}
            <span class="dt-group-continued">{table.labels.groupContinued}</span>
          </Show>{' '}
          <span class="dt-group-count">{table.labels.rowsInGroup(props.group.rows.length)}</span>
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
              <td class="dt-agg-td">{aggValue(col, props.group.rows, props.group.sampleRow!)}</td>
            )}
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
  onArrow: (delta: number, shiftKey: boolean) => void
  onJump: (toEnd: boolean, shiftKey: boolean) => void
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
          props.onArrow(1, e.shiftKey)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          props.onArrow(-1, e.shiftKey)
        } else if (e.key === 'Home') {
          e.preventDefault()
          props.onJump(false, e.shiftKey)
        } else if (e.key === 'End') {
          e.preventDefault()
          props.onJump(true, e.shiftKey)
        } else if (e.key === ' ' && props.selectable) {
          e.preventDefault()
          table.selection.toggle(row, e.shiftKey)
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
            onClick={(e) => table.selection.toggle(row, (e as MouseEvent).shiftKey)}
          />
        </td>
      </Show>
      <Show when={props.indentGroup}>
        <td class="dt-td" style={{ width: '28px' }} />
      </Show>
      <For each={table.columns.active()}>
        {(col) => <td class="dt-td">{cellValue(col, row)}</td>}
      </For>
    </tr>
  )
}
