import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { FilterDropdown } from '../components/FilterDropdown'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  dept: string
  score: number
  joined: string
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name', filterable: true },
  { key: 'dept', label: 'Dept', filterable: true },
  { key: 'score', label: 'Score', filterable: true, type: 'number' },
  { key: 'joined', label: 'Joined', filterable: true, type: 'date' },
]
const ROWS: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', score: 90, joined: '2023-01-15' },
  { id: 2, name: 'Bob', dept: 'HR', score: 60, joined: '2023-06-20' },
  { id: 3, name: 'Clara', dept: 'Eng', score: 80, joined: '2024-02-05' },
  { id: 4, name: 'David', dept: 'HR', score: 70, joined: '2024-02-10' },
]

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  let setIsOpen!: (open: boolean) => void
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS)
    const [isOpen, setIsOpenSignal] = createSignal(true)
    setIsOpen = setIsOpenSignal
    render(
      () => (
        <FilterDropdown
          table={table}
          columns={COLS}
          isOpen={isOpen()}
          onToggle={() => setIsOpenSignal((o) => !o)}
          onClose={() => setIsOpenSignal(false)}
        />
      ),
      container,
    )
    return d
  })
  return { container, table, dispose, setIsOpen }
}

function selectCol(container: HTMLElement, label: string): void {
  const btn = [...container.querySelectorAll<HTMLButtonElement>('.dt-filter-col-item')].find((b) =>
    b.textContent?.includes(label),
  )!
  btn.click()
}

describe('FilterDropdown — column selection', () => {
  it('defaults to the first filterable column and switches on click', () => {
    const { container, dispose } = mount()
    expect(container.querySelector('.dt-filter-list')).not.toBeNull() // Name is a string col
    selectCol(container, 'Score')
    expect(container.querySelector('.dt-filter-list')).toBeNull()
    expect(container.querySelector('input[type="text"].dt-range-input')).not.toBeNull()
    dispose()
  })

  it('shows a clear button for a column with an active filter', () => {
    const { container, table, dispose } = mount()
    expect(
      [...container.querySelectorAll('.dt-filter-col-row')]
        .find((r) => r.textContent?.includes('Name'))!
        .querySelector('.dt-filter-col-clear'),
    ).toBeNull()
    table.filter.cycleValue('name', 'Alice')
    const row = [...container.querySelectorAll('.dt-filter-col-row')].find((r) =>
      r.textContent?.includes('Name'),
    )!
    expect(row.querySelector('.dt-filter-col-clear')).not.toBeNull()
    dispose()
  })

  it('clear button removes the column filter without opening it', () => {
    const { container, table, dispose } = mount()
    table.filter.cycleValue('score', '90')
    selectCol(container, 'Name') // switch active detail pane away from Score
    const row = [...container.querySelectorAll('.dt-filter-col-row')].find((r) =>
      r.textContent?.includes('Score'),
    )!
    row.querySelector<HTMLButtonElement>('.dt-filter-col-clear')!.click()
    expect(table.filter.include().score?.size ?? 0).toBe(0)
    expect(container.querySelector('.dt-filter-list')).not.toBeNull() // still showing Name's pane
    dispose()
  })

  it('Delete on a focused, active column row clears its filter (same as the × button)', () => {
    const { container, table, dispose } = mount()
    table.filter.cycleValue('score', '90')
    const scoreBtn = [...container.querySelectorAll<HTMLButtonElement>('.dt-filter-col-item')].find(
      (b) => b.textContent?.includes('Score'),
    )!
    scoreBtn.focus()
    scoreBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(table.filter.include().score?.size ?? 0).toBe(0)
    dispose()
  })

  it('Backspace on a focused, inactive column row is a no-op', () => {
    const { container, table, dispose } = mount()
    const deptBtn = [...container.querySelectorAll<HTMLButtonElement>('.dt-filter-col-item')].find(
      (b) => b.textContent?.includes('Dept'),
    )!
    deptBtn.focus()
    deptBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    expect(table.filter.include().dept?.size ?? 0).toBe(0)
    expect(table.pagination.page()).toBe(1)
    dispose()
  })
})

