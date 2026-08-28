import { describe, it, expect } from 'vitest'
import { createDataTable } from '../index'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
  dept: string
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name', type: 'string', filterable: true },
  { key: 'score', label: 'Score', type: 'number', filterable: true },
  { key: 'dept', label: 'Dept', type: 'string', groupable: true },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90, dept: 'Eng' },
  { id: 2, name: 'Bob', score: 60, dept: 'HR' },
  { id: 3, name: 'Clara', score: 80, dept: 'Eng' },
  { id: 4, name: 'David', score: 70, dept: 'HR' },
]

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function shiftClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }))
}

function colHeaders(container: HTMLElement): string[] {
  return [...container.querySelectorAll('th.dt-th')].map((th) =>
    th.textContent!.replace(/[↕↑↓0-9]/g, '').trim(),
  )
}

// Gives every matched element a deterministic, non-zero-height rect in document order, since
// jsdom doesn't compute real layout — resolveDropRow's/resolveDropRowHorizontal's cursor-position
// math needs real rects (same pattern as SortDropdown.test.tsx/ColumnsDropdown.test.tsx/
// TableBody.test.tsx).
function stubRects(container: HTMLElement, selector: string): void {
  const rows = [...container.querySelectorAll<HTMLElement>(selector)]
  rows.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({
        top: i * 30,
        bottom: i * 30 + 30,
        left: i * 80,
        right: i * 80 + 80,
        height: 30,
        width: 80,
      }) as DOMRect
  })
}

