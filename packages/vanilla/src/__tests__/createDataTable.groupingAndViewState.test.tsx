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

// --- generic helpers ---

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

// Every interactive toolbar/dropdown-row element is a plain <button> with its label as
// textContent now (no data-action attributes) — find it by exact text. Scoped to `root` so
// callers can disambiguate between e.g. the toolbar's "Group" trigger and an addable "Dept" row.
function findButtonByText(root: ParentNode, text: string): HTMLButtonElement {
  const btn = [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`button not found: ${text}`)
  return btn
}

function groupHeaderRows(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('.dt-group-row[data-gkey]')]
}

function pageButton(container: HTMLElement, label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('.dt-page-btn')].find(
    (b) => b.textContent === label,
  )!
}

// jsdom has no DragEvent constructor; the handlers only read e.clientX/clientY and call
// preventDefault(), both of which a plain (cancelable) MouseEvent supports.
function dragEvt(type: string): Event {
  return new MouseEvent(type, { bubbles: true, cancelable: true })
}

function dragEvtAt(type: string, clientY: number): Event {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientY })
}

function stubRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  el.getBoundingClientRect = () => rect as DOMRect
}

// Filter checklist rows (`.dt-filter-list .dt-dd-item`) have no `data-value` attribute anymore —
// the value lives in the row's `.dt-flex1` label text, and the checkbox is a plain
// `<input type="checkbox">` sibling inside the same `<label>`.
function filterListValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.dt-filter-list .dt-dd-item .dt-flex1')].map(
    (el) => el.textContent ?? '',
  )
}

function findFilterCheckbox(container: HTMLElement, value: string): HTMLInputElement {
  const row = [...container.querySelectorAll<HTMLElement>('.dt-filter-list .dt-dd-item')].find(
    (l) => l.querySelector('.dt-flex1')?.textContent === value,
  )!
  return row.querySelector<HTMLInputElement>('input[type="checkbox"]')!
}

// The checkbox's own onClick calls e.preventDefault() itself and drives checked/indeterminate
// from state — dispatch directly on the <input>, matching FilterDropdown.test.tsx's own pattern.
function clickFilterValue(container: HTMLElement, value: string, shiftKey = false): void {
  findFilterCheckbox(container, value).dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey }),
  )
}

function openGroupDropdown(container: HTMLElement): void {
  click(findButtonByText(container, 'Group'))
}

function openFilterDropdown(container: HTMLElement): void {
  click(findButtonByText(container, 'Filter'))
}

function groupByDept(container: HTMLElement): void {
  openGroupDropdown(container)
  click(findButtonByText(container, 'Dept'))
}

