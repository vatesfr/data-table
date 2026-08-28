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

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS)
    const [isOpen, setIsOpen] = createSignal(true)
    render(
      () => (
        <ColumnsDropdown
          table={table}
          columns={COLS}
          isOpen={isOpen()}
          onToggle={() => setIsOpen((o) => !o)}
          onClose={() => setIsOpen(false)}
        />
      ),
      container,
    )
    return d
  })
  return { container, table, dispose }
}

describe('ColumnsDropdown', () => {
  it('lists every column in orderedColumns order, not alphabetized', () => {
    const { container, dispose } = mount()
    const labels = [...container.querySelectorAll('.dt-dd-item--colrow label')].map((el) =>
      el.textContent?.trim(),
    )
    expect(labels).toEqual(['ID', 'Name', 'Score'])
    dispose()
  })

  it('unchecking a column hides it from activeColumns; it stays >=1 visible', () => {
    const { container, table, dispose } = mount()
    const idCheckbox = container.querySelector<HTMLInputElement>(
      '[data-col-row-key="id"] input[type="checkbox"]',
    )!
    idCheckbox.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score'])
    dispose()
  })

  it('search narrows the list by label', () => {
    const { container, dispose } = mount()
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'sco'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const labels = [...container.querySelectorAll('.dt-dd-item--colrow label')].map((el) =>
      el.textContent?.trim(),
    )
    expect(labels).toEqual(['Score'])
    dispose()
  })

  it('search also matches by category, surfacing every column filed under it', () => {
    const categorizedCols: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, categorizedCols)
      const [isOpen] = createSignal(true)
      render(
        () => (
          <ColumnsDropdown
            table={table}
            columns={categorizedCols}
            isOpen={isOpen()}
            onToggle={() => {}}
            onClose={() => {}}
          />
        ),
        container,
      )
      return d
    })
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'Info'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const labels = [...container.querySelectorAll('.dt-dd-item--colrow label')].map((el) =>
      el.textContent?.trim(),
    )
    expect(labels).toEqual(['Name', 'Score']) // neither label contains "Info" — only category does
    dispose()
  })

  it('drag-and-drop reorders columns (reflected in activeColumns order)', () => {
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

  it('Alt+ArrowDown on the checkbox moves the column down one position', () => {
    const { container, table, dispose } = mount()
    const idCheckbox = container.querySelector<HTMLInputElement>(
      '[data-col-row-key="id"] input[type="checkbox"]',
    )!
    idCheckbox.dispatchEvent(
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
    const idCheckbox = container.querySelector<HTMLInputElement>(
      '[data-col-row-key="id"] input[type="checkbox"]',
    )!
    idCheckbox.focus()
    idCheckbox.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    // "id" is now the checkbox of the row at its new position — same node, moved.
    expect(document.activeElement).toBe(
      container.querySelector('[data-col-row-key="id"] input[type="checkbox"]'),
    )
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(document.activeElement).toBe(
      container.querySelector('[data-col-row-key="id"] input[type="checkbox"]'),
    )
    dispose()
  })
})
