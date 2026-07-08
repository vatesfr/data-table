import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

interface Game {
  id: number
  name: string
  tags: string[]
}

const GAME_COLS: ColumnDef<Game>[] = [
  { key: 'name', label: 'Name', filterable: false },
  { key: 'tags', label: 'Tags', filterable: true, groupable: true },
]

const GAMES: Game[] = [
  { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
  { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
]

const GAMES_WITH_EMPTY: Game[] = [...GAMES, { id: 3, name: 'Game C', tags: [] }]

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function colHeaders(container: HTMLElement): string[] {
  return [...container.querySelectorAll('th.dt-th')].map((th) =>
    th.textContent!.replace(/[↕↑↓0-9]/g, '').trim(),
  )
}

describe('createDataTable', () => {
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
    createDataTable(container, { data: ROWS, columns: COLS })
    const style = document.querySelector('style[data-dt-styles]')
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
    const { createDataTable: freshCreateDataTable } = await import('../index')
    freshCreateDataTable(container, { data: ROWS, columns: COLS })
    const dtStyle = document.querySelector('style[data-dt-styles]')

    expect(dtStyle).not.toBeNull()
    expect(
      dtStyle!.compareDocumentPosition(userStyle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    userStyle.remove()
    dtStyle!.remove()
  })

  // --- initial render ---

  it('renders all rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('renders column headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(colHeaders(container)).toEqual(expect.arrayContaining(['Name', 'Score', 'Dept']))
  })

  it('renders cell values', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.innerHTML).toContain('Alice')
    expect(container.innerHTML).toContain('90')
  })

  it('respects defaultVisibleColumns', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultVisibleColumns: ['name'] })
    const headers = colHeaders(container)
    expect(headers).toContain('Name')
    expect(headers).not.toContain('Score')
    expect(headers).not.toContain('Dept')
  })

  it('applies format function to cell values', () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', format: (v) => `${v} pts` }]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('90 pts')
  })

  it('passes the full row as the second argument to format', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'score', label: 'Score', format: (v, row) => `${row.name}:${v}` },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('Alice:90')
  })

  // --- instance methods ---

  it('setData replaces rows', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.setData([ROWS[0]])
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('setColumns replaces column headers', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    // Use 'score' — a key already in visibleCols — so the column stays visible
    table.setColumns([{ key: 'score', label: 'Points' }])
    expect(colHeaders(container)).toEqual(['Points'])
    expect(colHeaders(container)).not.toContain('Name')
  })

  it('destroy clears the container', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.destroy()
    expect(container.innerHTML).toBe('')
  })

  it('destroy removes event listeners so clicks no longer trigger re-renders', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.destroy()
    click(container)
    expect(container.innerHTML).toBe('')
  })

  // --- sorting ---

  it('clicking a column header sorts rows ascending', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90
  })

  it('clicking a sorted column reverses to descending', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60
  })

  it('active sort shows a chip', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    expect(container.querySelector('.dt-chips')).not.toBeNull()
  })

  // --- column visibility ---

  it('toggling a column via the columns dropdown hides it', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-col"][data-key="name"]')!)
    expect(colHeaders(container)).not.toContain('Name')
  })

  it('cannot hide the last visible column', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultVisibleColumns: ['name'] })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-col"][data-key="name"]')!)
    expect(colHeaders(container)).toContain('Name')
  })

  // --- checklist filter ---

  it('checklist filter shows only matching rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Alice')
  })

  it('checklist filter resets page to 1', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-next"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(container.innerHTML).toContain('Alice')
  })

  // --- range filter ---

  it('min range filter keeps only rows at or above the threshold', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="score"]')!,
      '80',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90) and Clara (80)
  })

  it('max range filter keeps only rows at or below the threshold', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-max"][data-key="score"]')!,
      '70',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Bob (60) and David (70)
  })

  // --- pagination ---

  it('defaultPageSize limits rows per page', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('page-next shows the next page', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-next"]')!)
    expect(container.innerHTML).toContain('Clara')
  })

  it('page-last jumps to the last page', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-last"]')!)
    expect(container.innerHTML).toContain('David')
  })

  it('page-first returns to page 1', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    click(container.querySelector<HTMLElement>('[data-action="page-last"]')!)
    click(container.querySelector<HTMLElement>('[data-action="page-first"]')!)
    expect(container.innerHTML).toContain('Alice')
  })

  it('pageSize 0 renders all rows without pagination controls', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 0 })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(container.querySelector('.dt-pagination')).toBeNull()
  })

  // --- row selection ---

  it('renders checkboxes when selectable is true', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    expect(container.querySelector('[data-action="select-all"]')).not.toBeNull()
  })

  it('does not render checkboxes when selectable is false (default)', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('[data-action="select-all"]')).toBeNull()
  })

  it('toggling a row calls onSelectionChange with that row', () => {
    const onChange = vi.fn()
    createDataTable(container, {
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
    createDataTable(container, {
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
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      onSelectionChange: onChange,
    })
    click(container.querySelector<HTMLElement>('[data-action="select-all"]')!)
    click(container.querySelector<HTMLElement>('[data-action="select-all"]')!)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  // --- row click ---

  it('clicking a row calls onRowClick with that row', () => {
    const onRowClick = vi.fn()
    createDataTable(container, { data: ROWS, columns: COLS, onRowClick })
    click(container.querySelector<HTMLElement>('[data-action="row-click"][data-proc-idx="0"]')!)
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0], expect.any(MouseEvent))
  })

  it('does not add clickable styling or fire callback when onRowClick is not set', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('.dt-tr--clickable')).toBeNull()
  })

  it('adds the clickable class to rows when onRowClick is set', () => {
    createDataTable(container, { data: ROWS, columns: COLS, onRowClick: vi.fn() })
    expect(container.querySelector('.dt-tr--clickable')).not.toBeNull()
  })

  it('injects a hover rule for clickable rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS, onRowClick: vi.fn() })
    const style = document.querySelector('style[data-dt-styles]')!
    expect(style.textContent).toContain('.dt-tr--clickable:hover')
  })

  it('clicking the selection checkbox does not trigger onRowClick', () => {
    const onRowClick = vi.fn()
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true, onRowClick })
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="0"]')!,
    )
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('clicking inside the selection checkbox cell (outside the input) does not trigger onRowClick', () => {
    const onRowClick = vi.fn()
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true, onRowClick })
    click(container.querySelector<HTMLElement>('[data-no-row-click]')!)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  // --- grouping ---

  it('renders group header rows when a column is grouped', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.dt-group-row')).not.toBeNull()
  })

  it('grouped column disappears from table headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(colHeaders(container)).not.toContain('Dept')
  })

  it('collapsing a group hides its data rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const before = container.querySelectorAll('.dt-tr').length
    click(container.querySelector<HTMLElement>('.dt-group-row')!)
    expect(container.querySelectorAll('.dt-tr').length).toBeLessThan(before)
  })

  // --- search ---

  it('renders a search input in the toolbar', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector<HTMLInputElement>('[data-action="search"]')).not.toBeNull()
  })

  it('typing in the search input filters rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ali')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Alice')
  })

  it('search is case-insensitive', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ENG')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('clear-all resets search query', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
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
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.dt-agg-row')).not.toBeNull()
  })

  it('aggregate row shows the correct sum', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', aggregate: 'sum' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    // Eng group: Alice (90) + Clara (80) = 170
    const aggRows = container.querySelectorAll('.dt-agg-row')
    expect(aggRows[0].textContent).toContain('170')
  })

  it('passes a representative group row as the second argument to format in aggregate cells', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', aggregate: 'sum', format: (v, row) => `${row.dept}=${v}` },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const aggRows = container.querySelectorAll('.dt-agg-row')
    expect(aggRows[0].textContent).toContain('Eng=170')
  })

  it('does not render aggregate rows when no aggregate is defined', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.dt-agg-row')).toBeNull()
  })

  // --- i18n ---

  it('uses custom labels', () => {
    createDataTable(container, { data: ROWS, columns: COLS, labels: { columns: 'Colonnes' } })
    expect(container.innerHTML).toContain('Colonnes')
  })

  // --- HTML escaping ---

  it('HTML-escapes cell values to prevent XSS', () => {
    const xssRow = { id: 1, name: '<script>alert(1)</script>', score: 0, dept: 'x' }
    createDataTable(container, { data: [xssRow], columns: COLS })
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).toContain('&lt;script&gt;')
  })

  // --- multi-value (array) columns ---

  it('checklist filter lists individual array items instead of the whole array', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const values = [
      ...container.querySelectorAll<HTMLInputElement>('[data-action="toggle-filter"]'),
    ].map((el) => el.dataset.value)
    expect(values).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('selecting an array item filters rows containing it', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="RPG"]')!)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Game A')
  })

  it('renders array cell values joined with a comma by default', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    expect(container.innerHTML).toContain('Action, RPG')
  })

  it('grouping by an array column fans a row into one group per item', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="tags"]')!)
    const groupTexts = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(container.querySelectorAll('.dt-group-row')).toHaveLength(3)
    expect(groupTexts.some((t) => t?.includes('Tags: Action'))).toBe(true)
    expect(groupTexts.some((t) => t?.includes('Tags: RPG'))).toBe(true)
    expect(groupTexts.some((t) => t?.includes('Tags: Adventure'))).toBe(true)
  })

  it('checklist filter lists a "(none)" entry for rows with an empty array', () => {
    createDataTable(container, { data: GAMES_WITH_EMPTY, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const values = [
      ...container.querySelectorAll<HTMLInputElement>('[data-action="toggle-filter"]'),
    ].map((el) => el.dataset.value)
    expect(values).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('grouping buckets rows with an empty array under "(none)"', () => {
    createDataTable(container, { data: GAMES_WITH_EMPTY, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="tags"]')!)
    const groupTexts = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(container.querySelectorAll('.dt-group-row')).toHaveLength(4)
    expect(groupTexts.some((t) => t?.includes('Tags: (none)'))).toBe(true)
  })

  it('uses a custom emptyValue label when provided', () => {
    createDataTable(container, {
      data: GAMES_WITH_EMPTY,
      columns: GAME_COLS,
      labels: { emptyValue: 'N/A' },
    })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const values = [
      ...container.querySelectorAll<HTMLInputElement>('[data-action="toggle-filter"]'),
    ].map((el) => el.dataset.value)
    expect(values).toContain('N/A')
  })
})