const CATEGORIZED_COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name', filterable: true },
  { key: 'dept', label: 'Dept', filterable: true, category: 'Org' },
  { key: 'score', label: 'Score', filterable: true, type: 'number', category: 'Org' },
  { key: 'joined', label: 'Joined', filterable: true, type: 'date' },
]

function mountCategorized() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, CATEGORIZED_COLS)
    const [isOpen] = createSignal(true)
    render(
      () => (
        <FilterDropdown
          table={table}
          columns={CATEGORIZED_COLS}
          isOpen={isOpen()}
          onToggle={() => {}}
          onClose={() => {}}
        />
      ),
      container,
    )
    return d
  })
  return { container, table, dispose }
}

describe('FilterDropdown — column categories', () => {
  it('renders uncategorized columns as plain rows and categorized ones under a section header', () => {
    const { container, dispose } = mountCategorized()
    const itemLabels = [...container.querySelectorAll('.dt-filter-col-item span')].map(
      (s) => s.textContent,
    )
    expect(itemLabels).toEqual(['Joined', 'Name', 'Dept', 'Score']) // uncategorized (alpha) first, then category
    expect(container.querySelector('.dt-filter-category-header')?.textContent).toContain('Org')
    dispose()
  })

  it('starts expanded and collapses/expands its columns on header click', () => {
    const { container, dispose } = mountCategorized()
    const header = container.querySelector<HTMLButtonElement>('.dt-filter-category-header')!
    const colLabel = () =>
      [...container.querySelectorAll('.dt-filter-col-item span')].map((s) => s.textContent)

    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(colLabel()).toEqual(['Joined', 'Name', 'Dept', 'Score'])

    header.click()
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(colLabel()).toEqual(['Joined', 'Name']) // Dept/Score hidden, uncategorized unaffected

    header.click()
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(colLabel()).toEqual(['Joined', 'Name', 'Dept', 'Score'])
    dispose()
  })
})

describe('FilterDropdown — column ordering', () => {
  it('moves active-filter columns to the top only when the dropdown (re)opens', () => {
    const { container, table, dispose } = mount()
    const labelOrder = () =>
      [...container.querySelectorAll('.dt-filter-col-item')].map((b) => b.textContent)
    expect(labelOrder()).toEqual(['Dept', 'Joined', 'Name', 'Score']) // plain alpha order, nothing active yet

    table.filter.cycleValue('score', '90')
    // Still open — the just-activated column must not jump to the top mid-session.
    expect(labelOrder()).toEqual(['Dept', 'Joined', 'Name', 'Score'])
    dispose()
  })

  it('reorders active-filter columns to the top on the next open', () => {
    const { container, table, dispose, setIsOpen } = mount()
    table.filter.cycleValue('score', '90')
    setIsOpen(false)
    setIsOpen(true)
    const labelOrder = () =>
      [...container.querySelectorAll('.dt-filter-col-item')].map((b) => b.textContent)
    expect(labelOrder()).toEqual(['Score', 'Dept', 'Joined', 'Name'])
    dispose()
  })
})

