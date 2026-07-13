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

function shiftClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }))
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

// jsdom has no DragEvent constructor; the handlers only read e.target and call
// preventDefault(), both of which a plain (cancelable) Event supports.
function dragEvt(type: string): Event {
  return new Event(type, { bubbles: true, cancelable: true })
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

  // --- column reordering ---

  it('renders headers as draggable with a data-col-key', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const th = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    expect(th.getAttribute('draggable')).toBe('true')
  })

  it('moving a column up in the columns dropdown reorders headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="move-col-up"][data-key="score"]')!)
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('moving a column down in the columns dropdown reorders headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="move-col-down"][data-key="name"]')!)
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('the up button on the first column is disabled', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    const btn = container.querySelector<HTMLButtonElement>(
      '[data-action="move-col-up"][data-key="name"]',
    )!
    expect(btn.disabled).toBe(true)
  })

  it('dragging a header and dropping it on another reorders columns', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const scoreTh = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    const nameTh = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    scoreTh.dispatchEvent(dragEvt('dragstart'))
    nameTh.dispatchEvent(dragEvt('dragover'))
    nameTh.dispatchEvent(dragEvt('drop'))
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('preserves order across visibility toggles', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const scoreTh = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    const nameTh = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    scoreTh.dispatchEvent(dragEvt('dragstart'))
    nameTh.dispatchEvent(dragEvt('dragover'))
    nameTh.dispatchEvent(dragEvt('drop'))
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-col"][data-key="dept"]')!)
    expect(colHeaders(container)).toEqual(['Score', 'Name'])
  })

  it('getViewState captures columnOrder and setViewState round-trips it', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    const scoreTh = container.querySelector<HTMLElement>('th[data-col-key="score"]')!
    const nameTh = container.querySelector<HTMLElement>('th[data-col-key="name"]')!
    scoreTh.dispatchEvent(dragEvt('dragstart'))
    nameTh.dispatchEvent(dragEvt('dragover'))
    nameTh.dispatchEvent(dragEvt('drop'))
    const view = table.getViewState()
    expect(view.columnOrder).toEqual(['score', 'name', 'dept'])
    table.setViewState({})
    expect(colHeaders(container)).toEqual(['Name', 'Score', 'Dept'])
    table.setViewState(view)
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
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

  it('checklist filter shows a row count next to each value', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="dept"]')!,
    )
    const engLabel = [...container.querySelectorAll('.dt-dd-item')].find((el) =>
      el.textContent?.includes('Eng'),
    )!
    expect(engLabel.querySelector('.dt-filter-count')?.textContent).toBe('2')
  })

  it("checklist filter counts are faceted by other columns' active filters", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="dept"]')!,
    )
    const engLabel = [...container.querySelectorAll('.dt-dd-item')].find((el) =>
      el.textContent?.includes('Eng'),
    )!
    expect(engLabel.querySelector('.dt-filter-count')?.textContent).toBe('1')
  })

  it('checklist filter hides a value with zero rows matching under other active filters', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="dept"]')!,
    )
    expect(
      [...container.querySelectorAll('.dt-dd-item')].some((el) => el.textContent?.includes('Eng')),
    ).toBe(true)
    expect(
      [...container.querySelectorAll('.dt-dd-item')].some((el) => el.textContent?.includes('HR')),
    ).toBe(false)
  })

  it('checklist filter keeps a selected value visible even when its live count drops to 0', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="dept"]')!,
    )
    // Select dept=HR (Bob, David) while it's still the only active filter, so it's visible to check.
    click(container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="HR"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    // A min-score range filter that excludes both HR rows (60, 70) zeroes HR's live facet count —
    // range filters, unlike a column's own checklist filter, are never excluded from a facet.
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="score"]')!,
      '75',
    )
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="dept"]')!,
    )
    const hrCheckbox = container.querySelector<HTMLInputElement>(
      '[data-action="toggle-filter"][data-value="HR"]',
    )!
    expect(hrCheckbox).not.toBeNull()
    expect(hrCheckbox.checked).toBe(true)
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

  it('filter dropdown shows the first filterable column selected by default', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    expect(
      container
        .querySelector('[data-action="select-filter-col"][data-key="name"]')
        ?.classList.contains('dt-filter-col-item--active'),
    ).toBe(true)
    expect(
      container.querySelector('[data-action="toggle-filter"][data-value="Alice"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-action="range-min"][data-key="score"]')).toBeNull()
  })

  it('clicking a column in the filter list switches the detail pane to that column', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    expect(container.querySelector('[data-action="range-min"][data-key="score"]')).not.toBeNull()
    expect(container.querySelector('[data-action="toggle-filter"][data-value="Alice"]')).toBeNull()
  })

  it('filter search narrows the checklist to matching values', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="filter-search"][data-key="name"]')!,
      'ali',
    )
    expect(
      container.querySelector('[data-action="toggle-filter"][data-value="Alice"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-action="toggle-filter"][data-value="Bob"]')).toBeNull()
  })

  it('select-all checkbox selects every currently listed value', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter-all"][data-key="name"]')!,
    )
    for (const name of ['Alice', 'Bob', 'Clara', 'David']) {
      expect(
        container.querySelector<HTMLInputElement>(
          `[data-action="toggle-filter"][data-value="${name}"]`,
        )!.checked,
      ).toBe(true)
    }
  })

  it('select-all checkbox deselects every value when all are already selected', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const selectAllCb = container.querySelector<HTMLElement>(
      '[data-action="toggle-filter-all"][data-key="name"]',
    )!
    click(selectAllCb)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter-all"][data-key="name"]')!,
    )
    for (const name of ['Alice', 'Bob', 'Clara', 'David']) {
      expect(
        container.querySelector<HTMLInputElement>(
          `[data-action="toggle-filter"][data-value="${name}"]`,
        )!.checked,
      ).toBe(false)
    }
  })

  it('shift-clicking a filter value selects the range from the last-clicked value', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    shiftClick(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Clara"]')!,
    )
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-filter"][data-value="Alice"]',
      )!.checked,
    ).toBe(true)
    expect(
      container.querySelector<HTMLInputElement>('[data-action="toggle-filter"][data-value="Bob"]')!
        .checked,
    ).toBe(true)
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-filter"][data-value="Clara"]',
      )!.checked,
    ).toBe(true)
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-filter"][data-value="David"]',
      )!.checked,
    ).toBe(false)
  })

  it('shift-clicking an already-selected filter value deselects the range', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter-all"][data-key="name"]')!,
    )
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    shiftClick(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Clara"]')!,
    )
    for (const name of ['Alice', 'Bob', 'Clara']) {
      expect(
        container.querySelector<HTMLInputElement>(
          `[data-action="toggle-filter"][data-value="${name}"]`,
        )!.checked,
      ).toBe(false)
    }
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-filter"][data-value="David"]',
      )!.checked,
    ).toBe(true)
  })

  it('select-all checkbox only affects the search-narrowed values, not the full list', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="filter-search"][data-key="name"]')!,
      'ali',
    )
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter-all"][data-key="name"]')!,
    )
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-filter"][data-value="Alice"]',
      )!.checked,
    ).toBe(true)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="filter-search"][data-key="name"]')!,
      '',
    )
    for (const name of ['Bob', 'Clara', 'David']) {
      expect(
        container.querySelector<HTMLInputElement>(
          `[data-action="toggle-filter"][data-value="${name}"]`,
        )!.checked,
      ).toBe(false)
    }
  })

  it('select-all checkbox is indeterminate when only some listed values are selected', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-filter-all"][data-key="name"]',
      )!.indeterminate,
    ).toBe(true)
  })

  it('hides the select-all checkbox when search matches no values', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="filter-search"][data-key="name"]')!,
      'zzz',
    )
    expect(container.querySelector('[data-action="toggle-filter-all"][data-key="name"]')).toBeNull()
    expect(container.querySelector('[data-action="filter-search"][data-key="name"]')).not.toBeNull()
  })

  // --- filter value sort ---

  function tagValues(): (string | undefined)[] {
    return [...container.querySelectorAll<HTMLInputElement>('[data-action="toggle-filter"]')].map(
      (el) => el.dataset.value,
    )
  }
  function clickValueSort(key: string): void {
    click(
      container.querySelector<HTMLElement>(`[data-action="toggle-value-sort"][data-key="${key}"]`)!,
    )
  }

  it('checklist values are sorted alphabetically ascending by default', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    expect(tagValues()).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('cycles to alphabetical descending on the first click', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    clickValueSort('tags')
    expect(tagValues()).toEqual(['RPG', 'Adventure', 'Action'])
  })

  it('cycles to count descending (tie-broken alphabetically) on the second click', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    clickValueSort('tags')
    clickValueSort('tags')
    // Action=2, Adventure=1, RPG=1 (tie broken alphabetically)
    expect(tagValues()).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('cycles to count ascending (tie-broken alphabetically) on the third click', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    clickValueSort('tags')
    clickValueSort('tags')
    clickValueSort('tags')
    // Adventure=1, RPG=1 (tie broken alphabetically), Action=2
    expect(tagValues()).toEqual(['Adventure', 'RPG', 'Action'])
  })

  it('cycles back to alphabetical ascending on the fourth click', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    clickValueSort('tags')
    clickValueSort('tags')
    clickValueSort('tags')
    clickValueSort('tags')
    expect(tagValues()).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('date tree years are chronologically ascending by default', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const years = [
      ...container.querySelectorAll<HTMLInputElement>('[data-action="toggle-date-node"]'),
    ].map((el) => el.dataset.path)
    expect(years).toEqual(['2021', '2023'])
  })

  it('toggles the date tree to chronologically descending', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    clickValueSort('released')
    const years = [
      ...container.querySelectorAll<HTMLInputElement>('[data-action="toggle-date-node"]'),
    ].map((el) => el.dataset.path)
    expect(years).toEqual(['2023', '2021'])
  })

  // --- range filter ---

  it('min range filter keeps only rows at or above the threshold', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="score"]')!,
      '80',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90) and Clara (80)
  })

  it('max range filter keeps only rows at or below the threshold', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-max"][data-key="score"]')!,
      '70',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Bob (60) and David (70)
  })

  // --- date filter tree ---

  interface GameRow {
    id: number
    name: string
    released: string
  }
  const DATE_COLS: ColumnDef<GameRow>[] = [
    { key: 'name', label: 'Name', filterable: false },
    { key: 'released', label: 'Released', type: 'date', filterable: true },
  ]
  const DATE_ROWS: GameRow[] = [
    { id: 1, name: 'Game A', released: '2023-05-14' },
    { id: 2, name: 'Game B', released: '2023-05-20' },
    { id: 3, name: 'Game C', released: '2021-01-02' },
  ]

  function openDateFilter(): void {
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
  }
  function dateNode(text: string): HTMLElement {
    return [...container.querySelectorAll<HTMLElement>('.dt-date-tree-item')].find((el) =>
      el.textContent?.includes(text),
    )!
  }
  // Day leaves have no `.dt-date-tree-toggle--branch` span (only year/month branches do), and
  // their rendered text has the hidden facet count glued on with no separator (e.g. day "20"
  // renders as "201"), so a plain substring match on a year like "2024" would also match "20" —
  // filtering to leaf rows first disambiguates cleanly.
  function dayNode(day: string): HTMLElement {
    return [...container.querySelectorAll<HTMLElement>('.dt-date-tree-item')].find(
      (el) => !el.querySelector('.dt-date-tree-toggle--branch') && el.textContent?.startsWith(day),
    )!
  }

  it('renders year nodes collapsed by default, with months hidden until expanded', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    expect(container.innerHTML).toContain('2023')
    expect(container.innerHTML).toContain('2021')
    expect(container.innerHTML).not.toContain('May')
  })

  it('expanding a year reveals its months, expanding a month reveals its days', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-expand"]')!)
    expect(container.innerHTML).toContain('May')
    click(dateNode('May').querySelector('[data-action="toggle-date-expand"]')!)
    expect(dateNode('14')).toBeTruthy()
    expect(dateNode('20')).toBeTruthy()
  })

  it('checking a year node selects every date under it and filters rows accordingly', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-node"]')!)
    expect(container.innerHTML).toContain('Game A')
    expect(container.innerHTML).toContain('Game B')
    expect(container.innerHTML).not.toContain('Game C')
  })

  it('unchecking an already fully-selected year deselects every date under it', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-node"]')!)
    click(dateNode('2023').querySelector('[data-action="toggle-date-node"]')!)
    expect(container.innerHTML).toContain('Game C')
  })

  it('is indeterminate on a month node when only some of its days are selected', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-expand"]')!)
    click(dateNode('May').querySelector('[data-action="toggle-date-expand"]')!)
    click(dateNode('14').querySelector('[data-action="toggle-date-node"]')!)
    const monthCheckbox = dateNode('May').querySelector<HTMLInputElement>(
      '[data-action="toggle-date-node"]',
    )!
    expect(monthCheckbox.indeterminate).toBe(true)
  })

  it('caps the active-filter chip at 3 values, summarizing the rest as "+N more"', () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-01-01' },
      { id: 2, name: 'Game B', released: '2023-02-01' },
      { id: 3, name: 'Game C', released: '2023-03-01' },
      { id: 4, name: 'Game D', released: '2023-04-01' },
    ]
    createDataTable(container, { data: rows, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-node"]')!)
    expect(container.querySelector('.dt-chip--filter')?.textContent).toContain(
      '2023-01-01, 2023-02-01, 2023-03-01, +1 more',
    )
  })

  it('shift-clicking two day nodes selects the range between them, not other years', () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2023-05-20' },
      { id: 3, name: 'Game C', released: '2021-01-02' },
      { id: 4, name: 'Game D', released: '2024-07-01' },
    ]
    createDataTable(container, { data: rows, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-expand"]')!)
    click(dateNode('May').querySelector('[data-action="toggle-date-expand"]')!)
    click(dayNode('14').querySelector('[data-action="toggle-date-node"]')!)
    shiftClick(dayNode('20').querySelector('[data-action="toggle-date-node"]')!)
    expect(container.innerHTML).toContain('Game A')
    expect(container.innerHTML).toContain('Game B')
    expect(container.innerHTML).not.toContain('Game C')
    expect(container.innerHTML).not.toContain('Game D')
  })

  it('shift-clicking from a year down to a specific day does not pull in a later sibling day', () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2023-05-20' },
      { id: 3, name: 'Game C', released: '2021-01-02' },
      { id: 4, name: 'Game D', released: '2024-07-01' },
    ]
    createDataTable(container, { data: rows, columns: DATE_COLS })
    openDateFilter()
    click(dateNode('2023').querySelector('[data-action="toggle-date-expand"]')!)
    click(dateNode('May').querySelector('[data-action="toggle-date-expand"]')!)
    click(dateNode('2021').querySelector('[data-action="toggle-date-node"]')!)
    shiftClick(dayNode('14').querySelector('[data-action="toggle-date-node"]')!)
    // The range is a chronological interval (2021-01-02 through 2023-05-14), not a sweep over
    // rendered rows — so day 20 (chronologically after the target) must stay excluded even
    // though the "2023" year row sits between the anchor and the target.
    expect(container.innerHTML).toContain('Game A')
    expect(container.innerHTML).toContain('Game C')
    expect(container.innerHTML).not.toContain('Game B')
    expect(container.innerHTML).not.toContain('Game D')
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

  it('shift-clicking a row selects the range from the last-clicked row', () => {
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
    shiftClick(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="2"]')!,
    )
    expect(onChange).toHaveBeenLastCalledWith([ROWS[0], ROWS[1], ROWS[2]])
  })

  it('shift-clicking an already-selected row deselects the range', () => {
    const onChange = vi.fn()
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      onSelectionChange: onChange,
    })
    click(container.querySelector<HTMLElement>('[data-action="select-all"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="0"]')!,
    )
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="0"]')!,
    )
    shiftClick(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="2"]')!,
    )
    expect(onChange).toHaveBeenLastCalledWith([ROWS[3]])
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

  // --- computed columns ---

  it('renders a cell value produced by col.value instead of row[key]', () => {
    const cols: ColumnDef<Row>[] = [
      ...COLS,
      { key: 'grade', label: 'Grade', value: (row: Row) => (row.score >= 70 ? 'Pass' : 'Fail') },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.textContent).toContain('Pass')
    expect(container.textContent).toContain('Fail')
  })

  it('groups by a computed column value', () => {
    const cols: ColumnDef<Row>[] = [
      ...COLS,
      {
        key: 'grade',
        label: 'Grade',
        groupable: true,
        value: (row: Row) => (row.score >= 80 ? 'A' : 'B'),
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="grade"]')!)
    const groupTexts = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(groupTexts.some((t) => t?.includes('Grade: A'))).toBe(true)
    expect(groupTexts.some((t) => t?.includes('Grade: B'))).toBe(true)
  })

  // --- view state ---

  it('getViewState omits fields still at their default', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    expect(table.getViewState()).toEqual({})
  })

  it('getViewState captures changes made through the UI', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(table.getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
      filters: { name: ['Alice'] },
    })
  })

  it('onViewChange fires with the new view when the UI changes it, but not on selection', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const cb = vi.fn()
    table.onViewChange(cb)
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith({ sorts: [{ key: 'score', dir: 'asc' }] })
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="0"]')!,
    )
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('onViewChange returns an unsubscribe function', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    const cb = vi.fn()
    const unsubscribe = table.onViewChange(cb)
    unsubscribe()
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    expect(cb).not.toHaveBeenCalled()
  })

  it('setViewState applies a snapshot and re-renders', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.setViewState({ sorts: [{ key: 'score', dir: 'desc' }], searchQuery: 'a' })
    expect(table.getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'desc' }],
      searchQuery: 'a',
    })
    expect(container.querySelector<HTMLInputElement>('.dt-search-input')!.value).toBe('a')
  })

  it('setViewState resets fields absent from the given view', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="toggle-sort"][data-key="score"]')!)
    table.setViewState({ page: 2 })
    expect(table.getViewState()).toEqual({ page: 2 })
  })

  it('setViewState falls back to default visible columns when given stale keys', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.setViewState({ visibleCols: ['nonexistent'] })
    expect(colHeaders(container)).toEqual(expect.arrayContaining(['Name', 'Score', 'Dept']))
  })
})
