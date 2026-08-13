import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDataTable, bucketNumericRange, formatNumericRange } from '../index'
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

// Same as dragEvt, but carrying a clientY — needed for tests that exercise the
// before/after-target resolution, which jsdom's layout-less getBoundingClientRect()
// (all zeros by default) requires stubbing out per element alongside this.
function dragEvtAt(type: string, clientY: number): Event {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientY })
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

  it('mounts the DOM node returned by render into the cell', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'score',
        label: 'Score',
        render: (v, row) => {
          const span = document.createElement('span')
          span.className = 'custom-score'
          span.textContent = `${row.name}: ${v}`
          return span
        },
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    const nodes = container.querySelectorAll('.custom-score')
    expect(nodes).toHaveLength(ROWS.length)
    expect(nodes[0].textContent).toBe('Alice: 90')
    // No leftover placeholder spans once every node is mounted
    expect(container.querySelector('[data-render-slot]')).toBeNull()
  })

  it('render takes priority over format on the same column', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'score',
        label: 'Score',
        format: (v) => `${v} pts`,
        render: (v) => {
          const span = document.createElement('span')
          span.textContent = `rendered:${v}`
          return span
        },
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('rendered:90')
    expect(container.innerHTML).not.toContain('90 pts')
  })

  it('applies render to group header and aggregate cells', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'dept',
        label: 'Dept',
        groupable: true,
        render: (v) => {
          const b = document.createElement('b')
          b.textContent = `[${v}]`
          return b
        },
      },
      {
        key: 'score',
        label: 'Score',
        aggregate: 'sum',
        render: (v) => {
          const em = document.createElement('em')
          em.textContent = `sum=${v}`
          return em
        },
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    // dept starts hidden here (no explicit groupBy toggle in this test setup),
    // so instead assert via the toggle-group action to activate grouping.
    const dropdownBtn = container.querySelector<HTMLElement>('[data-dd="group"]')!
    click(dropdownBtn)
    const groupItem = container.querySelector<HTMLElement>('[data-action="toggle-group"]')!
    click(groupItem)
    expect(container.querySelector('.dt-group-td b')?.textContent).toMatch(/^\[(Eng|HR)\]$/)
    expect(container.querySelector('.dt-agg-td em')?.textContent).toMatch(/^sum=\d+$/)
  })

  it('buckets a group by groupValue and renders the bucket label via groupFormat', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'score',
        label: 'Score',
        type: 'number',
        groupable: true,
        groupValue: bucketNumericRange(20),
        groupFormat: formatNumericRange(20, '%'),
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"]')!)
    // scores 90, 60, 80, 70 -> buckets 80–100%, 60–80%, 80–100%, 60–80%
    const headers = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(headers.some((h) => h?.includes('80–100%'))).toBe(true)
    expect(headers.some((h) => h?.includes('60–80%'))).toBe(true)
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

  // --- toolbar / active state bar ---

  it('renders the active bar with just the row-count stats when nothing is active', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const bar = container.querySelector<HTMLElement>('.dt-active-bar')!
    expect(bar).not.toBeNull()
    expect(bar.querySelector('.dt-chip')).toBeNull()
    expect(bar.querySelector('.dt-stats')?.textContent).toContain('4 / 4 rows')
  })

  it('separates the shape controls (Columns/Sort/Group) from the find controls (Search/Filter) with a divider', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const actions = container.querySelector<HTMLElement>('.dt-toolbar-actions')!
    const children = [...actions.children]
    const dividerIdx = children.findIndex((el) => el.classList.contains('dt-toolbar-divider'))
    const searchIdx = children.findIndex((el) => el.querySelector('.dt-search-input'))
    const groupIdx = children.findIndex((el) =>
      el.querySelector('[data-action="toggle-dd"][data-dd="group"]'),
    )
    const filterIdx = children.findIndex((el) =>
      el.querySelector('[data-action="toggle-dd"][data-dd="filter"]'),
    )
    expect(dividerIdx).toBeGreaterThan(-1)
    expect(groupIdx).toBeLessThan(dividerIdx) // Group is a "shape" control, before the divider
    expect(searchIdx).toBeGreaterThan(dividerIdx) // Search is a "find" control, after it
    expect(filterIdx).toBeGreaterThan(dividerIdx)
  })

  it('shows sort, group, and filter chips together in the active bar, each removable on its own', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )

    const chips = [...container.querySelectorAll<HTMLElement>('.dt-active-bar .dt-chip')]
    expect(chips).toHaveLength(3)
    expect(chips.some((c) => c.textContent?.includes('Score'))).toBe(true)
    expect(
      chips.some(
        (c) => c.textContent?.includes('Dept') && !c.classList.contains('dt-chip--filter'),
      ),
    ).toBe(true)
    expect(chips.some((c) => c.classList.contains('dt-chip--filter'))).toBe(true)
  })

  it('the "Clear all" button sits at the end of the toolbar actions row, not the search area', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    const clearAll = container.querySelector<HTMLElement>('[data-action="clear-all"]')!
    expect(clearAll.closest('.dt-toolbar-actions')).not.toBeNull()
    expect(clearAll.classList.contains('dt-clear-all')).toBe(true)
  })

  // --- sorting ---

  it('clicking a column header sorts rows ascending', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90
  })

  it('clicking a sorted column reverses to descending', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60
  })

  it('clicking a third time clears the sort', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    const scoreHeader = () =>
      container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!
    click(scoreHeader())
    click(scoreHeader())
    click(scoreHeader())
    expect(table.getViewState().sorts ?? []).toEqual([])
  })

  it('plain-clicking a different header replaces the sort instead of appending to it', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    expect(table.getViewState().sorts).toEqual([{ key: 'score', dir: 'asc' }])
  })

  it('shift-clicking a header appends it to the existing sort instead of replacing it', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="name"]')!)
    shiftClick(
      container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!,
    )
    expect(table.getViewState().sorts).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'score', dir: 'asc' },
    ])
  })

  it('shift-clicking an already-sorted column flips its direction in place, without removing it', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="name"]')!)
    shiftClick(
      container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!,
    )
    const scoreHeader = () =>
      container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!
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
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    const icon = container.querySelector<HTMLElement>(
      'th[data-action="header-sort"][data-key="score"] .dt-sort-icon',
    )!
    expect(icon.textContent).toBe('↑')
  })

  it('shows an index number on each header once more than one column is sorted', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="name"]')!)
    shiftClick(
      container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!,
    )
    const nameIcon = container.querySelector<HTMLElement>(
      'th[data-action="header-sort"][data-key="name"] .dt-sort-icon',
    )!
    const scoreIcon = container.querySelector<HTMLElement>(
      'th[data-action="header-sort"][data-key="score"] .dt-sort-icon',
    )!
    expect(nameIcon.textContent).toBe('1↑')
    expect(scoreIcon.textContent).toBe('2↑')
  })

  it('a sort on a grouped-out column is not numbered and does not shift visible headers’ numbers', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    // dept is grouped, so it has no header of its own; its sort entry (used to order the groups)
    // stays in `sorts` regardless. Append score's sort (shift-click) rather than a plain click,
    // which would otherwise reset `sorts` to score alone and not exercise the case at all.
    table.setViewState({ sorts: [{ key: 'dept', dir: 'asc' }], groupBy: ['dept'] })
    shiftClick(
      container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!,
    )
    expect(table.getViewState().sorts).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'score', dir: 'asc' },
    ])
    const scoreIcon = container.querySelector<HTMLElement>(
      'th[data-action="header-sort"][data-key="score"] .dt-sort-icon',
    )!
    // Only one *visible* header is sorted (score) — dept's entry is invisible, so no number at
    // all, not "2" (which would imply a missing "1" somewhere).
    expect(scoreIcon.textContent).toBe('↑')
  })

  it('active sort has no count badge on the Sort button, but shows a chip in the active bar', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    expect(
      container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"] .dt-chip'),
    ).toBeNull()
    const chip = container.querySelector<HTMLElement>('.dt-active-bar .dt-chip')!
    expect(chip.textContent).toContain('Score')
    click(chip.querySelector<HTMLElement>('[data-action="remove-sort"]')!)
    expect(container.querySelector('.dt-active-bar .dt-chip')).toBeNull()
  })

  // --- sort dropdown (active/add split, direction, remove, reorder) ---

  it('lists a not-yet-sorted column under the add section, clicking it adds it ascending', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    expect(
      container.querySelector('[data-action="toggle-sort-dir"][data-key="score"]'),
    ).not.toBeNull()
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90 — ascending
  })

  it('the add-sort row is a real <button>, reachable by Tab and activatable with Enter/Space', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    const addRow = container.querySelector<HTMLButtonElement>(
      '[data-action="toggle-sort"][data-key="score"]',
    )!
    expect(addRow.tagName).toBe('BUTTON')
    expect(addRow.tabIndex).toBe(0)
    // A native <button> fires its own click on Enter/Space with no listener of our own needed —
    // dispatching a real click is enough to prove that (a keydown-only handler, like the active
    // sort rows use, would need its own test; here the browser does the work).
    click(addRow)
    expect(
      container.querySelector('[data-action="toggle-sort-dir"][data-key="score"]'),
    ).not.toBeNull()
  })

  it('toggle-sort-dir flips an active sort between ascending and descending', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-sort-dir"][data-key="score"]')!,
    )
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60 — descending
  })

  it('remove-sort clears the sort and moves the column back to the add section', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('[data-action="remove-sort"][data-key="score"]')!)
    expect(container.querySelector('[data-action="toggle-sort-dir"][data-key="score"]')).toBeNull()
    expect(container.querySelector('[data-action="toggle-sort"][data-key="score"]')).not.toBeNull()
  })

  it('the Sort toolbar button has no clear-sorts button until a sort is active', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('[data-action="clear-sorts"]')).toBeNull()
  })

  it('clear-sorts on the toolbar clears all sorts without opening the dropdown', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!) // close it

    click(container.querySelector<HTMLElement>('[data-action="clear-sorts"]')!)
    expect(container.querySelector('.dt-dd')).toBeNull() // still closed, not reopened by the click
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Bob', 'Clara', 'David']) // original order, no longer sorted
  })

  it('active sort rows are draggable and reorder priority on drop', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    expect(nameRow.getAttribute('draggable')).toBe('true')
    scoreRow.dispatchEvent(dragEvt('dragstart'))
    nameRow.dispatchEvent(dragEvt('dragover'))
    nameRow.dispatchEvent(dragEvt('drop'))
    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Name'])
  })

  it('dropping past the last active sort row moves the dragged row to the end', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="dept"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-sort-key="dept"]')!
    deptRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = container.querySelector<HTMLElement>('.dt-dd')!

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // Pointer is well below the last active row (dept), over dead space (blank space in the
    // dropdown panel below the last row) that carries no data-sort-key of its own — this used
    // to silently reject the drop entirely.
    panel.dispatchEvent(dragEvtAt('dragover', 100))
    panel.dispatchEvent(dragEvtAt('drop', 100))

    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Dept', 'Name'])
  })

  it('dropping on the bottom half of the last active sort row moves the dragged row after it', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // clientY 35 falls in scoreRow's bottom half (30–40) — should insert name *after* score,
    // not before it (which "insert before" alone could never express for the last row).
    scoreRow.dispatchEvent(dragEvtAt('dragover', 35))
    scoreRow.dispatchEvent(dragEvtAt('drop', 35))

    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Name'])
  })

  it('Alt+ArrowUp/Alt+ArrowDown on a focused sort row reorders priority', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    )
    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score', 'Name'])
  })

  it('Alt+ArrowUp on the first sort row is a no-op', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    nameRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    )
    const labels = [...container.querySelectorAll('.dt-dd-item--sortrow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Name', 'Score'])
  })

  it('Enter on a focused sort row toggles its direction, same as a click', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="sort"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-sort"][data-key="score"]')!)
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const names = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(names).toEqual(['Alice', 'Clara', 'David', 'Bob']) // 90, 80, 70, 60 — descending
  })

  // --- scroll restore ---

  it('preserves table scroll position across a re-render triggered by a click', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop = 42
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    expect(container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop).toBe(42)
    table.destroy()
  })

  it('preserves table scroll position across a re-render triggered by setData', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop = 42
    table.setData([...ROWS, { id: 5, name: 'Eve', score: 55, dept: 'Eng' }])
    expect(container.querySelector<HTMLElement>('.dt-table-wrap')!.scrollTop).toBe(42)
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

  it('columns dropdown rows are draggable and reorder headers on drop', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-col-row-key="score"]')!
    expect(scoreRow.getAttribute('draggable')).toBe('true')
    scoreRow.dispatchEvent(dragEvt('dragstart'))
    nameRow.dispatchEvent(dragEvt('dragover'))
    nameRow.dispatchEvent(dragEvt('drop'))
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('Alt+ArrowUp/Alt+ArrowDown on a focused column checkbox reorders headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    const scoreCheckbox = container.querySelector<HTMLElement>(
      '[data-col-row-key="score"] input[type="checkbox"]',
    )!
    scoreCheckbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    )
    expect(colHeaders(container)).toEqual(['Score', 'Name', 'Dept'])
  })

  it('Alt+ArrowUp on the first column row is a no-op', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    const nameCheckbox = container.querySelector<HTMLElement>(
      '[data-col-row-key="name"] input[type="checkbox"]',
    )!
    nameCheckbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    )
    expect(colHeaders(container)).toEqual(['Name', 'Score', 'Dept'])
  })

  it('dropping past the last column row moves the dragged row to the end', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-col-row-key="dept"]')!
    deptRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = container.querySelector<HTMLElement>('.dt-dd')!

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // Pointer is well below the last column row (dept), over dead space (blank space in the
    // dropdown panel below the last row) that carries no data-col-row-key of its own — this
    // used to silently reject the drop entirely.
    panel.dispatchEvent(dragEvtAt('dragover', 100))
    panel.dispatchEvent(dragEvtAt('drop', 100))

    expect(colHeaders(container)).toEqual(['Score', 'Dept', 'Name'])
  })

  it('dropping on the bottom half of the last column row moves the dragged row after it', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="cols"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-col-row-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-col-row-key="dept"]')!
    deptRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // clientY 35 falls in deptRow's bottom half (30–40) — should insert name *after* dept,
    // not before it (which "insert before" alone could never express for the last row).
    deptRow.dispatchEvent(dragEvtAt('dragover', 35))
    deptRow.dispatchEvent(dragEvtAt('drop', 35))

    expect(colHeaders(container)).toEqual(['Score', 'Dept', 'Name'])
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

  it('the filter column-selector row is a real <button>, reachable by Tab and activatable with Enter/Space', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const deptItem = container.querySelector<HTMLButtonElement>(
      '[data-action="select-filter-col"][data-key="dept"]',
    )!
    expect(deptItem.tagName).toBe('BUTTON')
    expect(deptItem.tabIndex).toBe(0)
    click(deptItem)
    const deptItemAfter = container.querySelector<HTMLButtonElement>(
      '[data-action="select-filter-col"][data-key="dept"]',
    )!
    expect(deptItemAfter.className).toContain('dt-filter-col-item--active')
  })

  it('checklist filter shows only matching rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Alice')
  })

  it('the Filter toolbar button has no clear-filters button until a filter is active', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('[data-action="clear-filters"]')).toBeNull()
  })

  it('clear-filters on the toolbar clears all filters without opening the dropdown', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-filter"][data-value="Alice"]')!,
    )
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!) // close it

    click(container.querySelector<HTMLElement>('[data-action="clear-filters"]')!)
    expect(container.querySelector('.dt-dd')).toBeNull() // still closed, not reopened by the click
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
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

  it("renders a range slider with bounds matching the numeric column's actual min/max", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    const thumbs = [...container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')]
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0].min).toBe('60')
    expect(thumbs[0].max).toBe('90')
    expect(thumbs[0].value).toBe('60')
    expect(thumbs[1].value).toBe('90')
  })

  it('dragging a slider thumb does not filter rows until the drag commits on "change"', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    const low = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')[0]
    low.value = '75'
    low.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4) // not committed yet
    low.dispatchEvent(new Event('change', { bubbles: true }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90), Clara (80)
  })

  it('committing a slider drag also updates the plain min/max inputs, sorted low/high', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    // Drag the "high" thumb down past the middle — the actual min/max is Math.min/max of both
    // live thumb values regardless of which thumb nominally moved.
    const high = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')[1]
    high.value = '75'
    high.dispatchEvent(new Event('input', { bubbles: true }))
    high.dispatchEvent(new Event('change', { bubbles: true }))
    const minInput = container.querySelector<HTMLInputElement>(
      '[data-action="range-min"][data-key="score"]',
    )!
    const maxInput = container.querySelector<HTMLInputElement>(
      '[data-action="range-max"][data-key="score"]',
    )!
    expect(minInput.value).toBe('60')
    expect(maxInput.value).toBe('75')
  })

  it('updates the plain min/max inputs live while dragging, before the drag commits', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    const low = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')[0]
    low.value = '75'
    low.dispatchEvent(new Event('input', { bubbles: true }))
    const minInput = container.querySelector<HTMLInputElement>(
      '[data-action="range-min"][data-key="score"]',
    )!
    expect(minInput.value).toBe('75') // live, before "change" ever fires
  })

  it('marks the column with a dot and an active-bar chip once a range filter is set', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="score"]')!,
      '80',
    )
    const scoreColItem = container.querySelector<HTMLElement>(
      '[data-action="select-filter-col"][data-key="score"]',
    )!
    expect(scoreColItem.querySelector('.dt-filter-col-dot')).toBeTruthy()
    const chip = container.querySelector('.dt-chip--filter')!
    expect(chip.textContent).toContain('Score')
    expect(chip.textContent).toContain('80')
  })

  it("clicking a range filter's active-bar chip clears it and unfilters the rows", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(
      container.querySelector<HTMLElement>('[data-action="select-filter-col"][data-key="score"]')!,
    )
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="score"]')!,
      '80',
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90), Clara (80)
    click(container.querySelector<HTMLElement>('.dt-chip--filter .dt-chip-x')!)
    expect(container.querySelector('.dt-chip--filter')).toBeNull()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
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

  // --- date range filter ---

  it('renders 2 native date inputs above the tree for a date column', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    const minInput = container.querySelector<HTMLInputElement>(
      '[data-action="range-min"][data-key="released"]',
    )!
    const maxInput = container.querySelector<HTMLInputElement>(
      '[data-action="range-max"][data-key="released"]',
    )!
    expect(minInput.type).toBe('date')
    expect(maxInput.type).toBe('date')
  })

  it('a date range narrows the tree itself and filters rows, without needing a checkbox ticked', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="released"]')!,
      '2022-01-01',
    )
    // The 2021 year (Game C) drops out of the tree entirely — narrowed like a search term, not
    // merely ANDed onto the final result once a checkbox is ticked.
    expect(container.innerHTML).not.toContain('2021')
    expect(container.innerHTML).toContain('2023')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Game A, Game B (2023)
  })

  it("a date range slider has epoch-based bounds matching the column's actual min/max date", () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    const thumbs = [...container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')]
    expect(thumbs).toHaveLength(2)
    expect(Number(thumbs[0].min)).toBe(new Date('2021-01-02').getTime())
    expect(Number(thumbs[0].max)).toBe(new Date('2023-05-20').getTime())
  })

  it('marks the date column with a dot and an active-bar chip once a range filter is set, with no checkbox ticked', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="released"]')!,
      '2022-01-01',
    )
    const releasedColItem = container.querySelector<HTMLElement>(
      '[data-action="select-filter-col"][data-key="released"]',
    )!
    expect(releasedColItem.querySelector('.dt-filter-col-dot')).toBeTruthy()
    const chip = container.querySelector('.dt-chip--filter')!
    expect(chip.textContent).toContain('Released')
    expect(chip.textContent).toContain('2022-01-01')
  })

  it("clicking a date range filter's active-bar chip clears it, restoring the full tree and rows", () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    setInput(
      container.querySelector<HTMLInputElement>('[data-action="range-min"][data-key="released"]')!,
      '2022-01-01',
    )
    click(container.querySelector<HTMLElement>('.dt-chip--filter .dt-chip-x')!)
    expect(container.querySelector('.dt-chip--filter')).toBeNull()
    expect(container.innerHTML).toContain('2021')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
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

  it('the rows-per-page dropdown includes and selects a custom defaultPageSize not among the defaults', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    const select = container.querySelector<HTMLSelectElement>('.dt-page-select')!
    expect([...select.options].map((o) => o.value)).toEqual(['2', '10', '20', '50', '100'])
    expect(select.value).toBe('2')
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

  it('clicking a row closes an open toolbar dropdown', () => {
    createDataTable(container, { data: ROWS, columns: COLS, onRowClick: vi.fn() })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    expect(container.querySelector('.dt-dd')).not.toBeNull()
    click(container.querySelector<HTMLElement>('[data-action="row-click"][data-proc-idx="0"]')!)
    expect(container.querySelector('.dt-dd')).toBeNull()
  })

  it('clicking a row closes an open dropdown even when onRowClick is not set', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    expect(container.querySelector('.dt-dd')).not.toBeNull()
    click(container.querySelector<HTMLElement>('[data-action="row-click"][data-proc-idx="0"]')!)
    expect(container.querySelector('.dt-dd')).toBeNull()
  })

  // --- keyboard navigation ---

  function dataRows(el: HTMLElement): HTMLElement[] {
    return [...el.querySelectorAll<HTMLElement>('.dt-tr[data-proc-idx]')]
  }

  function keydown(
    el: Element,
    key: string,
    opts: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
  ): void {
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }),
    )
  }

  it('does not add a tabindex to rows when neither selectable nor onRowClick is set', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    for (const row of dataRows(container)) expect(row.getAttribute('tabindex')).toBeNull()
  })

  it('makes the first row the sole tab stop by default, the rest tabindex -1', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const [first, ...rest] = dataRows(container)
    expect(first.getAttribute('tabindex')).toBe('0')
    for (const row of rest) expect(row.getAttribute('tabindex')).toBe('-1')
  })

  it('excludes the row checkbox from the tab sequence', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const checkbox = container.querySelector('[data-action="toggle-row-select"]')!
    expect(checkbox.getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowDown moves the roving tabindex to the next row and keeps DOM focus on it', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'ArrowDown')
    const [newFirst, second] = dataRows(container)
    expect(newFirst.getAttribute('tabindex')).toBe('-1')
    expect(second.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(second)
  })

  it('ArrowUp on the first row is a no-op (clamped at the boundary)', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'ArrowUp')
    expect(dataRows(container)[0].getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(dataRows(container)[0])
  })

  it('End moves the roving tabindex to the last row', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'End')
    const rows = dataRows(container)
    const last = rows[rows.length - 1]
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
  })

  it('Space toggles selection on the focused row', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, ' ')
    const checkbox = () =>
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-row-select"][data-proc-idx="0"]',
      )!
    expect(checkbox().checked).toBe(true)
    keydown(dataRows(container)[0], ' ')
    expect(checkbox().checked).toBe(false)
  })

  it('Shift+ArrowDown extends the selection range like a shift-click would', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="0"]')!,
    ) // selects Alice, sets the anchor
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'ArrowDown', { shiftKey: true })
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-row-select"][data-proc-idx="0"]',
      )!.checked,
    ).toBe(true)
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-action="toggle-row-select"][data-proc-idx="1"]',
      )!.checked,
    ).toBe(true)
    expect(document.activeElement).toBe(dataRows(container)[1])
  })

  it('Enter fires onRowClick with the row and the keyboard event', () => {
    const onRowClick = vi.fn()
    createDataTable(container, { data: ROWS, columns: COLS, onRowClick })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'Enter')
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0], expect.any(KeyboardEvent))
  })

  it('Enter does nothing when onRowClick is not set', () => {
    createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const [first] = dataRows(container)
    first.focus()
    expect(() => keydown(first, 'Enter')).not.toThrow()
  })

  // --- keyboard navigation across pages ---

  const ROWS6: Row[] = [
    { id: 1, name: 'Alice', score: 90, dept: 'Eng' },
    { id: 2, name: 'Bob', score: 60, dept: 'HR' },
    { id: 3, name: 'Clara', score: 80, dept: 'Eng' },
    { id: 4, name: 'Dave', score: 70, dept: 'HR' },
    { id: 5, name: 'Eve', score: 50, dept: 'Eng' },
    { id: 6, name: 'Frank', score: 40, dept: 'HR' },
  ]

  it('ArrowDown on the last row of a page moves to the first row of the next page', () => {
    createDataTable(container, {
      data: ROWS6,
      columns: COLS,
      selectable: true,
      defaultPageSize: 2,
    })
    const [, last] = dataRows(container)
    last.focus()
    keydown(last, 'ArrowDown')
    const newFirst = dataRows(container)[0]
    expect(newFirst.textContent).toContain('Clara')
    expect(newFirst.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(newFirst)
  })

  it('ArrowUp on the first row of a page moves to the last row of the previous page', () => {
    createDataTable(container, {
      data: ROWS6,
      columns: COLS,
      selectable: true,
      defaultPageSize: 2,
    })
    click(container.querySelector<HTMLElement>('[data-action="page-next"]')!)
    const [first] = dataRows(container)
    expect(first.textContent).toContain('Clara')
    first.focus()
    keydown(first, 'ArrowUp')
    const rows = dataRows(container)
    const last = rows[rows.length - 1]
    expect(last.textContent).toContain('Bob')
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
  })

  it('Ctrl+End jumps to the true last row across all pages', () => {
    createDataTable(container, {
      data: ROWS6,
      columns: COLS,
      selectable: true,
      defaultPageSize: 2,
    })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'End', { ctrlKey: true })
    const rows = dataRows(container)
    const last = rows[rows.length - 1]
    expect(last.textContent).toContain('Frank')
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
  })

  it('Ctrl+Home jumps to the true first row across all pages', () => {
    createDataTable(container, {
      data: ROWS6,
      columns: COLS,
      selectable: true,
      defaultPageSize: 2,
    })
    const [first] = dataRows(container)
    first.focus()
    keydown(first, 'End', { ctrlKey: true })
    const focused = document.activeElement as HTMLElement
    keydown(focused, 'Home', { ctrlKey: true })
    const newFirst = dataRows(container)[0]
    expect(newFirst.textContent).toContain('Alice')
    expect(newFirst.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(newFirst)
  })

  it('Shift+ArrowDown across a page boundary extends the selection onto the next page', () => {
    createDataTable(container, {
      data: ROWS6,
      columns: COLS,
      selectable: true,
      defaultPageSize: 2,
    })
    click(
      container.querySelector<HTMLElement>('[data-action="toggle-row-select"][data-proc-idx="1"]')!,
    ) // selects Bob, sets the anchor
    // click() above re-renders (replaces the DOM), so re-query for a fresh reference to Bob's row
    // before focusing/dispatching the next keydown, rather than reusing a now-detached node.
    const last = dataRows(container)[1]
    last.focus()
    keydown(last, 'ArrowDown', { shiftKey: true })
    const newFirst = dataRows(container)[0]
    const newFirstCheckbox = newFirst.querySelector<HTMLInputElement>(
      '[data-action="toggle-row-select"]',
    )!
    expect(newFirstCheckbox.checked).toBe(true)
    expect(document.activeElement).toBe(newFirst)
  })

  // --- keyboard navigation with grouping ---

  function groupHeaderRows(el: HTMLElement): HTMLElement[] {
    return [...el.querySelectorAll<HTMLElement>('.dt-group-row[data-gkey]')]
  }

  function groupByDept(): void {
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
  }

  it('makes every group header row a Tab stop, one at a time', () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    const headers = groupHeaderRows(container)
    expect(headers).toHaveLength(2)
    expect(headers[0].getAttribute('tabindex')).toBe('0')
    expect(headers[1].getAttribute('tabindex')).toBe('-1')
  })

  it("ArrowDown walks through a group's rows and on to the next group header", () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    keydown(firstHeader, 'ArrowDown') // -> Alice
    keydown(document.activeElement!, 'ArrowDown') // -> Clara
    keydown(document.activeElement!, 'ArrowDown') // -> HR header
    expect(document.activeElement).toBe(groupHeaderRows(container)[1])
  })

  it('Enter toggles collapse on a focused group header, regardless of selectable/onRowClick', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultGroupsCollapsed: false })
    groupByDept()
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    keydown(firstHeader, 'Enter')
    expect(container.textContent).not.toContain('Alice')
    keydown(document.activeElement!, 'Enter')
    expect(container.textContent).toContain('Alice')
  })

  it("Space toggles the group's own select-all checkbox on a focused group header", () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    keydown(firstHeader, ' ')
    const checkbox = groupHeaderRows(container)[0].querySelector<HTMLInputElement>(
      '[data-action="toggle-group-select"]',
    )!
    expect(checkbox.checked).toBe(true)
  })

  it('Ctrl+End from a group header jumps to the true last row across all groups', () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    keydown(firstHeader, 'End', { ctrlKey: true })
    expect(document.activeElement?.textContent).toContain('David')
  })

  it("a collapsed group's header stays reachable and its rows are skipped", () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      selectable: true,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    keydown(firstHeader, 'Enter') // collapse Eng
    keydown(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(groupHeaderRows(container)[1])
  })

  // --- grouping ---

  it('renders group header rows when a column is grouped', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelector('.dt-group-row')).not.toBeNull()
  })

  it('the add-group row is a real <button>, reachable by Tab and activatable with Enter/Space', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    const addRow = container.querySelector<HTMLButtonElement>(
      '[data-action="toggle-group"][data-key="dept"]',
    )!
    expect(addRow.tagName).toBe('BUTTON')
    expect(addRow.tabIndex).toBe(0)
    click(addRow)
    expect(container.querySelector('.dt-group-row')).not.toBeNull()
  })

  it('grouped column disappears from table headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(colHeaders(container)).not.toContain('Dept')
  })

  it('collapsing a group hides its data rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultGroupsCollapsed: false })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const before = container.querySelectorAll('.dt-tr').length
    click(container.querySelector<HTMLElement>('.dt-group-row')!)
    expect(container.querySelectorAll('.dt-tr').length).toBeLessThan(before)
  })

  it('starts groups collapsed by default, and clicking a header expands it', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelectorAll('.dt-tr').length).toBe(0)
    click(container.querySelector<HTMLElement>('.dt-group-row')!)
    expect(container.querySelectorAll('.dt-tr').length).toBeGreaterThan(0)
  })

  it('defaultGroupsCollapsed: false starts groups expanded', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultGroupsCollapsed: false })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(container.querySelectorAll('.dt-tr').length).toBeGreaterThan(0)
  })

  // --- group dropdown (active/add split, remove, reorder) ---

  it('active group has no count badge on the Group button, but shows a chip in the active bar', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    expect(
      container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"] .dt-chip'),
    ).toBeNull()
    const chip = container.querySelector<HTMLElement>('.dt-active-bar .dt-chip')!
    expect(chip.textContent).toContain('Dept')
    click(chip.querySelector<HTMLElement>('[data-action="remove-group"]')!)
    expect(container.querySelector('.dt-active-bar .dt-chip')).toBeNull()
  })

  it('remove-group clears the group and moves the column back to the add section', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    click(container.querySelector<HTMLElement>('[data-action="remove-group"][data-key="dept"]')!)
    expect(container.querySelector('[data-action="remove-group"][data-key="dept"]')).toBeNull()
    expect(container.querySelector('[data-action="toggle-group"][data-key="dept"]')).not.toBeNull()
    expect(colHeaders(container)).toContain('Dept')
  })

  it('the Group toolbar button has no clear-groups button until a group is active', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('[data-action="clear-groups"]')).toBeNull()
  })

  it('clear-groups on the toolbar clears all groups without opening the dropdown', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!) // close it

    click(container.querySelector<HTMLElement>('[data-action="clear-groups"]')!)
    expect(container.querySelector('.dt-dd')).toBeNull() // still closed, not reopened by the click
    expect(colHeaders(container)).toContain('Dept')
  })

  it('active group rows are draggable and reorder priority on drop', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-group-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-group-key="dept"]')!
    expect(nameRow.getAttribute('draggable')).toBe('true')
    deptRow.dispatchEvent(dragEvt('dragstart'))
    nameRow.dispatchEvent(dragEvt('dragover'))
    nameRow.dispatchEvent(dragEvt('drop'))
    const labels = [...container.querySelectorAll('.dt-dd-item--grouprow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Dept', 'Name'])
  })

  it('dropping past the last active group row moves the dragged row to the end', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'dept', label: 'Dept', groupable: true },
      { key: 'score', label: 'Score', type: 'number', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="score"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-group-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-group-key="score"]')!
    scoreRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = container.querySelector<HTMLElement>('.dt-dd')!

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // Pointer is well below the last active row (score), over dead space (blank space in the
    // dropdown panel below the last row) that carries no data-group-key of its own — this used
    // to silently reject the drop entirely.
    panel.dispatchEvent(dragEvtAt('dragover', 100))
    panel.dispatchEvent(dragEvtAt('drop', 100))

    const labels = [...container.querySelectorAll('.dt-dd-item--grouprow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Dept', 'Score', 'Name'])
  })

  it('dropping on the bottom half of the last active group row moves the dragged row after it', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-group-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-group-key="dept"]')!
    deptRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // clientY 35 falls in deptRow's bottom half (30–40) — should insert name *after* dept,
    // not before it (which "insert before" alone could never express for the last row).
    deptRow.dispatchEvent(dragEvtAt('dragover', 35))
    deptRow.dispatchEvent(dragEvtAt('drop', 35))

    const labels = [...container.querySelectorAll('.dt-dd-item--grouprow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Dept', 'Name'])
  })

  it('Alt+ArrowUp/Alt+ArrowDown on a focused group row reorders priority', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const deptRow = container.querySelector<HTMLElement>('[data-group-key="dept"]')!
    deptRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    )
    const labels = [...container.querySelectorAll('.dt-dd-item--grouprow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Dept', 'Name'])
  })

  it('Alt+ArrowUp on the first group row is a no-op', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="group"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="name"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-group"][data-key="dept"]')!)
    const nameRow = container.querySelector<HTMLElement>('[data-group-key="name"]')!
    nameRow.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    )
    const labels = [...container.querySelectorAll('.dt-dd-item--grouprow .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Name', 'Dept'])
  })

  // --- pagination with grouping ---
  // ROWS groups as Eng:[Alice, Clara], HR:[Bob, David] (first-seen order) => visible items are
  // [header Eng, Alice, Clara, header HR, Bob, David], 6 items total.

  it('counts header rows toward the page budget, so a page never renders more than pageSize rows', () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      defaultPageSize: 2,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    // pageSize 2 => page 1 is [header Eng, Alice]: 1 header row + 1 data row
    expect(groupHeaderRows(container)).toHaveLength(1)
    expect(container.querySelectorAll('.dt-tr')).toHaveLength(1)
    expect(container.textContent).toContain('Alice')
    expect(container.textContent).not.toContain('Clara')
  })

  it("repeats a split group's header, marked as continued, on the page its rows continue onto", () => {
    createDataTable(container, {
      data: ROWS,
      columns: COLS,
      defaultPageSize: 2,
      defaultGroupsCollapsed: false,
    })
    groupByDept()
    click(container.querySelector<HTMLElement>('[data-action="page-next"]')!) // -> page 2: [Clara (Eng, continued), header HR (no rows here)]
    expect(container.textContent).toContain('Clara')
    expect(container.textContent).not.toContain('Alice')
    const engHeader = groupHeaderRows(container).find((h) => h.textContent?.includes('Eng'))!
    expect(engHeader.textContent).toContain('cont')
    // HR's header lands as the very last item on this page with none of its own rows following
    // until the next page — it must still render its label instead of crashing on empty `rows`.
    const hrHeader = groupHeaderRows(container).find((h) => h.textContent?.includes('HR'))!
    expect(hrHeader).toBeTruthy()
    expect(hrHeader.textContent).not.toContain('cont')
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

  it('does not render a clear-search button when the search query is empty', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('[data-action="clear-search"]')).toBeNull()
  })

  it('renders a clear-search button once the search query is non-empty', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ali')
    expect(container.querySelector('[data-action="clear-search"]')).not.toBeNull()
  })

  it('clear-search resets only the search query, not other active state', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ali')
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    click(container.querySelector<HTMLElement>('[data-action="clear-search"]')!)
    expect(container.querySelector<HTMLInputElement>('[data-action="search"]')!.value).toBe('')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(table.getViewState().sorts).toEqual([{ key: 'score', dir: 'asc' }])
  })

  it('clear-search returns focus to the search input', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('[data-action="search"]')!, 'ali')
    container.querySelector<HTMLElement>('[data-action="clear-search"]')!.focus()
    click(container.querySelector<HTMLElement>('[data-action="clear-search"]')!)
    expect(document.activeElement).toBe(container.querySelector('[data-action="search"]'))
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
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
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
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
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
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
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
    click(container.querySelector<HTMLElement>('th[data-action="header-sort"][data-key="score"]')!)
    table.setViewState({ page: 2 })
    expect(table.getViewState()).toEqual({ page: 2 })
  })

  it('setViewState falls back to default visible columns when given stale keys', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.setViewState({ visibleCols: ['nonexistent'] })
    expect(colHeaders(container)).toEqual(expect.arrayContaining(['Name', 'Score', 'Dept']))
  })
})

