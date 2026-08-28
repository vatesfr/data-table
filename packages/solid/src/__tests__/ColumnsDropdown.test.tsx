import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { ColumnsDropdown } from '../components/ColumnsDropdown'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score', type: 'number' },
]
const ROWS: Row[] = [{ id: 1, name: 'Alice', score: 90 }]

function stubRects(container: HTMLElement, selector: string): void {
  const rows = [...container.querySelectorAll<HTMLElement>(selector)]
  rows.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: i * 30, bottom: i * 30 + 30, left: 0, right: 100, height: 30, width: 100 }) as DOMRect
  })
}

function mount(cols: ColumnDef<Row>[] = COLS) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  // A CategorySubmenu's flyout portals to document.body (see CategorySubmenu.tsx) — render()'s
  // own disposer must be captured and called too, or a submenu left open leaks its portaled DOM
  // node into every test that runs after it (see SortDropdown.test.tsx's identical comment).
  let disposeView!: () => void
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, cols)
    const [isOpen] = createSignal(true)
    disposeView = render(
      () => (
        <ColumnsDropdown
          table={table}
          columns={cols}
          isOpen={isOpen()}
          onToggle={() => {}}
          onClose={() => {}}
        />
      ),
      container,
    )
    return d
  })
  return {
    container,
    table,
    dispose: () => {
      disposeView()
      dispose()
    },
  }
}

function visibleLabels(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll('.dt-dd-item--colrow .dt-flex1')].map((el) =>
    el.textContent?.trim(),
  )
}

describe('ColumnsDropdown — Visible section', () => {
  it('lists every visible column in table order, not alphabetized', () => {
    const { container, dispose } = mount()
    expect(visibleLabels(container)).toEqual(['ID', 'Name', 'Score'])
    dispose()
  })

  it('the × button hides a column, moving it into Available', () => {
    const { container, table, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score'])
    expect(visibleLabels(container)).toEqual(['Name', 'Score'])
    expect(container.querySelector('[data-col-key="id"]')?.textContent).toContain('ID')
    dispose()
  })

  it('Delete/Backspace on a focused visible row hides it, same as its × button', () => {
    const { container, table, dispose } = mount()
    const row = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
    )
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score'])
    dispose()
  })

  it('hiding the last visible column is a no-op (stays >= 1 visible)', () => {
    const { container, table, dispose } = mount()
    // Hide two of the three, leaving one.
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['score'])
    container
      .querySelector<HTMLButtonElement>('[data-col-row-key="score"] .dt-item-remove')!
      .click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['score']) // unchanged
    dispose()
  })

  it('drag-and-drop reorders visible columns (reflected in activeColumns order)', () => {
    const { container, table, dispose } = mount()
    stubRects(container, '[data-col-row-key]')
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    // score row is at index 2 (top=60/bottom=90) — drop past its midpoint (clientY=80) inserts
    // "id" after "score".
    const scoreRow = container.querySelector<HTMLElement>('[data-col-row-key="score"]')!
    scoreRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 80 }))
    scoreRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 80 }))
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score', 'id'])
    dispose()
  })

  it('Alt+ArrowDown on a row moves it down one visible position', () => {
    const { container, table, dispose } = mount()
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'id', 'score'])
    dispose()
  })

  it('Alt+ArrowDown/ArrowUp keeps focus on the moved row instead of dropping to <body>', () => {
    const { container, dispose } = mount()
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.focus()
    idRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    // "id" is now the row at its new position — same node, moved.
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="id"]'))
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="id"]'))
    dispose()
  })

  it('Alt+ArrowDown skips a hidden column, reordering against the next visible one', () => {
    const { container, table, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click() // hide the one in between id/score
    expect(visibleLabels(container)).toEqual(['ID', 'Score'])
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(visibleLabels(container)).toEqual(['Score', 'ID']) // not a no-op
    expect(table.columns.active().map((c) => c.key)).toEqual(['score', 'id'])
    dispose()
  })
})

describe('ColumnsDropdown — Available section', () => {
  it('lists hidden columns as plain addable rows, in table order', () => {
    const { container, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    container
      .querySelector<HTMLButtonElement>('[data-col-row-key="score"] .dt-item-remove')!
      .click()
    expect(
      [...container.querySelectorAll('button[data-col-key]')].map((b) => b.textContent),
    ).toEqual(['ID', 'Score'])
    dispose()
  })

  it('clicking an addable row shows the column again and refocuses its new visible row', () => {
    const { container, table, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    container.querySelector<HTMLButtonElement>('[data-col-key="id"]')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="id"]'))
    dispose()
  })

  it('a re-shown column reappears at its original table-order position, not appended at the end', () => {
    const { container, table, dispose } = mount()
    // Hide the middle column, then show it again with no drag in between.
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    container.querySelector<HTMLButtonElement>('[data-col-key="name"]')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    dispose()
  })

  it('no Available section (or search box) is rendered once every column is visible', () => {
    const { container, dispose } = mount()
    expect(container.querySelector('.dt-dd-search')).toBeNull()
    dispose()
  })

  it('categorized hidden columns collapse into a submenu trigger instead of plain rows', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    container
      .querySelector<HTMLButtonElement>('[data-col-row-key="score"] .dt-item-remove')!
      .click()
    expect(container.querySelector('button[data-col-key]')).toBeNull() // no flat addable rows
    expect(container.querySelector('.dt-dd-category-trigger')?.textContent).toContain('Info')
    dispose()
  })

  it('adding a categorized column from inside its submenu refocuses the new visible row', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, table, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    const trigger = container.querySelector<HTMLButtonElement>('.dt-dd-category-trigger')!
    trigger.click()
    const submenu = document.querySelector('.dt-dd-submenu')!
    submenu.querySelector<HTMLButtonElement>('[data-col-key="name"]')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="name"]'))
    dispose()
  })

  it('hiding a categorized column refocuses its category submenu trigger, not a nonexistent addable row', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    expect(document.activeElement).toBe(
      container.querySelector('.dt-dd-category-trigger[data-category-name="Info"]'),
    )
    dispose()
  })

  it('search narrows Available only, matching label or category; Visible is unaffected', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    expect(visibleLabels(container)).toEqual(['ID', 'Score'])

    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'Info'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.dt-dd-category-trigger')?.textContent).toContain('Info')
    expect(visibleLabels(container)).toEqual(['ID', 'Score']) // still unaffected by the search term
    dispose()
  })
})
