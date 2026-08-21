import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { SortDropdown } from '../components/SortDropdown'
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
const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90 },
  { id: 2, name: 'Bob', score: 60 },
]

// Gives every row in `container` a deterministic, non-zero-height rect in document order, since
// jsdom doesn't compute real layout — resolveDropRow's cursor-position math needs real rects.
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
        <SortDropdown
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

describe('SortDropdown', () => {
  it('clicking an addable column adds it as an ascending sort', () => {
    const { container, table, dispose } = mount()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Score')!
    btn.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    dispose()
  })

  it('clicking an active row toggles its direction', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('score')
    const row = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    row.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'desc' }])
    dispose()
  })

  it('the remove button removes just that entry without toggling its direction', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    const row = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    row.querySelector<HTMLButtonElement>('.dt-item-remove')!.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    dispose()
  })

  it('drag-and-drop reorders active entries', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    stubRects(container, '[data-sort-key]')

    // jsdom has no DragEvent — a plain MouseEvent works identically here since dispatch only
    // cares about the `type` string matching what onDragStart/onDragOver/onDrop bind to, and
    // resolveDropRow only reads `clientY`.
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    nameRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    // score row is the second row (index 1), rect top=30/bottom=60 per stubRects — drop past its
    // vertical midpoint (clientY=50) resolves to "insert after".
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 50 }))
    scoreRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 50 }))

    expect(table.sort.entries().map((s) => s.key)).toEqual(['score', 'name'])
    dispose()
  })

  it('search narrows the addable list only, not the active section', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('id')
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'sco'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const addableLabels = [...container.querySelectorAll('.dt-dd-item--click .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(addableLabels).toEqual(['Score'])
    expect(container.querySelector('[data-sort-key="id"]')).not.toBeNull()
    dispose()
  })

  it('excludes a sortable: false column from the addable list', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID', sortable: false },
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, cols)
      const [isOpen, setIsOpen] = createSignal(true)
      render(
        () => (
          <SortDropdown
            table={table}
            columns={cols}
            isOpen={isOpen()}
            onToggle={() => setIsOpen((o) => !o)}
            onClose={() => setIsOpen(false)}
          />
        ),
        container,
      )
      return d
    })
    const addableLabels = [...container.querySelectorAll('.dt-dd-item--click .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(addableLabels).not.toContain('ID')
    expect(addableLabels).toEqual(['Name', 'Score'])
    dispose()
  })
})
