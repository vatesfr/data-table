import { describe, it, expect, vi } from 'vitest'
import { createRoot } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { TableBody } from '../components/TableBody'
import type { ColumnDef } from '../types'
import type { TableViewState } from '@vates/data-table-core'

interface Row {
  id: number
  name: string
  dept: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'dept', label: 'Dept', groupable: true },
  { key: 'score', label: 'Score', type: 'number', aggregate: 'avg' },
]
const ROWS: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', score: 90 },
  { id: 2, name: 'Bob', dept: 'HR', score: 60 },
  { id: 3, name: 'Clara', dept: 'Eng', score: 80 },
]

function stubRects(container: HTMLElement, selector: string): void {
  const els = [...container.querySelectorAll<HTMLElement>(selector)]
  els.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: 0, bottom: 30, left: i * 80, right: i * 80 + 80, height: 30, width: 80 }) as DOMRect
  })
}

function mount(
  opts: {
    selectable?: boolean
    onRowClick?: (r: Row, e: unknown) => void
    defaultGroupsCollapsed?: boolean
    initialViewState?: TableViewState
  } = {},
) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS, {
      defaultGroupsCollapsed: opts.defaultGroupsCollapsed,
      initialViewState: opts.initialViewState,
    })
    render(
      () => (
        <TableBody
          table={table}
          columns={COLS}
          rowKey="id"
          selectable={opts.selectable}
          onRowClick={opts.onRowClick}
        />
      ),
      container,
    )
    return d
  })
  return { container, table, dispose }
}

describe('TableBody — rendering', () => {
  it('renders one row per data row, with a cell per active column', () => {
    const { container, dispose } = mount()
    const rows = container.querySelectorAll('tbody tr.dt-tr')
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelectorAll('td')).toHaveLength(3)
    dispose()
  })

  it('respects col.format for cell display', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', format: (v) => `${v}%` }]
    createRoot((d) => {
      const table = createTableState(ROWS, cols)
      render(() => <TableBody table={table} columns={cols} />, container)
      d()
    })
    expect(container.textContent).toContain('90%')
  })
})

describe('TableBody — header sorting', () => {
  it('plain click replaces the whole sort with this column ascending', () => {
    const { container, table, dispose } = mount()
    const scoreHeader = [...container.querySelectorAll('th')].find((th) =>
      th.textContent?.includes('Score'),
    )!
    table.sort.toggle('name')
    scoreHeader.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    dispose()
  })

  it('shift-click appends to the existing multi-sort', () => {
    const { container, table, dispose } = mount()
    const scoreHeader = [...container.querySelectorAll('th')].find((th) =>
      th.textContent?.includes('Score'),
    )!
    table.sort.toggle('name')
    scoreHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    expect(table.sort.entries().map((s) => s.key)).toEqual(['name', 'score'])
    dispose()
  })

  it('sortable: false makes a header click/shift-click a no-op', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', sortable: false },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    let table!: ReturnType<typeof createTableState<Row>>
    const dispose = createRoot((d) => {
      table = createTableState(ROWS, cols)
      render(() => <TableBody table={table} columns={cols} />, container)
      return d
    })
    const nameHeader = [...container.querySelectorAll('th')].find((th) =>
      th.textContent?.includes('Name'),
    )!
    nameHeader.click()
    nameHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    expect(table.sort.entries()).toEqual([])
    dispose()
  })

  it('drag-and-drop on headers reorders columns', () => {
    const { container, table, dispose } = mount()
    stubRects(container, 'th[data-col-key]')
    const nameHeader = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    nameHeader.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    const scoreHeader = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    scoreHeader.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientX: 170 }))
    scoreHeader.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientX: 170 }))
    // Header drag always inserts *before* the drop target (a deliberate simplification, see
    // CLAUDE.md's "Column reordering") — dropping "name" onto "score" places it immediately
    // before "score", not after.
    expect(table.columns.active().map((c) => c.key)).toEqual(['dept', 'name', 'score'])
    dispose()
  })
})

