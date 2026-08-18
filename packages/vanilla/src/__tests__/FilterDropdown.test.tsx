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
    table.cycleFilterValue('name', 'Alice')
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
    expect(table.filters().name).toEqual(new Set(['Alice']))
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(table.excludeFilters().name).toEqual(new Set(['Alice']))
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(table.filters().name).toEqual(new Set())
    expect(table.excludeFilters().name).toEqual(new Set())
    dispose()
  })

  it('select-all toggles every currently-listed value', () => {
    const { container, table, dispose } = mount()
    const selectAll = container.querySelector<HTMLInputElement>(
      '.dt-filter-search-row input[type="checkbox"]',
    )!
    selectAll.click()
    expect(table.filters().name).toEqual(new Set(['Alice', 'Bob', 'Clara', 'David']))
    selectAll.click()
    expect(table.filters().name).toEqual(new Set())
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
    expect(table.rangeFilters().score?.min).toBe('75')
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
    expect(table.rangeFilters().score?.min).toBe('75')
    expect(table.rangeFilters().score?.max).toBe('90')
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
    expect(table.filters().joined).toEqual(new Set(['2023-01-15', '2023-06-20']))
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

describe('FilterDropdown — clear', () => {
  it('the clear-filters × button appears once any filter is active and clears all', () => {
    const { container, table, dispose } = mount()
    expect(container.querySelector('.dt-btn-clear')).toBeNull()
    table.cycleFilterValue('name', 'Alice')
    const clearBtn = container.querySelector<HTMLButtonElement>('.dt-btn-clear')
    expect(clearBtn).not.toBeNull()
    clearBtn!.click()
    expect(table.activeFilterCount()).toBe(0)
    dispose()
  })
})
