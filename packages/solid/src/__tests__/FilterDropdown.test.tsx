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
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS)
    const [isOpen, setIsOpen] = createSignal(true)
    render(
      () => (
        <FilterDropdown
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

  it('shows a dot marker for a column with an active filter', () => {
    const { container, table, dispose } = mount()
    table.filter.cycleValue('name', 'Alice')
    const nameBtn = [...container.querySelectorAll('.dt-filter-col-item')].find((b) =>
      b.textContent?.includes('Name'),
    )!
    expect(nameBtn.querySelector('.dt-filter-col-dot')).not.toBeNull()
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