describe('createDataTable (grouping, group dropdown, pagination+grouping, search, aggregate, i18n, escaping, multi-value, computed columns, view state)', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  // --- grouping ---

  it('renders group header rows when a column is grouped', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
    expect(container.querySelector('.dt-group-row')).not.toBeNull()
  })

  it('the add-group row is a real <button>, natively Tab-reachable', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openGroupDropdown(container)
    const addRow = findButtonByText(container, 'Dept')
    expect(addRow.tagName).toBe('BUTTON')
    expect(addRow.tabIndex).toBe(0)
    click(addRow)
    expect(container.querySelector('.dt-group-row')).not.toBeNull()
  })

  it('grouped column disappears from table headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
    expect(colHeaders(container)).not.toContain('Dept')
  })

  it('collapsing a group hides its data rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultGroupsCollapsed: false })
    groupByDept(container)
    const before = container.querySelectorAll('.dt-tr').length
    click(container.querySelector<HTMLElement>('.dt-group-row')!)
    expect(container.querySelectorAll('.dt-tr').length).toBeLessThan(before)
  })

  it('starts groups collapsed by default, and clicking a header expands it', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
    expect(container.querySelectorAll('.dt-tr').length).toBe(0)
    click(container.querySelector<HTMLElement>('.dt-group-row')!)
    expect(container.querySelectorAll('.dt-tr').length).toBeGreaterThan(0)
  })

  it('defaultGroupsCollapsed: false starts groups expanded', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultGroupsCollapsed: false })
    groupByDept(container)
    expect(container.querySelectorAll('.dt-tr').length).toBeGreaterThan(0)
  })

  // --- group dropdown (active/add split, remove, reorder) ---

  it('the Group toolbar button carries no count badge; an active group shows a chip in the active bar', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
    const groupBtn = findButtonByText(container, 'Group')
    expect(groupBtn.textContent).toBe('Group')
    // Grouping also auto-inserts a matching sort entry (issue #17) — rather than two identically
    // labeled chips, the active bar merges them into one dt-chip--grouped-sort chip with two ×
    // buttons (remove sort / remove group).
    const chips = [...container.querySelectorAll<HTMLElement>('.dt-active-bar .dt-chip')]
    expect(chips).toHaveLength(1)
    const groupChip = chips[0]
    expect(groupChip.classList.contains('dt-chip--grouped-sort')).toBe(true)
    expect(groupChip.textContent).toContain('Dept')
    const removeButtons = [...groupChip.querySelectorAll<HTMLElement>('.dt-chip-x')]
    expect(removeButtons).toHaveLength(2)
    click(removeButtons[1]) // the group-removal ×, not the sort-removal one
    // Removing the group doesn't remove the auto-inserted sort — it's now an ordinary sort entry
    // (plain, unmerged chip) the user can separately reverse/remove (see insertGroupSort note).
    const remaining = [...container.querySelectorAll<HTMLElement>('.dt-active-bar .dt-chip')]
    expect(remaining).toHaveLength(1)
    expect(remaining[0].classList.contains('dt-chip--grouped-sort')).toBe(false)
  })

  it('removing an active group entry clears the group and moves the column back to the add section', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
    click(container.querySelector<HTMLElement>('[data-group-key="dept"] .dt-item-remove')!)
    expect(container.querySelector('[data-group-key="dept"]')).toBeNull()
    expect(findButtonByText(container, 'Dept')).toBeTruthy()
    expect(colHeaders(container)).toContain('Dept')
  })

  it('the Group toolbar button has no clear-groups × until a group is active', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('.dt-btn-clear')).toBeNull()
  })

  it("the Group dropdown's × clears all groups without needing the dropdown open", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
    openGroupDropdown(container) // close it (toggle)

    expect(container.querySelector('.dt-dd')).toBeNull()
    // Grouping now also auto-inserts a sort entry, so the Sort toolbar button grows its own
    // clear-sorts × too — scope to the Group dropdown's specifically via its distinct label.
    click(container.querySelector<HTMLElement>('.dt-btn-clear[title="Clear groups"]')!)
    expect(container.querySelector('.dt-dd')).toBeNull() // still closed, not reopened by the click
    expect(colHeaders(container)).toContain('Dept')
  })

  it('active group rows are draggable and reorder priority on drop', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    openGroupDropdown(container)
    click(findButtonByText(container, 'Name'))
    click(findButtonByText(container, 'Dept'))
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
    openGroupDropdown(container)
    click(findButtonByText(container, 'Name'))
    click(findButtonByText(container, 'Dept'))
    click(findButtonByText(container, 'Score'))
    const nameRow = container.querySelector<HTMLElement>('[data-group-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-group-key="score"]')!
    stubRect(scoreRow, { top: 20, bottom: 40, height: 20 })
    // The dragover/drop listeners live on the rows' own wrapper div (the direct parent of every
    // `[data-group-key]` row), not the whole `.dt-dd` panel — dispatching on an ancestor of that
    // wrapper wouldn't bubble down into it. Dispatching on the wrapper itself still exercises
    // "pointer over dead space below the last row" (clientY past every row's own bounds), since
    // resolveDropRow's fallback only cares about clientY vs. each row's rect, not the dispatch
    // target's own rect.
    const rowsWrap = nameRow.parentElement!

    nameRow.dispatchEvent(dragEvt('dragstart'))
    rowsWrap.dispatchEvent(dragEvtAt('dragover', 100))
    rowsWrap.dispatchEvent(dragEvtAt('drop', 100))

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
    openGroupDropdown(container)
    click(findButtonByText(container, 'Name'))
    click(findButtonByText(container, 'Dept'))
    const nameRow = container.querySelector<HTMLElement>('[data-group-key="name"]')!
    const deptRow = container.querySelector<HTMLElement>('[data-group-key="dept"]')!
    stubRect(deptRow, { top: 20, bottom: 40, height: 20 })

    nameRow.dispatchEvent(dragEvt('dragstart'))
    // clientY 35 falls in deptRow's bottom half (30-40) — should insert name *after* dept, not
    // before it (which "insert before" alone could never express for the last row).
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
    openGroupDropdown(container)
    click(findButtonByText(container, 'Name'))
    click(findButtonByText(container, 'Dept'))
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
    openGroupDropdown(container)
    click(findButtonByText(container, 'Name'))
    click(findButtonByText(container, 'Dept'))
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
      initialViewState: { pageSize: 2 },
      defaultGroupsCollapsed: false,
    })
    groupByDept(container)
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
      initialViewState: { pageSize: 2 },
      defaultGroupsCollapsed: false,
    })
    groupByDept(container)
    click(pageButton(container, '›')) // -> page 2: [Clara (Eng, continued), header HR (no rows here)]
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
    expect(container.querySelector<HTMLInputElement>('.dt-search-input')).not.toBeNull()
  })

  it('typing in the search input filters rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'ali')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Alice')
  })

  it('search is case-insensitive', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'ENG')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('clear-all resets search query', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'ali')
    click(container.querySelector<HTMLElement>('.dt-clear-all')!)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('does not render a clear-search button when the search query is empty', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('.dt-search-clear')).toBeNull()
  })

  it('renders a clear-search button once the search query is non-empty', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'ali')
    expect(container.querySelector('.dt-search-clear')).not.toBeNull()
  })

  it('clear-search resets only the search query, not other active state', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'ali')
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    click(container.querySelector<HTMLElement>('.dt-search-clear')!)
    expect(container.querySelector<HTMLInputElement>('.dt-search-input')!.value).toBe('')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(instance.getViewState().sorts).toEqual([{ key: 'score', dir: 'asc' }])
  })

  // --- aggregate rows ---

  it('renders an aggregate row per group when aggregate is defined', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', aggregate: 'sum' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    groupByDept(container)
    expect(container.querySelector('.dt-agg-row')).not.toBeNull()
  })

  it('aggregate row shows the correct sum', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', aggregate: 'sum' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    groupByDept(container)
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
    groupByDept(container)
    const aggRows = container.querySelectorAll('.dt-agg-row')
    expect(aggRows[0].textContent).toContain('Eng=170')
  })

  it('does not render aggregate rows when no aggregate is defined', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    groupByDept(container)
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
    openFilterDropdown(container)
    expect(filterListValues(container)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('selecting an array item filters rows containing it', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    openFilterDropdown(container)
    clickFilterValue(container, 'RPG')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.innerHTML).toContain('Game A')
  })

  it('renders array cell values joined with a comma by default', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    expect(container.innerHTML).toContain('Action, RPG')
  })

  it('grouping by an array column fans a row into one group per item', () => {
    createDataTable(container, { data: GAMES, columns: GAME_COLS })
    openGroupDropdown(container)
    click(findButtonByText(container, 'Tags'))
    const groupTexts = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(container.querySelectorAll('.dt-group-row')).toHaveLength(3)
    expect(groupTexts.some((t) => t?.includes('Tags: Action'))).toBe(true)
    expect(groupTexts.some((t) => t?.includes('Tags: RPG'))).toBe(true)
    expect(groupTexts.some((t) => t?.includes('Tags: Adventure'))).toBe(true)
  })

  it('checklist filter lists a "(none)" entry for rows with an empty array', () => {
    createDataTable(container, { data: GAMES_WITH_EMPTY, columns: GAME_COLS })
    openFilterDropdown(container)
    expect(filterListValues(container)).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('grouping buckets rows with an empty array under "(none)"', () => {
    createDataTable(container, { data: GAMES_WITH_EMPTY, columns: GAME_COLS })
    openGroupDropdown(container)
    click(findButtonByText(container, 'Tags'))
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
    openFilterDropdown(container)
    expect(filterListValues(container)).toContain('N/A')
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
    openGroupDropdown(container)
    click(findButtonByText(container, 'Grade'))
    const groupTexts = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(groupTexts.some((t) => t?.includes('Grade: A'))).toBe(true)
    expect(groupTexts.some((t) => t?.includes('Grade: B'))).toBe(true)
  })

  // --- view state ---

  it('getViewState omits fields still at their default', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    expect(instance.getViewState()).toEqual({})
  })

  it('getViewState captures changes made through the UI', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    openFilterDropdown(container)
    clickFilterValue(container, 'Alice')
    expect(instance.getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
      filters: { name: ['Alice'] },
    })
  })

  it('onViewChange fires with the new view when the UI changes it, but not on selection', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS, selectable: true })
    const cb = vi.fn()
    instance.onViewChange(cb)
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith({ sorts: [{ key: 'score', dir: 'asc' }] })
    const firstRow = container.querySelector<HTMLElement>('tr.dt-tr[data-proc-idx="0"]')!
    click(firstRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('onViewChange returns an unsubscribe function', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    const cb = vi.fn()
    const unsubscribe = instance.onViewChange(cb)
    unsubscribe()
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    expect(cb).not.toHaveBeenCalled()
  })

  it('setViewState applies a snapshot and re-renders', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    instance.setViewState({ sorts: [{ key: 'score', dir: 'desc' }], searchQuery: 'a' })
    expect(instance.getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'desc' }],
      searchQuery: 'a',
    })
    expect(container.querySelector<HTMLInputElement>('.dt-search-input')!.value).toBe('a')
  })

  it('setViewState resets fields absent from the given view', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    instance.setViewState({ page: 2 })
    expect(instance.getViewState()).toEqual({ page: 2 })
  })

  it('setViewState falls back to default visible columns when given stale keys', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    instance.setViewState({ visibleCols: ['nonexistent'] })
    expect(colHeaders(container)).toEqual(expect.arrayContaining(['Name', 'Score', 'Dept']))
  })

  it('setViewState({}) restores initialViewState instead of clearing to empty (GitHub issue #20)', () => {
    const instance = createDataTable(container, {
      data: ROWS,
      columns: COLS,
      initialViewState: { sorts: [{ key: 'score', dir: 'desc' }] },
    })
    instance.setViewState({ sorts: [{ key: 'name', dir: 'asc' }], page: 2 }) // diverge
    instance.setViewState({})
    expect(instance.getViewState()).toEqual({})
  })

  // --- getProcessedData (GitHub issue #22) ---

  it('getProcessedData returns all rows, unsorted/unfiltered, by default', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    expect(instance.getProcessedData()).toEqual(ROWS)
  })

  it('getProcessedData reflects search + filter + sort', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!) // sort by score asc
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'e') // dept "Eng" only
    expect(instance.getProcessedData().map((r) => r.name)).toEqual(['Clara', 'Alice'])
  })

  it('getProcessedData stays in flat row order across grouping and pagination', () => {
    const instance = createDataTable(container, {
      data: ROWS,
      columns: COLS,
      initialViewState: { pageSize: 2 },
    })
    groupByDept(container)
    click(pageButton(container, '›')) // page 2 — a display slice, shouldn't affect this
    // Groups Eng/HR each fan out to their own header, but getProcessedData stays the plain
    // filtered/sorted row list — no headers, no per-group re-chunking. Grouping also auto-inserts
    // a matching sort entry (issue #17), so rows land dept-grouped (Eng before HR) rather than in
    // original ROWS order.
    expect(instance.getProcessedData().map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
      'Bob',
      'David',
    ])
  })

  it('getProcessedData returns a fresh array each call, not a live reference', () => {
    const instance = createDataTable(container, { data: ROWS, columns: COLS })
    expect(instance.getProcessedData()).not.toBe(instance.getProcessedData())
  })

  // --- clearAll ---

  it('clearAll resets search/filter/sort/group/page to true defaults, ignoring initialViewState', () => {
    const instance = createDataTable(container, {
      data: ROWS,
      columns: COLS,
      initialViewState: { sorts: [{ key: 'score', dir: 'desc' }] },
    })
    click(container.querySelector<HTMLElement>('th[data-col-key="name"]')!) // diverge from initial
    setInput(container.querySelector<HTMLInputElement>('.dt-search-input')!, 'ali')
    instance.clearAll()
    // Unlike setViewState({}), which restores initialViewState's own sort, clearAll ignores it —
    // sorts: [] surfaces explicitly here since it now differs from the initialViewState default.
    expect(instance.getViewState()).toEqual({ sorts: [] })
    expect(instance.getProcessedData()).toEqual(ROWS)
    expect(container.querySelector<HTMLInputElement>('.dt-search-input')!.value).toBe('')
  })
})

// PRUNED:
// - 'clear-search returns focus to the search input' — the old vanilla implementation explicitly
//   refocused the search input after a re-render because the innerHTML rebuild destroyed the
//   focused node. The new SearchBox.tsx's clear button has no such refocus call at all (see
//   SearchBox.test.tsx, which has no equivalent test either) — clicking a real <button> just moves
//   native focus to that button, matching plain browser behavior. There's nothing left to assert
//   that isn't the now-removed workaround mechanism itself.