function mouseEvt(type: string, opts: { clientY?: number; clientX?: number } = {}): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...opts })
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no button with text "${text}"`)
  return btn
}

function openDropdown(container: HTMLElement, text: string): void {
  click(findButton(container, text))
}

function mount(options: Partial<Parameters<typeof createDataTable<Row>>[1]> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const table = createDataTable(container, { data: ROWS, columns: COLS, ...options })
  return { container, table }
}

describe('createDataTable — sorting', () => {
  it('clicking a column header sorts rows ascending', () => {
    const { container } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90
  })

  it('clicking a sorted column reverses to descending', () => {
    const { container } = mount()
    const scoreHeader = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    click(scoreHeader)
    click(scoreHeader)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60
  })

  it('clicking a third time clears the sort', () => {
    const { container, table } = mount()
    const scoreHeader = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    click(scoreHeader)
    click(scoreHeader)
    click(scoreHeader)
    expect(table.getViewState().sorts ?? []).toEqual([])
  })

  it("a column's defaultSortDir controls where header-click/shift-click sorting starts", () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'score', label: 'Score', type: 'number', defaultSortDir: 'desc' },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const table = createDataTable(container, { data: ROWS, columns: cols })
    const scoreHeader = () => container.querySelector<HTMLElement>('th[data-col-key="score"]')!

    click(scoreHeader()) // plain click (replaceSort)
    expect(table.getViewState().sorts).toEqual([{ key: 'score', dir: 'desc' }])
    click(scoreHeader())
    expect(table.getViewState().sorts).toEqual([{ key: 'score', dir: 'asc' }])
    click(scoreHeader())
    expect(table.getViewState().sorts ?? []).toEqual([])

    shiftClick(scoreHeader()) // shift-click (appendOrToggleSort)
    expect(table.getViewState().sorts).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('plain-clicking a different header replaces the sort instead of appending to it', () => {
    const { container, table } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="name"]')!)
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    expect(table.getViewState().sorts).toEqual([{ key: 'score', dir: 'asc' }])
  })

  it('shift-clicking a header appends it to the existing sort instead of replacing it', () => {
    const { container, table } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="name"]')!)
    shiftClick(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    expect(table.getViewState().sorts).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'score', dir: 'asc' },
    ])
  })

  it('shift-clicking an already-sorted column flips its direction in place, without removing it', () => {
    const { container, table } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="name"]')!)
    const scoreHeader = () => container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    shiftClick(scoreHeader())
    shiftClick(scoreHeader())
    expect(table.getViewState().sorts).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'score', dir: 'desc' },
    ])
    // A third shift-click flips it back to asc rather than removing it from the stack.
    shiftClick(scoreHeader())
    expect(table.getViewState().sorts).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'score', dir: 'asc' },
    ])
  })

  it('a single sorted column shows only the direction arrow, no index number', () => {
    const { container } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    const icon = container.querySelector<HTMLElement>('th[data-col-key="score"] .dt-sort-icon')!
    expect(icon.textContent).toBe('↑')
  })

  it('shows an index number on each header once more than one column is sorted', () => {
    const { container } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="name"]')!)
    shiftClick(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    const nameIcon = container.querySelector<HTMLElement>('th[data-col-key="name"] .dt-sort-icon')!
    const scoreIcon = container.querySelector<HTMLElement>(
      'th[data-col-key="score"] .dt-sort-icon',
    )!
    expect(nameIcon.textContent).toBe('1↑')
    expect(scoreIcon.textContent).toBe('2↑')
  })

  it('a sort on a grouped-out column is not numbered and does not shift visible headers’ numbers', () => {
    const { container, table } = mount()
    // dept is grouped, so it has no header of its own; its sort entry (used to order the groups)
    // stays in `sorts` regardless. Append score's sort (shift-click) rather than a plain click,
    // which would otherwise reset `sorts` to score alone and not exercise the case at all.
    table.setViewState({ sorts: [{ key: 'dept', dir: 'asc' }], groupBy: ['dept'] })
    shiftClick(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    expect(table.getViewState().sorts).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'score', dir: 'asc' },
    ])
    const scoreIcon = container.querySelector<HTMLElement>(
      'th[data-col-key="score"] .dt-sort-icon',
    )!
    // Only one *visible* header is sorted (score) — dept's entry is invisible, so no number at
    // all, not "2" (which would imply a missing "1" somewhere).
    expect(scoreIcon.textContent).toBe('↑')
  })

  it('active sort has no count badge on the Sort button, but shows a chip in the active bar', () => {
    const { container } = mount()
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    // The Sort toggle button's own text is exactly "Sort" — no appended count/badge.
    expect(findButton(container, 'Sort').textContent?.trim()).toBe('Sort')
    const chip = container.querySelector<HTMLElement>('.dt-active-bar .dt-chip')!
    expect(chip.textContent).toContain('Score')
    click(chip.querySelector<HTMLElement>('.dt-chip-x')!)
    expect(container.querySelector('.dt-active-bar .dt-chip')).toBeNull()
  })
})

describe('createDataTable — sort dropdown (active/add split, direction, remove, reorder)', () => {
  it('lists a not-yet-sorted column under the add section, clicking it adds it ascending', () => {
    const { container } = mount()
    openDropdown(container, 'Sort')
    const addBtn = [...container.querySelectorAll('.dt-dd-item--click')].find(
      (el) => el.textContent?.trim() === 'Score',
    )!
    click(addBtn)
    expect(container.querySelector('[data-sort-key="score"]')).not.toBeNull()
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90 — ascending
  })

  it('the add-sort row is a real <button>, reachable by Tab and activatable with Enter/Space', () => {
    const { container } = mount()
    openDropdown(container, 'Sort')
    const addBtn = [...container.querySelectorAll<HTMLButtonElement>('.dt-dd-item--click')].find(
      (el) => el.textContent?.trim() === 'Score',
    )!
    expect(addBtn.tagName).toBe('BUTTON')
    expect(addBtn.tabIndex).toBe(0)
    // A native <button> fires its own click on Enter/Space with no listener of our own needed —
    // dispatching a real click is enough to prove that.
    click(addBtn)
    expect(container.querySelector('[data-sort-key="score"]')).not.toBeNull()
  })

  it('clicking an active sort row flips it between ascending and descending', () => {
    const { container } = mount()
    openDropdown(container, 'Sort')
    const addBtn = [...container.querySelectorAll('.dt-dd-item--click')].find(
      (el) => el.textContent?.trim() === 'Score',
    )!
    click(addBtn)
    click(container.querySelector<HTMLElement>('[data-sort-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60 — descending
  })

  it('the remove button clears the sort and moves the column back to the add section', () => {
    const { container } = mount()
    openDropdown(container, 'Sort')
    const addBtn = [...container.querySelectorAll('.dt-dd-item--click')].find(
      (el) => el.textContent?.trim() === 'Score',
    )!
    click(addBtn)
    const row = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    click(row.querySelector<HTMLElement>('.dt-item-remove')!)
    expect(container.querySelector('[data-sort-key="score"]')).toBeNull()
    const addBtnAgain = [...container.querySelectorAll('.dt-dd-item--click')].find(
      (el) => el.textContent?.trim() === 'Score',
    )
    expect(addBtnAgain).not.toBeUndefined()
  })

  it('the Sort toolbar button has no clear-sorts button until a sort is active', () => {
    const { container } = mount()
    expect(container.querySelector('.dt-btn-clear')).toBeNull()
  })

  it('clear-sorts on the toolbar clears all sorts without opening the dropdown', () => {
    const { container } = mount()
    openDropdown(container, 'Sort')
    const addBtn = [...container.querySelectorAll('.dt-dd-item--click')].find(
      (el) => el.textContent?.trim() === 'Score',
    )!
    click(addBtn)
    openDropdown(container, 'Sort') // close it

    click(container.querySelector<HTMLElement>('.dt-btn-clear')!)
    expect(container.querySelector('.dt-dd')).toBeNull() // still closed, not reopened by the click
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Bob', 'Clara', 'David']) // original order, no longer sorted
  })

  it('active sort rows are draggable and reorder priority on drop', () => {
    const { container } = mount()
    openDropdown(container, 'Sort')
    ;[...container.querySelectorAll('.dt-dd-item--click')]
      .find((el) => el.textContent?.trim() === 'Name')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ;[...container.querySelectorAll('.dt-dd-item--click')]
      .find((el) => el.textContent?.trim() === 'Score')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    stubRects(container, '[data-sort-key]')
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    expect(nameRow.getAttribute('draggable')).toBe('true')

    scoreRow.dispatchEvent(mouseEvt('dragstart'))
    // nameRow is the first row (top=0/bottom=30 per stubRects) — drop above its midpoint
    // (clientY=10) resolves to "insert before".
    nameRow.dispatchEvent(mouseEvt('dragover', { clientY: 10 }))
    nameRow.dispatchEvent(mouseEvt('drop', { clientY: 10 }))

    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Name'])
  })

  it('dropping past the last active sort row moves the dragged row to the end', () => {
    const { container, table } = mount()
    table.setViewState({
      sorts: [
        { key: 'name', dir: 'asc' },
        { key: 'score', dir: 'asc' },
        { key: 'dept', dir: 'asc' },
      ],
    })
    openDropdown(container, 'Sort')
    stubRects(container, '[data-sort-key]')
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const rowsContainer = nameRow.parentElement!

    nameRow.dispatchEvent(mouseEvt('dragstart'))
    // Pointer is well below the last active row (dept, bottom=90 per stubRects), over dead space
    // in the dropdown panel below the last row that carries no data-sort-key of its own — this
    // used to silently reject the drop entirely.
    rowsContainer.dispatchEvent(mouseEvt('dragover', { clientY: 200 }))
    rowsContainer.dispatchEvent(mouseEvt('drop', { clientY: 200 }))

    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Dept', 'Name'])
  })

  it('dropping on the bottom half of the last active sort row moves the dragged row after it', () => {
    const { container, table } = mount()
    table.setViewState({
      sorts: [
        { key: 'name', dir: 'asc' },
        { key: 'score', dir: 'asc' },
      ],
    })
    openDropdown(container, 'Sort')
    stubRects(container, '[data-sort-key]')
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!

    nameRow.dispatchEvent(mouseEvt('dragstart'))
    // scoreRow is the second row (top=30/bottom=60 per stubRects) — clientY 50 falls in its
    // bottom half, so name should land *after* score, not before it.
    scoreRow.dispatchEvent(mouseEvt('dragover', { clientY: 50 }))
    scoreRow.dispatchEvent(mouseEvt('drop', { clientY: 50 }))

    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Name'])
  })

  it('Alt+ArrowUp/Alt+ArrowDown on a focused sort row reorders priority', () => {
    const { container, table } = mount()
    table.setViewState({
      sorts: [
        { key: 'name', dir: 'asc' },
        { key: 'score', dir: 'asc' },
      ],
    })
    openDropdown(container, 'Sort')
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Name'])
  })

  it('Alt+ArrowUp on the first sort row is a no-op', () => {
    const { container, table } = mount()
    table.setViewState({
      sorts: [
        { key: 'name', dir: 'asc' },
        { key: 'score', dir: 'asc' },
      ],
    })
    openDropdown(container, 'Sort')
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    nameRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Name', 'Score'])
  })

  it('Enter on a focused sort row toggles its direction, same as a click', () => {
    const { container, table } = mount()
    table.setViewState({ sorts: [{ key: 'score', dir: 'asc' }] })
    openDropdown(container, 'Sort')
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60 — descending
  })
})

describe('createDataTable — scroll restore', () => {
  it('preserves table scroll position across a re-render triggered by a click', () => {
    const { container, table } = mount()
    container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop = 42
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    expect(container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop).toBe(42)
    table.destroy()
  })

  it('preserves table scroll position across a re-render triggered by setData', () => {
    const { container, table } = mount()
    container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop = 42
    table.setData([...ROWS, { id: 5, name: 'Eve', score: 55, dept: 'Eng' }])
    expect(container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop).toBe(42)
  })
})

describe('createDataTable — column visibility', () => {
  it('the × button on a visible column row hides it', () => {
    const { container } = mount()
    openDropdown(container, 'Columns')
    click(container.querySelector<HTMLElement>('[data-col-row-key="name"] .dt-item-remove')!)
    expect(colHeaders(container)).not.toContain('Name')
  })

  it('cannot hide the last visible column', () => {
    const { container } = mount({ initialViewState: { visibleCols: ['name'] } })
    openDropdown(container, 'Columns')
    click(container.querySelector<HTMLElement>('[data-col-row-key="name"] .dt-item-remove')!)
    expect(colHeaders(container)).toContain('Name')
  })
})

describe('createDataTable — column reordering', () => {
  it('renders headers as draggable with a data-col-key', () => {
    const { container } = mount()
    const th = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    expect(th.getAttribute('draggable')).toBe('true')
  })

  it('columns dropdown rows are draggable and reorder headers on drop', () => {
    const { container } = mount()
    openDropdown(container, 'Columns')
    stubRects(container, '[data-col-row-key]')
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-col-row-key="score"]')!
    expect(scoreRow.getAttribute('draggable')).toBe('true')

    scoreRow.dispatchEvent(mouseEvt('dragstart'))
    // nameRow is the first row (top=0/bottom=30 per stubRects) — clientY 10 falls in its top
    // half, so score should land before name.
    nameRow.dispatchEvent(mouseEvt('dragover', { clientY: 10 }))
    nameRow.dispatchEvent(mouseEvt('drop', { clientY: 10 }))
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('Alt+ArrowUp/Alt+ArrowDown on a focused column row reorders headers', () => {
    const { container } = mount()
    openDropdown(container, 'Columns')
    const scoreRow = container.querySelector<HTMLElement>('[data-col-row-key="score"]')!
    scoreRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('Alt+ArrowUp on the first column row is a no-op', () => {
    const { container } = mount()
    openDropdown(container, 'Columns')
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    nameRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(colHeaders(container)).toEqual(['Name', 'Score', 'Dept'])
  })

  it('dropping past the last column row moves the dragged row to the end', () => {
    const { container } = mount()
    openDropdown(container, 'Columns')
    stubRects(container, '[data-col-row-key]')
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    const rowsContainer = nameRow.parentElement!

    nameRow.dispatchEvent(mouseEvt('dragstart'))
    // Pointer is well below the last column row (dept, bottom=90 per stubRects), over dead space
    // in the dropdown panel below the last row that carries no data-col-row-key of its own — this
    // used to silently reject the drop entirely.
    rowsContainer.dispatchEvent(mouseEvt('dragover', { clientY: 200 }))
    rowsContainer.dispatchEvent(mouseEvt('drop', { clientY: 200 }))

    expect(colHeaders(container)).toEqual(['Score', 'Dept', 'Name'])
  })

  it('dropping on the bottom half of the last column row moves the dragged row after it', () => {
    const { container } = mount()
    openDropdown(container, 'Columns')
    stubRects(container, '[data-col-row-key]')
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-col-row-key="dept"]')!

    nameRow.dispatchEvent(mouseEvt('dragstart'))
    // deptRow is the third row (top=60/bottom=90 per stubRects) — clientY 80 falls in its
    // bottom half, so name should land after dept, not before it.
    deptRow.dispatchEvent(mouseEvt('dragover', { clientY: 80 }))
    deptRow.dispatchEvent(mouseEvt('drop', { clientY: 80 }))

    expect(colHeaders(container)).toEqual(['Score', 'Dept', 'Name'])
  })

  it('dragging a header and dropping it on another reorders columns', () => {
    const { container } = mount()
    stubRects(container, 'th[data-col-key]')
    const scoreTh = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    const nameTh = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    scoreTh.dispatchEvent(mouseEvt('dragstart'))
    // nameTh is the first header (left=0/right=80 per stubRects) — header drag always inserts
    // *before* the drop target (a deliberate simplification), so clientX doesn't need to target a
    // half, just land inside nameTh's rect.
    nameTh.dispatchEvent(mouseEvt('dragover', { clientX: 40 }))
    nameTh.dispatchEvent(mouseEvt('drop', { clientX: 40 }))
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('preserves order across visibility toggles', () => {
    const { container } = mount()
    stubRects(container, 'th[data-col-key]')
    const scoreTh = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    const nameTh = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    scoreTh.dispatchEvent(mouseEvt('dragstart'))
    nameTh.dispatchEvent(mouseEvt('dragover', { clientX: 40 }))
    nameTh.dispatchEvent(mouseEvt('drop', { clientX: 40 }))
    openDropdown(container, 'Columns')
    click(container.querySelector<HTMLElement>('[data-col-row-key="dept"] .dt-item-remove')!)
    expect(colHeaders(container)).toEqual(['Score', 'Name'])
  })

  it('getViewState captures columnOrder and setViewState round-trips it', () => {
    const { container, table } = mount()
    stubRects(container, 'th[data-col-key]')
    const scoreTh = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    const nameTh = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    scoreTh.dispatchEvent(mouseEvt('dragstart'))
    nameTh.dispatchEvent(mouseEvt('dragover', { clientX: 40 }))
    nameTh.dispatchEvent(mouseEvt('drop', { clientX: 40 }))
    const view = table.getViewState()
    expect(view.columnOrder).toEqual(['score', 'name', 'dept'])
    table.setViewState({})
    expect(colHeaders(container)).toEqual(['Name', 'Score', 'Dept'])
    table.setViewState(view)
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })
})

// PRUNED: (none in this chunk — every test in the assigned range had a still-valid new-markup
// equivalent; drag/drop tests were rewritten to use explicit clientX/clientY + stubRects instead
// of the old implementation's zero-clientY generic Event trick, since the new resolveDropRow/
// resolveDropRowHorizontal genuinely read clientX/clientY to resolve the target row/column.)