describe('TableBody — selection', () => {
  it('clicking a row checkbox toggles selection', () => {
    const { container, table, dispose } = mount({ selectable: true })
    const cb = container.querySelector<HTMLInputElement>(
      'tbody tr[data-row-key="1"] input[type="checkbox"]',
    )!
    cb.click()
    expect(table.selection.rows()).toEqual([ROWS[0]])
    dispose()
  })

  it('the header select-all checkbox toggles every row', () => {
    const { container, table, dispose } = mount({ selectable: true })
    const headerCb = container.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!
    headerCb.click()
    expect(table.selection.rows()).toHaveLength(3)
    headerCb.click()
    expect(table.selection.rows()).toHaveLength(0)
    dispose()
  })

  it('clearing a partial selection via the header checkbox leaves it unchecked, not stuck checked', () => {
    // Regression test: allSelected() is false both before and after this click (1-of-3 selected
    // -> 0-of-3 selected), so Solid's compiled `checked` setter — which only writes when the
    // *tracked value* changes — never touches the DOM property here. But the checkbox's own
    // native pre-click activation flips `.checked` to true regardless, since the browser has no
    // idea the intended result is "deselect everything". Without an unconditional rewrite (see
    // checkboxSync.ts's applyCheckboxState), the header checkbox would falsely show "all
    // selected" immediately after clearing the selection to zero.
    const { container, table, dispose } = mount({ selectable: true })
    table.selection.toggle(ROWS[0])
    const headerCb = container.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!
    headerCb.click()
    expect(table.selection.rows()).toHaveLength(0)
    expect(headerCb.checked).toBe(false)
    expect(headerCb.indeterminate).toBe(false)
    dispose()
  })

  it('clicking the checkbox does not also trigger onRowClick', () => {
    const onRowClick = vi.fn()
    const { container, dispose } = mount({ selectable: true, onRowClick })
    const cb = container.querySelector<HTMLInputElement>(
      'tbody tr[data-row-key="1"] input[type="checkbox"]',
    )!
    cb.click()
    expect(onRowClick).not.toHaveBeenCalled()
    dispose()
  })
})

describe('TableBody — row click', () => {
  it('clicking a data row (not the checkbox) fires onRowClick with the row', () => {
    const onRowClick = vi.fn()
    const { container, dispose } = mount({ onRowClick })
    const row = container.querySelector<HTMLElement>('tbody tr[data-row-key="1"]')!
    row.click()
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toEqual(ROWS[0])
    dispose()
  })

  it('Enter on a focused row also fires onRowClick', () => {
    const onRowClick = vi.fn()
    const { container, dispose } = mount({ onRowClick })
    const row = container.querySelector<HTMLElement>('tbody tr[data-row-key="1"]')!
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    expect(onRowClick).toHaveBeenCalledTimes(1)
    dispose()
  })
})

describe('TableBody — grouping and aggregation', () => {
  it('grouping by a column renders a group header row per value and hides that column', () => {
    const { container, table, dispose } = mount({ defaultGroupsCollapsed: false })
    table.group.toggle('dept')
    const groupRows = container.querySelectorAll('.dt-group-row')
    expect(groupRows).toHaveLength(2) // Eng, HR
    expect(container.textContent).toContain('Dept:')
    dispose()
  })

  it('collapsing a group hides its rows but keeps the aggregate row', () => {
    const { container, table, dispose } = mount({ defaultGroupsCollapsed: false })
    table.group.toggle('dept')
    const groupRow = [...container.querySelectorAll<HTMLElement>('.dt-group-row')].find((el) =>
      el.textContent?.includes('Eng'),
    )!
    expect(container.querySelectorAll('tbody tr.dt-tr')).toHaveLength(3)
    groupRow.click()
    expect(container.querySelectorAll('tbody tr.dt-tr')).toHaveLength(1) // only HR's row left visible
    expect(container.querySelector('.dt-agg-row')).not.toBeNull()
    dispose()
  })

  it('the aggregate row reflects computeAggregate for the group', () => {
    const { container, table, dispose } = mount({ defaultGroupsCollapsed: false })
    table.group.toggle('dept')
    const aggRows = container.querySelectorAll('.dt-agg-row')
    // Eng group: Alice(90) + Clara(80) -> avg 85
    expect(aggRows[0].textContent).toContain('85')
    dispose()
  })

  it('respects a custom col.render on an aggregate column, same as data/group-header cells', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cols: ColumnDef<Row>[] = [
      { key: 'dept', label: 'Dept', groupable: true },
      {
        key: 'score',
        label: 'Score',
        type: 'number',
        aggregate: 'avg',
        render: (v) => {
          const span = document.createElement('span')
          span.className = 'custom-agg'
          span.textContent = `~${v}~`
          return span
        },
      },
    ]
    createRoot((d) => {
      const table = createTableState(ROWS, cols, { defaultGroupsCollapsed: false })
      table.group.toggle('dept')
      render(() => <TableBody table={table} columns={cols} />, container)
      d()
    })
    expect(container.querySelector('.dt-agg-row .custom-agg')?.textContent).toBe('~85~')
  })

  it("a group's own select-all checkbox toggles just that group's rows", () => {
    const { container, table, dispose } = mount({ selectable: true, defaultGroupsCollapsed: false })
    table.group.toggle('dept')
    const groupRow = [...container.querySelectorAll<HTMLElement>('.dt-group-row')].find((el) =>
      el.textContent?.includes('Eng'),
    )!
    groupRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    expect(
      table.selection
        .rows()
        .map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Clara'])
    dispose()
  })

  it("clearing a group's partial selection via its checkbox leaves it unchecked, not stuck checked", () => {
    // Same regression as the header checkbox's own test above, scoped to a group's own
    // select-all checkbox (groupAllSelected() is false both before and after: 1-of-2 -> 0-of-2).
    const { container, table, dispose } = mount({ selectable: true, defaultGroupsCollapsed: false })
    table.group.toggle('dept')
    table.selection.toggle(ROWS[0]) // Alice, one of Eng's two rows
    const groupRow = [...container.querySelectorAll<HTMLElement>('.dt-group-row')].find((el) =>
      el.textContent?.includes('Eng'),
    )!
    const groupCb = groupRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    groupCb.click()
    expect(table.selection.rows()).toHaveLength(0)
    expect(groupCb.checked).toBe(false)
    expect(groupCb.indeterminate).toBe(false)
    dispose()
  })
})

