import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFlexiTable } from '../index'
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

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function colHeaders(container: HTMLElement): string[] {
  return [...container.querySelectorAll('th.ft-th')].map((th) =>
    th.textContent!.replace(/[↕↑↓0-9]/g, '').trim(),
  )
}

describe('createFlexiTable', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    // The library's document-level "close on outside click" handler checks
    // container.contains(e.target). After innerHTML re-renders the target is
    // detached, so the check returns false and the dropdown closes immediately.
    // Stopping propagation at the container boundary prevents this in tests.
  })

  afterEach(() => {
    container.remove()
  })

  // --- style injection ---

  it('injects a <style> tag with light and dark mode CSS variables', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    const style = document.querySelector('style[data-ft-styles]')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('prefers-color-scheme:dark')
    expect(style!.textContent).toContain('[data-theme=dark]')
    expect(style!.textContent).toContain('[data-theme=light]')
  })

  it('inserts the style tag before existing <head> children so static stylesheets win the cascade', async () => {
    const userStyle = document.createElement('style')
    userStyle.textContent = ':root { --color-background-primary: #1b2838; }'
    document.head.appendChild(userStyle)

    // `stylesInjected` is a module-level flag set by earlier tests, so re-import
    // a fresh module instance to exercise injectStyles() for real.
    vi.resetModules()
    const { createFlexiTable: freshCreateFlexiTable } = await import('../index')
    freshCreateFlexiTable(container, { data: ROWS, columns: COLS })
    const ftStyle = document.querySelector('style[data-ft-styles]')

    expect(ftStyle).not.toBeNull()
    expect(
      ftStyle!.compareDocumentPosition(userStyle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    userStyle.remove()
    ftStyle!.remove()
  })

  // --- initial render ---

  it('renders all rows', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('renders column headers', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    expect(colHeaders(container)).toEqual(expect.arrayContaining(['Name', 'Score', 'Dept']))
  })

  it('renders cell values', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    expect(container.innerHTML).toContain('Alice')
    expect(container.innerHTML).toContain('90')
  })

  it('respects defaultVisibleColumns', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultVisibleColumns: ['name'] })
    const headers = colHeaders(container)
    expect(headers).toContain('Name')
    expect(headers).not.toContain('Score')
    expect(headers).not.toContain('Dept')
  })

  it('applies format function to cell values', () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', format: (v) => `${v} pts` }]
    createFlexiTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('90 pts')
  })

  // --- instance methods ---

  it('setData replaces rows', () => {
    const table = createFlexiTable(container, { data: ROWS, columns: COLS })
    table.setData([ROWS[0]])
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('setColumns replaces column headers', () => {
    const table = createFlexiTable(container, { data: ROWS, columns: COLS })
    // Use 'score' — a key already in visibleCols — so the column stays visible
    table.setColumns([{ key: 'score', label: 'Points' }])
    expect(colHeaders(container)).toEqual(['Points'])
    expect(colHeaders(container)).not.toContain('Name')
  })

  it('destroy clears the container', () => {
    const table = createFlexiTable(container, { data: ROWS, columns: COLS })
    table.destroy()
    expect(container.innerHTML).toBe('')
  })

  it('destroy removes event listeners so clicks no longer trigger re-renders', () => {
    const table = createFlexiTable(container, { data: ROWS, columns: COLS })
    table.destroy()
    click(container)
    expect(container.innerHTML).toBe('')
  })

  // --- sorting ---

  it('clicking a column header sorts rows ascending', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90
  })

  it('clicking a sorted column reverses to descending', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60
  })

  it('active sort shows a chip', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    expect(container.querySelector('.ft-chips')).not.toBeNull()
  })

  // --- column visibility ---

  it('toggling a column via the columns dropdown hides it', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-col"][data-key="name"]')!)
    expect(colHeaders(container)).not.toContain('Name')
  })

  it('cannot hide the last visible column', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultVisibleColumns: ['name'] })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-col"][data-key="name"]')!)
    expect(colHeaders(container)).toContain('Name')
  })

  // --- checklist filter ---

  it('checklist filter shows only matching rows', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Alice')
  })

  it('checklist filter resets page to 1', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-next"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(container.innerHTML).toContain('Alice')
  })

  // --- range filter ---

  it('min range filter keeps only rows at or above the threshold', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="score"]')!,
      '80',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90) and Clara (80)
  })

  it('max range filter keeps only rows at or below the threshold', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-max"][data-key="score"]')!,
      '70',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Bob (60) and David (70)
  })

  // --- pagination ---

  it('defaultPageSize limits rows per page', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('page-next shows the next page', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-next"]')!)
    expect(container.innerHTML).toContain('Clara')
  })

  it('page-last jumps to the last page', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-last"]')!)
    expect(container.innerHTML).toContain('David')
  })

  it('page-first returns to page 1', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-last"]')!)
    click(container.querySelector<HTMLElement>('[data-action="page-first"]')!)
    expect(container.innerHTML).toContain('Alice')
  })

  it('pageSize 0 renders all rows without pagination controls', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, defaultPageSize: 0 })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(container.querySelector('.ft-pagination')).toBeNull()
  })

  // --- row selection ---

  it('renders checkboxes when selectable is true', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, selectable: true })
    expect(container.querySelector('[data-action="select-all"]')).not.toBeNull()
  })

  it('does not render checkboxes when selectable is false (default)', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('[data-action="select-all"]')).toBeNull()
  })

  it('toggling a row calls onSelectionChange with that row', () => {
    const onChange = vi.fn()
    createFlexiTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      onSelectionChange: onChange,
    })
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="0"]')!,
    )
    expect(onChange).toHaveBeenCalledWith([ROWS[0]])
  })

  it('select-all selects all rows', () => {
    const onChange = vi.fn()
    createFlexiTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      onSelectionChange: onChange,
    })
    click(container.querySelector<HTMLElement>('[data-action="select-all"]')!)
    expect(onChange).toHaveBeenCalledWith(ROWS)
  })

  it('select-all when all are selected deselects all', () => {
    const onChange = vi.fn()
    createFlexiTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      onSelectionChange: onChange,
    })
    click(container.querySelector<HTMLElement>('[data-action="select-all"]')!)
    click(container.querySelector<HTMLElement>('[data-action="select-all"]')!)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  // --- grouping ---

  it('renders group header rows when a column is grouped', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.ft-group-row')).not.toBeNull()
  })

  it('grouped column disappears from table headers', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(colHeaders(container)).not.toContain('Dept')
  })

  it('collapsing a group hides its data rows', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const before = container.querySelectorAll('.ft-tr').length
    click(container.querySelector<HTMLElement>('.ft-group-row')!)
    expect(container.querySelectorAll('.ft-tr').length).toBeLessThan(before)
  })

  // --- search ---

  it('renders a search input in the toolbar', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector<HTMLInputElement>('[data-action="search"]')).not.toBeNull()
  })

  it('typing in the search input filters rows', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ali')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Alice')
  })

  it('search is case-insensitive', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ENG')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('clear-all resets search query', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ali')
    click(container.querySelector<HTMLElement>('[data-action="clear-all"]')!)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  // --- aggregate rows ---

  it('renders an aggregate row per group when aggregate is defined', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', aggregate: 'sum' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createFlexiTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.ft-agg-row')).not.toBeNull()
  })

  it('aggregate row shows the correct sum', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', aggregate: 'sum' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createFlexiTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    // Eng group: Alice (90) + Clara (80) = 170
    const aggRows = container.querySelectorAll('.ft-agg-row')
    expect(aggRows[0].textContent).toContain('170')
  })

  it('does not render aggregate rows when no aggregate is defined', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.ft-agg-row')).toBeNull()
  })

  // --- i18n ---

  it('uses custom labels', () => {
    createFlexiTable(container, { data: ROWS, columns: COLS, labels: { columns: 'Colonnes' } })
    expect(container.innerHTML).toContain('Colonnes')
  })

  // --- HTML escaping ---

  it('HTML-escapes cell values to prevent XSS', () => {
    const xssRow = { id: 1, name: '<script>alert(1)</script>', score: 0, dept: 'x' }
    createFlexiTable(container, { data: [xssRow], columns: COLS })
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).toContain('&lt;script&gt;')
  })
})
