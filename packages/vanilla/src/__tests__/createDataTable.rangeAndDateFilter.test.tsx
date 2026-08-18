import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Find a toolbar/dropdown-adjacent button by its visible text.
function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!
}

function openFilterDropdown(container: HTMLElement): void {
  click(findButton(container, 'Filter'))
}

function selectFilterCol(container: HTMLElement, label: string): void {
  const btn = [...container.querySelectorAll<HTMLButtonElement>('.dt-filter-col-item')].find((b) =>
    b.textContent?.includes(label),
  )!
  click(btn)
}

// Both the number and date range detail panes render their min/max controls as the first two
// `input.dt-range-input` (number) or `input[type="date"]` (date) elements in the detail pane.
function rangeMinInput(
  container: HTMLElement,
  type: 'number' | 'date' = 'number',
): HTMLInputElement {
  const selector = type === 'date' ? 'input[type="date"]' : 'input.dt-range-input'
  return container.querySelectorAll<HTMLInputElement>(selector)[0]
}
function rangeMaxInput(
  container: HTMLElement,
  type: 'number' | 'date' = 'number',
): HTMLInputElement {
  const selector = type === 'date' ? 'input[type="date"]' : 'input.dt-range-input'
  return container.querySelectorAll<HTMLInputElement>(selector)[1]
}