describe('FilterDropdown — string checklist', () => {
  it('clicking a value includes it; clicking again excludes; clicking again clears', () => {
    const { container, table, dispose } = mount()
    const aliceRow = [...container.querySelectorAll('.dt-filter-list .dt-dd-item')].find((el) =>
      el.textContent?.includes('Alice'),
    )!
    const checkbox = aliceRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(table.filter.include().name).toEqual(new Set(['Alice']))
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(table.filter.exclude().name).toEqual(new Set(['Alice']))
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(table.filter.include().name).toEqual(new Set())
    expect(table.filter.exclude().name).toEqual(new Set())
    dispose()
  })

  it('the checkbox DOM property reflects the tri-state correctly after a click, not just app state', async () => {
    // Regression test: a checkbox's own native "canceled activation steps" (triggered because
    // the click handler calls preventDefault() to stay fully controlled) run *after* the click
    // event finishes dispatching — i.e. after Solid's own synchronous `checked`/`indeterminate`
    // DOM write — silently reverting `.checked` back to its pre-click value a moment later. The
    // fix (checkboxSync.ts's deferCheckboxCorrection) re-applies the correct value from a
    // macrotask (not a microtask — a real, trusted click's native revert can itself land after
    // the microtask checkpoint that follows dispatch, see checkboxSync.ts), so asserting on the
    // checkbox's own DOM property (not just table.filter.include()) needs a real timer tick, not just a
    // microtask, to observe the corrected state.
    const { container, dispose } = mount()
    const aliceRow = [...container.querySelectorAll('.dt-filter-list .dt-dd-item')].find((el) =>
      el.textContent?.includes('Alice'),
    )!
    const checkbox = aliceRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(checkbox.checked).toBe(true)
    expect(checkbox.indeterminate).toBe(false)
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(checkbox.checked).toBe(false)
    expect(checkbox.indeterminate).toBe(true)
    dispose()
  })

  it('select-all toggles every currently-listed value', () => {
    const { container, table, dispose } = mount()
    const selectAll = container.querySelector<HTMLInputElement>(
      '.dt-filter-search-row input[type="checkbox"]',
    )!
    selectAll.click()
    expect(table.filter.include().name).toEqual(new Set(['Alice', 'Bob', 'Clara', 'David']))
    selectAll.click()
    expect(table.filter.include().name).toEqual(new Set())
    dispose()
  })

  it('search narrows the checklist', () => {
    const { container, dispose } = mount()
    const search = container.querySelector<HTMLInputElement>('.dt-filter-search-row .dt-dd-search')!
    search.value = 'ali'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const labels = [...container.querySelectorAll('.dt-filter-list .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Alice'])
    dispose()
  })

  it('a value with zero facet count is hidden unless already selected', () => {
    const { container, dispose } = mount()
    // Narrow to dept=Eng first (Alice, Clara) via the dept column.
    selectCol(container, 'Dept')
    const engRow = [...container.querySelectorAll('.dt-filter-list .dt-dd-item')].find((el) =>
      el.textContent?.includes('Eng'),
    )!
    engRow.querySelector<HTMLInputElement>('input')!.click()
    // Back on Name: Bob/David now have a facet count of 0 and should be hidden.
    selectCol(container, 'Name')
    const labels = [...container.querySelectorAll('.dt-filter-list .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(labels.sort()).toEqual(['Alice', 'Clara'])
    dispose()
  })
})

describe('FilterDropdown — number range', () => {
  it('typing into min narrows processedData via setRangeFilter', () => {
    const { container, table, dispose } = mount()
    selectCol(container, 'Score')
    const min = container.querySelector<HTMLInputElement>('input.dt-range-input')!
    min.value = '75'
    min.dispatchEvent(new Event('input', { bubbles: true }))
    expect(table.filter.ranges().score?.min).toBe('75')
    expect(
      table
        .processedData()
        .map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Clara'])
    dispose()
  })

  it('dragging a slider thumb commits both min and max', () => {
    const { container, table, dispose } = mount()
    selectCol(container, 'Score')
    const thumbs = container.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')
    expect(thumbs).toHaveLength(2)
    thumbs[0].value = '75'
    thumbs[0].dispatchEvent(new Event('input', { bubbles: true }))
    expect(table.filter.ranges().score?.min).toBe('75')
    expect(table.filter.ranges().score?.max).toBe('90')
    dispose()
  })
})

describe('FilterDropdown — date tree', () => {
  it('toggling a year node selects every date under it', () => {
    const { container, table, dispose } = mount()
    selectCol(container, 'Joined')
    const yearRow = [...container.querySelectorAll('.dt-date-tree-item')].find((el) =>
      el.textContent?.includes('2023'),
    )!
    yearRow
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(table.filter.include().joined).toEqual(new Set(['2023-01-15', '2023-06-20']))
    dispose()
  })

  it('the range inputs narrow the tree itself', () => {
    const { container, dispose } = mount()
    selectCol(container, 'Joined')
    const [minInput, maxInput] = container.querySelectorAll<HTMLInputElement>('input[type="date"]')
    minInput.value = '2024-01-01'
    minInput.dispatchEvent(new Event('input', { bubbles: true }))
    maxInput.value = '2024-12-31'
    maxInput.dispatchEvent(new Event('input', { bubbles: true }))
    const yearLabels = [...container.querySelectorAll('.dt-date-tree-item .dt-flex1')]
      .map((el) => el.textContent)
      .filter((t) => /^\d{4}$/.test(t ?? ''))
    expect(yearLabels).toEqual(['2024'])
    dispose()
  })
})

describe('FilterDropdown — shift-range selection', () => {
  it('deselecting a range via shift-click does not clear an unrelated exclude flag swept by it', () => {
    // Regression test: handleValueClick's shift-range branch used to call clearExcludeValues
    // unconditionally, even when the range was being *deselected* (shouldSelect === false) —
    // wiping exclude flags on any value in the swept range, not just ones actually moving into
    // `filters`. React/Vue both guard this with `if (shouldSelect)`.
    const { container, table, dispose } = mount()
    function checkboxFor(name: string): HTMLInputElement {
      const row = [...container.querySelectorAll('.dt-filter-list .dt-dd-item')].find((el) =>
        el.textContent?.includes(name),
      )!
      return row.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    }
    function click(el: HTMLElement, shiftKey = false): void {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey }))
    }
    // Bob -> excluded (two plain clicks: neutral -> include -> exclude).
    click(checkboxFor('Bob'))
    click(checkboxFor('Bob'))
    // Clara included first (becomes anchor momentarily), then Alice included (now the anchor) —
    // so a subsequent shift-click on Clara ranges Alice..Clara, sweeping over Bob in between
    // (checklist is alphabetized: Alice, Bob, Clara, David).
    click(checkboxFor('Clara'))
    click(checkboxFor('Alice'))
    expect(table.filter.exclude().name).toEqual(new Set(['Bob']))
    // Clara is already included, so this shift-click's target-based direction deselects the range.
    click(checkboxFor('Clara'), true)
    expect(table.filter.include().name?.has('Alice')).toBe(false)
    expect(table.filter.include().name?.has('Clara')).toBe(false)
    // Bob's exclude flag must survive a deselecting range sweep over it.
    expect(table.filter.exclude().name).toEqual(new Set(['Bob']))
    dispose()
  })
})