describe('TableBody — keyboard navigation', () => {
  it('End on a focused row jumps focus to the last row of the current page', () => {
    const { container, dispose } = mount({ selectable: true })
    const firstRow = container.querySelector<HTMLElement>('tbody tr[data-row-key="1"]')!
    firstRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="3"]'))
    dispose()
  })

  it('Home on a focused row jumps focus back to the first row', () => {
    const { container, dispose } = mount({ selectable: true })
    const lastRow = container.querySelector<HTMLElement>('tbody tr[data-row-key="3"]')!
    lastRow.focus()
    lastRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="1"]'))
    dispose()
  })

  it('Shift+ArrowDown extends selection to the next row, same as a shift-click', () => {
    const { container, table, dispose } = mount({ selectable: true })
    const firstRow = container.querySelector<HTMLElement>('tbody tr[data-row-key="1"]')!
    firstRow.focus()
    table.selection.toggle(ROWS[0]) // anchor = Alice
    firstRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(
      table.selection
        .rows()
        .map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Bob'])
    dispose()
  })

  it('collapsing a group via Enter does not drop DOM focus (group rows keep stable identity)', () => {
    const { container, table, dispose } = mount({ defaultGroupsCollapsed: false })
    table.group.toggle('dept')
    const groupRow = container.querySelector<HTMLElement>('.dt-group-row[data-gkey="Eng"]')!
    groupRow.focus()
    groupRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    // Same DOM node, now representing the collapsed group — still focused, not fallen back to
    // <body> (which a full remount, e.g. from a reference-keyed `<For>`, would cause).
    expect(document.activeElement).toBe(groupRow)
    expect(groupRow.getAttribute('aria-expanded')).toBe('false')
    dispose()
  })
})

describe('TableBody — keyboard navigation across pages', () => {
  it('ArrowDown at the last row of a page crosses into the next page and updates pagination.page', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    const row2 = container.querySelector<HTMLElement>('tbody tr[data-row-key="2"]')! // last on page 1
    row2.focus()
    row2.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )
    expect(table.pagination.page()).toBe(2)
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="3"]'))
    dispose()
  })

  it('ArrowUp at the first row of a page crosses into the previous page, focusing its last row', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    table.pagination.setPage(2)
    const row3 = container.querySelector<HTMLElement>('tbody tr[data-row-key="3"]')! // first on page 2
    row3.focus()
    row3.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
    )
    expect(table.pagination.page()).toBe(1)
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="2"]'))
    dispose()
  })

  it('ArrowDown does nothing at the last row of the last page (no page to cross into)', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    table.pagination.setPage(2)
    const row3 = container.querySelector<HTMLElement>('tbody tr[data-row-key="3"]')!
    row3.focus()
    row3.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )
    expect(table.pagination.page()).toBe(2)
    expect(document.activeElement).toBe(row3)
    dispose()
  })

  it('plain Home/End stay scoped to the current page', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    const row1 = container.querySelector<HTMLElement>('tbody tr[data-row-key="1"]')!
    row1.focus()
    row1.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    )
    expect(table.pagination.page()).toBe(1)
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="2"]'))
    dispose()
  })

  it('Ctrl+End jumps to the true last row across all pages', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    const row1 = container.querySelector<HTMLElement>('tbody tr[data-row-key="1"]')!
    row1.focus()
    row1.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'End',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(table.pagination.page()).toBe(2)
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="3"]'))
    dispose()
  })

  it('Cmd+Home (metaKey) jumps to the true first row across all pages', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    table.pagination.setPage(2)
    const row3 = container.querySelector<HTMLElement>('tbody tr[data-row-key="3"]')!
    row3.focus()
    row3.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Home',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(table.pagination.page()).toBe(1)
    expect(document.activeElement).toBe(container.querySelector('tbody tr[data-row-key="1"]'))
    dispose()
  })

  it('Shift+ArrowDown across a page boundary also extends selection to the crossed-into row', () => {
    const { container, table, dispose } = mount({
      selectable: true,
      initialViewState: { pageSize: 2 },
    })
    const row2 = container.querySelector<HTMLElement>('tbody tr[data-row-key="2"]')!
    row2.focus()
    table.selection.toggle(ROWS[1]) // anchor = Bob
    row2.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(
      table.selection
        .rows()
        .map((r) => r.name)
        .sort(),
    ).toEqual(['Bob', 'Clara'])
    dispose()
  })
})