describe('createDataTable', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  // --- range filter ---

  it('min range filter keeps only rows at or above the threshold', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    setInput(rangeMinInput(container), '80')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90) and Clara (80)
  })

  it('typing consecutive digits into a numeric range input appends them in order', () => {
    // Regression test (adapted): the min/max range inputs are plain text inputs (not
    // type="number", whose selectionStart/End are unsupported by spec) so the caret behaves
    // normally across re-renders. Solid also reuses the same DOM node across updates (no
    // destroy/recreate), so typing digit-by-digit should append in order with no special restore
    // mechanism needed.
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    function typeChar(char: string): void {
      const el = rangeMinInput(container)
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      el.value = el.value.slice(0, start) + char + el.value.slice(end)
      el.setSelectionRange(start + char.length, start + char.length)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    // Start from an empty field (the inputs default to the column's data bounds otherwise, which
    // would obscure the append-vs-prepend distinction this test is about).
    setInput(rangeMinInput(container), '')
    rangeMinInput(container).focus()
    typeChar('8')
    typeChar('5')
    expect(rangeMinInput(container).value).toBe('85')
  })

  it('max range filter keeps only rows at or below the threshold', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    setInput(rangeMaxInput(container), '70')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Bob (60) and David (70)
  })

  it("renders a range slider with bounds matching the numeric column's actual min/max", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    const thumbs = [...container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')]
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0].min).toBe('60')
    expect(thumbs[0].max).toBe('90')
    expect(thumbs[0].value).toBe('60')
    expect(thumbs[1].value).toBe('90')
  })

  it('dragging a slider thumb filters rows immediately (Solid updates the controlled input in place)', () => {
    // Adapted: the old vanilla implementation had to split range-slider handling across
    // `input`/`change` events specifically to avoid destroying the dragged thumb mid-drag via a
    // full innerHTML rebuild. Solid's controlled inputs update the same DOM node in place, so the
    // new RangeSlider commits directly on every `input` tick (see RangeSlider.tsx doc comment) —
    // there's no longer a deferred-until-"change" step to test.
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    const low = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')[0]
    low.value = '75'
    low.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Alice (90), Clara (80)
  })

  it('committing a slider drag also updates the plain min/max inputs, sorted low/high', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    // Drag the "high" thumb down past the middle — the actual min/max is Math.min/max of both
    // live thumb values regardless of which thumb nominally moved.
    const high = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')[1]
    high.value = '75'
    high.dispatchEvent(new Event('input', { bubbles: true }))
    expect(rangeMinInput(container).value).toBe('60')
    expect(rangeMaxInput(container).value).toBe('75')
  })

  it('updates the plain min/max inputs live while dragging', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    const low = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')[0]
    low.value = '75'
    low.dispatchEvent(new Event('input', { bubbles: true }))
    expect(rangeMinInput(container).value).toBe('75')
  })

  it("defaults the plain min/max inputs to the column's data bounds when no filter is set", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    expect(rangeMinInput(container).value).toBe('60') // Bob
    expect(rangeMaxInput(container).value).toBe('90') // Alice
    // Bounds are a display-only default — no filter is actually active yet.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(container.querySelector('.dt-chip--filter')).toBeNull()
  })

  it('marks the column with a dot and an active-bar chip once a range filter is set', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    setInput(rangeMinInput(container), '80')
    const scoreColItem = [...container.querySelectorAll<HTMLElement>('.dt-filter-col-item')].find(
      (b) => b.textContent?.includes('Score'),
    )!
    expect(scoreColItem.querySelector('.dt-filter-col-dot')).toBeTruthy()
    const chip = container.querySelector('.dt-chip--filter')!
    expect(chip.textContent).toContain('Score')
    expect(chip.textContent).toContain('80')
  })

  it("clicking a range filter's active-bar chip clears it and unfilters the rows", () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openFilterDropdown(container)
    selectFilterCol(container, 'Score')
    setInput(rangeMinInput(container), '80')
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
    openFilterDropdown(container)
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
  function expandToggle(node: HTMLElement): HTMLElement {
    return node.querySelector<HTMLElement>('.dt-date-tree-toggle--branch')!
  }
  function nodeCheckbox(node: HTMLElement): HTMLInputElement {
    return node.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  }

  it('renders year nodes collapsed by default, with months hidden until expanded', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    expect(container.innerHTML).toContain('2023')
    expect(container.innerHTML).toContain('2021')
    // Only the 2 year nodes exist before anything is expanded (no month/day rows yet).
    expect(container.querySelectorAll('.dt-date-tree-item')).toHaveLength(2)
  })

  it('expanding a year reveals its months (as a localized month name), expanding a month reveals its days', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(expandToggle(dateNode('2023')))
    expect(dateNode('May')).toBeTruthy()
    click(expandToggle(dateNode('May')))
    expect(dateNode('14')).toBeTruthy()
    expect(dateNode('20')).toBeTruthy()
  })

  it('checking a year node selects every date under it and filters rows accordingly', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(nodeCheckbox(dateNode('2023')))
    expect(container.innerHTML).toContain('Game A')
    expect(container.innerHTML).toContain('Game B')
    expect(container.innerHTML).not.toContain('Game C')
  })

  it('unchecking an already fully-selected year deselects every date under it', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(nodeCheckbox(dateNode('2023')))
    click(nodeCheckbox(dateNode('2023')))
    expect(container.innerHTML).toContain('Game C')
  })

  it('is indeterminate on a month node when only some of its days are selected', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    click(expandToggle(dateNode('2023')))
    click(expandToggle(dateNode('May')))
    click(nodeCheckbox(dateNode('14')))
    const monthCheckbox = nodeCheckbox(dateNode('May'))
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
    click(nodeCheckbox(dateNode('2023')))
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
    click(expandToggle(dateNode('2023')))
    click(expandToggle(dateNode('May')))
    click(nodeCheckbox(dayNode('14')))
    shiftClick(nodeCheckbox(dayNode('20')))
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
    click(expandToggle(dateNode('2023')))
    click(expandToggle(dateNode('May')))
    click(nodeCheckbox(dateNode('2021')))
    shiftClick(nodeCheckbox(dayNode('14')))
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
    expect(rangeMinInput(container, 'date').type).toBe('date')
    expect(rangeMaxInput(container, 'date').type).toBe('date')
  })

  // BUG (not a selector/behavior-intent mismatch — a real regression found in the new
  it("defaults the date inputs to the column's earliest/latest date when no filter is set", () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    expect(rangeMinInput(container, 'date').value).toBe('2021-01-02') // Game C
    expect(rangeMaxInput(container, 'date').value).toBe('2023-05-20') // Game B
    expect(container.querySelector('.dt-chip--filter')).toBeNull()
  })

  it('a date range narrows the tree itself and filters rows, without needing a checkbox ticked', () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    setInput(rangeMinInput(container, 'date'), '2022-01-01')
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
    setInput(rangeMinInput(container, 'date'), '2022-01-01')
    const releasedColItem = [
      ...container.querySelectorAll<HTMLElement>('.dt-filter-col-item'),
    ].find((b) => b.textContent?.includes('Released'))!
    expect(releasedColItem.querySelector('.dt-filter-col-dot')).toBeTruthy()
    const chip = container.querySelector('.dt-chip--filter')!
    expect(chip.textContent).toContain('Released')
    expect(chip.textContent).toContain('2022-01-01')
  })

  it("clicking a date range filter's active-bar chip clears it, restoring the full tree and rows", () => {
    createDataTable(container, { data: DATE_ROWS, columns: DATE_COLS })
    openDateFilter()
    setInput(rangeMinInput(container, 'date'), '2022-01-01')
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
    const [, , next] = [...container.querySelectorAll<HTMLButtonElement>('.dt-page-btn')]
    click(next)
    expect(container.innerHTML).toContain('Clara')
  })

  it('page-last jumps to the last page', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    const [, , , last] = [...container.querySelectorAll<HTMLButtonElement>('.dt-page-btn')]
    click(last)
    expect(container.innerHTML).toContain('David')
  })

  it('page-first returns to page 1', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultPageSize: 2 })
    const [first, , , last] = [...container.querySelectorAll<HTMLButtonElement>('.dt-page-btn')]
    click(last)
    click(first)
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
})

// PRUNED:
// (none — every test in this assigned range (range filter, date filter tree, date range filter,
// pagination) covers real, still-implemented behavior. Two tests were adapted rather than
// dropped because the underlying *mechanism* they exercised changed:
// - 'dragging a slider thumb does not filter rows until the drag commits on "change"' — the old
//   vanilla implementation deferred committing a slider drag to the `change` event specifically to
//   avoid a mid-drag innerHTML rebuild destroying the dragged thumb (see RangeSlider.tsx's own doc
//   comment). Solid's controlled inputs update in place, so RangeSlider now commits on every
//   `input` tick with no such deferral — renamed/adapted to assert the new (simpler, and arguably
//   better) behavior: rows filter immediately as the slider moves, rather than asserting a
//   "change"-gated commit that no longer exists.
// - 'typing consecutive digits into a numeric range input appends them in order' — kept as a
//   plain behavioral regression check (Solid's DOM-node reuse already makes this trivially true,
//   so there's no special "restore mechanism" left to test, but the underlying typing behavior is
//   still worth a smoke test).