describe('FilterDropdown — left pane search', () => {
  it('narrows the column list by label', () => {
    const { container, dispose } = mount()
    const search = container.querySelector<HTMLInputElement>('.dt-filter-cols-search')!
    search.value = 'sco'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const labels = [...container.querySelectorAll('.dt-filter-col-item span')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Score'])
    dispose()
  })

  it('also matches by category, surfacing every column filed under it', () => {
    const { container, dispose } = mountCategorized()
    const search = container.querySelector<HTMLInputElement>('.dt-filter-cols-search')!
    search.value = 'Org'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const labels = [...container.querySelectorAll('.dt-filter-col-item span')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Dept', 'Score']) // neither label contains "Org" — only category does
    dispose()
  })
})

describe('FilterDropdown — Escape clears the right search box', () => {
  it("clears the active column's value search when focus is inside the detail pane", () => {
    const { container, dispose } = mount()
    selectCol(container, 'Name')
    const valueSearch = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    valueSearch.value = '9'
    valueSearch.dispatchEvent(new Event('input', { bubbles: true }))
    valueSearch.focus()
    valueSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(valueSearch.value).toBe('')
    dispose()
  })

  // Regression: onEscapeClearable used to check only `activeCol()`'s own search term, with no
  // check on where focus actually was — so Escape pressed anywhere else in the panel (e.g. a
  // left-pane column button) could still silently clear the selected column's value search.
  it('does not clear the value search when focus is elsewhere in the panel (e.g. the left pane)', () => {
    const { container, dispose } = mount()
    selectCol(container, 'Name')
    const valueSearch = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    valueSearch.value = '9'
    valueSearch.dispatchEvent(new Event('input', { bubbles: true }))
    const scoreColBtn = [
      ...container.querySelectorAll<HTMLButtonElement>('.dt-filter-col-item'),
    ].find((b) => b.textContent?.includes('Name'))!
    scoreColBtn.focus()
    scoreColBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(valueSearch.value).toBe('9') // untouched
    dispose()
  })
})

describe('FilterDropdown — date tree formatting and controls', () => {
  it('renders month nodes as a localized month name, not a raw zero-padded number', () => {
    const { container, dispose } = mount()
    selectCol(container, 'Joined')
    const yearToggle = container.querySelector<HTMLElement>('.dt-date-tree-toggle--branch')!
    yearToggle.click() // expand the first year node to reveal its month children
    const monthLabels = [...container.querySelectorAll('.dt-date-tree-item .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(monthLabels).toContain('January')
    expect(monthLabels).not.toContain('01')
    dispose()
  })

  it('has its own select-all checkbox and value search box, same as the string checklist', () => {
    const { container, table, dispose } = mount()
    selectCol(container, 'Joined')
    const searchRow = container.querySelector('.dt-filter-search-row')!
    expect(searchRow.querySelector('input[type="checkbox"]')).not.toBeNull()
    const search = searchRow.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'nomatch'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelectorAll('.dt-date-tree-item')).toHaveLength(0)
    search.value = ''
    search.dispatchEvent(new Event('input', { bubbles: true }))
    searchRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    expect(table.filter.include().joined?.size).toBeGreaterThan(0)
    dispose()
  })
})

describe('FilterDropdown — renderFilterLabel', () => {
  it('renders the custom node instead of the plain value in the checklist', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'dept',
        label: 'Dept',
        filterable: true,
        renderFilterLabel: (v) => {
          const span = document.createElement('span')
          span.dataset.custom = v
          span.textContent = v.toUpperCase()
          return span
        },
      },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, cols)
      render(
        () => (
          <FilterDropdown
            table={table}
            columns={cols}
            isOpen={true}
            onToggle={() => {}}
            onClose={() => {}}
          />
        ),
        container,
      )
      return d
    })
    const engRow = [...container.querySelectorAll('.dt-filter-list .dt-dd-item')].find((el) =>
      el.querySelector('[data-custom="Eng"]'),
    )!
    expect(engRow).toBeDefined()
    expect(engRow.querySelector('[data-custom="Eng"]')!.textContent).toBe('ENG')
    dispose()
  })
})