describe('createDataTable — virtualized filter checklist', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  const MANY_COLS: ColumnDef<Row>[] = [{ key: 'name', label: 'Name', filterable: true }]
  const MANY_ROWS: Row[] = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    name: `Value ${String(i).padStart(4, '0')}`,
    score: i,
    dept: 'Eng',
  }))

  it('only mounts the rows scrolled into view, not every distinct value', () => {
    createDataTable(container, { data: MANY_ROWS, columns: MANY_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const items = container.querySelectorAll('.dt-filter-list .dt-dd-item')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(50)
  })

  it('renders a different slice of values after scrolling', async () => {
    createDataTable(container, { data: MANY_ROWS, columns: MANY_COLS, defaultPageSize: 10 })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const list = container.querySelector<HTMLElement>('.dt-filter-list')!
    expect(list.textContent).toContain('Value 0000')

    Object.defineProperty(list, 'scrollTop', { value: 32 * 200, writable: true })
    list.dispatchEvent(new Event('scroll'))
    // scrollTop updates are throttled via requestAnimationFrame before the re-render.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const listAfter = container.querySelector<HTMLElement>('.dt-filter-list')!
    expect(listAfter.textContent).not.toContain('Value 0000')
    expect(listAfter.textContent).toContain('Value 0200')
  })

  it('select-all still selects every matching value, not just the rendered window', () => {
    createDataTable(container, { data: MANY_ROWS, columns: MANY_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    click(container.querySelector<HTMLElement>('[data-action="toggle-filter-all"]')!)
    expect(container.querySelector('.dt-stats')?.textContent).toContain('500 / 500 rows')
  })
})

describe('createDataTable — filter panel height correction (#13/#14)', () => {
  let container: HTMLDivElement
  let originalRect: () => DOMRect

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    originalRect = HTMLElement.prototype.getBoundingClientRect
  })

  afterEach(() => {
    container.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  // Stubs what the post-render correction pass reads: `.dt-filter-detail`'s bottom edge
  // (stretched by `.dt-filter-cols`, per the flex row's cross-axis stretch) vs. the checklist/
  // date-tree wrapper's own bottom edge — jsdom has no real layout engine, so without this both
  // would report 0 regardless of any CSS, masking the gap the correction pass is meant to close.
  function mockPanelHeight(detailBottom: number, viewportBottom: number): void {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.classList.contains('dt-filter-detail')) return { bottom: detailBottom } as DOMRect
      if (
        this.classList.contains('dt-filter-list') ||
        this.classList.contains('dt-date-tree-wrap')
      ) {
        return { bottom: viewportBottom } as DOMRect
      }
      return originalRect.call(this)
    }
  }

  it('grows the checklist to fill the panel when the column list stretches it taller', () => {
    mockPanelHeight(300, 260)
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const list = container.querySelector<HTMLElement>('.dt-filter-list')!
    expect(list.style.height).toBe('300px')
  })

  it('leaves the checklist at the floor height when the panel has no extra room', () => {
    mockPanelHeight(260, 260)
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const list = container.querySelector<HTMLElement>('.dt-filter-list')!
    expect(list.style.height).toBe('260px')
  })

  it('bounds the date filter tree in a scrollable wrapper that grows the same way', () => {
    interface GameRow {
      id: number
      name: string
      released: string
    }
    const DATE_COLS: ColumnDef<GameRow>[] = [
      { key: 'released', label: 'Released', type: 'date', filterable: true },
    ]
    const DATE_ROWS: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2021-01-02' },
    ]
    mockPanelHeight(300, 260)
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    click(container.querySelector<HTMLElement>('[data-action="toggle-dd"][data-dd="filter"]')!)
    const wrap = container.querySelector<HTMLElement>('.dt-date-tree-wrap')!
    expect(wrap.style.height).toBe('300px')
  })
})