describe('FilterDropdown — any/all match-mode toggle', () => {
  interface GameRow {
    id: number
    name: string
    tags: string[]
  }
  const GAME_COLS: ColumnDef<GameRow>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'tags', label: 'Tags', filterable: true },
  ]
  const GAMES: GameRow[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
    { id: 3, name: 'Game C', tags: ['RPG'] },
  ]

  function mountGames() {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let table!: ReturnType<typeof createTableState<GameRow>>
    const dispose = createRoot((d) => {
      table = createTableState(GAMES, GAME_COLS)
      const [isOpen, setIsOpen] = createSignal(true)
      render(
        () => (
          <FilterDropdown
            table={table}
            columns={GAME_COLS}
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

  it('is shown as a segmented Any/All control for an array-valued column, both options always present', () => {
    const { container, table, dispose } = mountGames()
    selectCol(container, 'Tags')
    const [anyBtn, allBtn] = [
      ...container.querySelectorAll<HTMLButtonElement>('.dt-filter-match-mode'),
    ]
    expect(anyBtn?.textContent).toBe('Any')
    expect(allBtn?.textContent).toBe('All')
    // "Any" (the default) starts engaged, "All" doesn't — neither is a passive non-state, so
    // both remain visible the whole time, unlike a single button whose label/state would change.
    expect(anyBtn.getAttribute('aria-pressed')).toBe('true')
    expect(anyBtn.classList.contains('dt-filter-match-mode--active')).toBe(true)
    expect(allBtn.getAttribute('aria-pressed')).toBe('false')
    expect(allBtn.classList.contains('dt-filter-match-mode--active')).toBe(false)

    table.filter.setValues('tags', ['Action', 'RPG'], true)
    allBtn.click()
    expect(table.filter.modes().tags).toBe('and')
    expect(table.processedData().map((r) => r.name)).toEqual(['Game A'])
    expect(anyBtn.getAttribute('aria-pressed')).toBe('false')
    expect(anyBtn.classList.contains('dt-filter-match-mode--active')).toBe(false)
    expect(allBtn.getAttribute('aria-pressed')).toBe('true')
    expect(allBtn.classList.contains('dt-filter-match-mode--active')).toBe(true)

    // Clicking "Any" again sets it back directly (not a re-click-to-cycle-back toggle).
    anyBtn.click()
    expect(table.filter.modes().tags).toBe('or')
    dispose()
  })

  it('the sort-order toggle button has a title/aria-label, matching React/Vue', () => {
    const { container, dispose } = mountGames()
    selectCol(container, 'Tags')
    const sortBtn = [...container.querySelectorAll<HTMLButtonElement>('.dt-value-sort-btn')].find(
      (b) => !b.classList.contains('dt-filter-match-mode'),
    )!
    expect(sortBtn).not.toBeUndefined()
    expect(sortBtn.getAttribute('aria-label')).toBeTruthy()
    expect(sortBtn.getAttribute('title')).toBeTruthy()
    dispose()
  })

  it('is not shown for a plain scalar column', () => {
    const { container, dispose } = mountGames()
    selectCol(container, 'Name')
    expect(container.querySelector('.dt-filter-match-mode')).toBeNull()
    dispose()
  })
})

describe('FilterDropdown — checklist virtualization', () => {
  interface BigRow {
    id: number
    tag: string
  }
  const BIG_COLS: ColumnDef<BigRow>[] = [{ key: 'tag', label: 'Tag', filterable: true }]
  // 500 distinct values — comfortably more than fit in the 260px/32px-row viewport plus overscan.
  const BIG_ROWS: BigRow[] = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    tag: `Tag ${String(i).padStart(3, '0')}`,
  }))

  function mountBig() {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let table!: ReturnType<typeof createTableState<BigRow>>
    const dispose = createRoot((d) => {
      table = createTableState(BIG_ROWS, BIG_COLS)
      const [isOpen, setIsOpen] = createSignal(true)
      render(
        () => (
          <FilterDropdown
            table={table}
            columns={BIG_COLS}
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

  it('only mounts a window of rows, not all 500', () => {
    const { container, dispose } = mountBig()
    const mounted = container.querySelectorAll('input[data-dd-value-row]').length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(500)
    dispose()
  })

  it('the spacer div reports the full (unwindowed) list height', () => {
    const { container, dispose } = mountBig()
    const spacer = container.querySelector<HTMLDivElement>('.dt-filter-list > div')!
    expect(spacer.style.height).toBe(`${500 * 32}px`)
    dispose()
  })

  it('End reaches the logical last value even though it is outside the initially-mounted window', () => {
    const { container, dispose } = mountBig()
    const search = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    search.focus()
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement?.getAttribute('data-value')).toBe('Tag 499')
    dispose()
  })

  it('select-all and shift-range still operate on the full list, not just the mounted window', () => {
    const { container, table, dispose } = mountBig()
    const selectAll = container.querySelector<HTMLInputElement>(
      '.dt-filter-search-row input[type="checkbox"]',
    )!
    selectAll.click()
    expect(table.filter.include().tag?.size).toBe(500)
    dispose()
  })
})

describe('FilterDropdown — clear', () => {
  it('the clear-filters × button appears once any filter is active and clears all', () => {
    const { container, table, dispose } = mount()
    expect(container.querySelector('.dt-btn-clear')).toBeNull()
    table.filter.cycleValue('name', 'Alice')
    const clearBtn = container.querySelector<HTMLButtonElement>('.dt-btn-clear')
    expect(clearBtn).not.toBeNull()
    clearBtn!.click()
    expect(table.filter.activeCount()).toBe(0)
    dispose()
  })
})
