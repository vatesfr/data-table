import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { DataTable } from '../DataTable'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score', type: 'number' },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90 },
  { id: 2, name: 'Bob', score: 60 },
]

afterEach(cleanup)

describe('DataTable — onRowClick', () => {
  it('calls onRowClick with the row and the click event', () => {
    const onRowClick = vi.fn()
    const { getByText } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" onRowClick={onRowClick} />,
    )
    fireEvent.click(getByText('Alice'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toEqual(ROWS[0])
  })

  it('does not set a pointer cursor when onRowClick is not passed', () => {
    const { container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    const row = container.querySelector<HTMLElement>('tbody tr')!
    expect(row.style.cursor).not.toBe('pointer')
  })

  it('clicking the selection checkbox does not trigger onRowClick', () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" selectable onRowClick={onRowClick} />,
    )
    const checkbox = container.querySelector('tbody tr input[type="checkbox"]')!
    fireEvent.click(checkbox)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('highlights the row on hover and clears it on mouse leave', () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" onRowClick={vi.fn()} />,
    )
    const row = container.querySelector<HTMLElement>('tbody tr')!
    expect(row.style.background).not.toBe('var(--color-background-secondary)')
    fireEvent.mouseEnter(row)
    expect(row.style.background).toBe('var(--color-background-secondary)')
    fireEvent.mouseLeave(row)
    expect(row.style.background).not.toBe('var(--color-background-secondary)')
  })

  it('does not highlight on hover when onRowClick is not passed', () => {
    const { container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    const row = container.querySelector<HTMLElement>('tbody tr')!
    fireEvent.mouseEnter(row)
    expect(row.style.background).not.toBe('var(--color-background-secondary)')
  })

  it('keeps the selected background on hover instead of the hover color', () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" selectable onRowClick={vi.fn()} />,
    )
    const checkbox = container.querySelector<HTMLInputElement>('tbody tr input[type="checkbox"]')!
    fireEvent.click(checkbox)
    const row = container.querySelector<HTMLElement>('tbody tr')!
    fireEvent.mouseEnter(row)
    expect(row.style.background).toBe('var(--color-background-info)')
  })
})

describe('DataTable — filter dropdown', () => {
  const FILTER_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'score', label: 'Score', type: 'number', filterable: true },
  ]

  // Checklist items are rendered as <label> (distinct from the always-present <td> row cells
  // sharing the same text), so scope assertions to labels to avoid matching table body cells.
  function checklistLabels(container: HTMLElement): string[] {
    return [...container.querySelectorAll('label')].map((l) => l.textContent ?? '')
  }

  it('defaults the detail pane to the first filterable column', () => {
    const { getByText, container, queryByPlaceholderText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(checklistLabels(container).some((t) => t.includes('Alice'))).toBe(true)
    expect(queryByPlaceholderText('Min')).toBeNull()
  })

  it('clicking a column in the list switches the detail pane to it', () => {
    const { getByText, getAllByText, container, getByPlaceholderText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    expect(getByPlaceholderText('Min')).toBeTruthy()
    expect(checklistLabels(container)).toHaveLength(0)
  })

  it('select-all checkbox selects every currently listed value', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Select all'))
    expect((getByLabelText('Alice', { exact: false }) as HTMLInputElement).checked).toBe(true)
    expect((getByLabelText('Bob', { exact: false }) as HTMLInputElement).checked).toBe(true)
  })

  it('select-all checkbox deselects every value when all are already selected', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Select all'))
    fireEvent.click(getByLabelText('Select all'))
    expect((getByLabelText('Alice', { exact: false }) as HTMLInputElement).checked).toBe(false)
    expect((getByLabelText('Bob', { exact: false }) as HTMLInputElement).checked).toBe(false)
  })

  it('the Filter toolbar button has no clear-filters button until a filter is active', () => {
    const { queryByTitle } = render(<DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />)
    expect(queryByTitle('Clear filters')).toBeNull()
  })

  it('the toolbar clear-filters button clears all filters without opening the dropdown', () => {
    const { getByLabelText, getByTitle, container, queryByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    const filterToggle = () =>
      [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Filter'))!
    fireEvent.click(filterToggle())
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    fireEvent.click(filterToggle()) // close it

    fireEvent.click(getByTitle('Clear filters'))
    expect(queryByLabelText('Select all')).toBeNull() // still closed, not reopened by the click
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('select-all checkbox only affects the search-narrowed values', () => {
    const { getByText, getAllByPlaceholderText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    // The global toolbar search box shares this same default placeholder and now sits before
    // the Filter dropdown in the DOM (see the toolbar's shape/find cluster order) — the filter's
    // own per-column search box is the last "Search…" match, not the first.
    const searchInputs = getAllByPlaceholderText('Search…')
    const filterSearchInput = searchInputs[searchInputs.length - 1]
    fireEvent.change(filterSearchInput, { target: { value: 'ali' } })
    fireEvent.click(getByLabelText('Select all'))
    expect((getByLabelText('Alice', { exact: false }) as HTMLInputElement).checked).toBe(true)
    fireEvent.change(filterSearchInput, { target: { value: '' } })
    expect((getByLabelText('Bob', { exact: false }) as HTMLInputElement).checked).toBe(false)
  })

  it('select-all checkbox is indeterminate when only some listed values are selected', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    expect((getByLabelText('Select all') as HTMLInputElement).indeterminate).toBe(true)
  })

  it('hides the select-all checkbox when search matches no values', () => {
    const { getByText, getAllByPlaceholderText, queryByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    // The global toolbar search box shares this same default placeholder and now sits before
    // the Filter dropdown in the DOM (see the toolbar's shape/find cluster order) — the filter's
    // own per-column search box is the last "Search…" match, not the first.
    const searchInputs = getAllByPlaceholderText('Search…')
    const filterSearchInput = searchInputs[searchInputs.length - 1]
    fireEvent.change(filterSearchInput, { target: { value: 'zzz' } })
    expect(queryByLabelText('Select all')).toBeNull()
    expect(filterSearchInput).toBeTruthy()
  })

  it('hides a value with zero rows matching under other active filters', () => {
    interface Row2 {
      id: number
      name: string
      dept: string
    }
    const COLS2: ColumnDef<Row2>[] = [
      { key: 'name', label: 'Name', filterable: true },
      { key: 'dept', label: 'Dept', filterable: true },
    ]
    const ROWS2: Row2[] = [
      { id: 1, name: 'Alice', dept: 'Eng' },
      { id: 2, name: 'Bob', dept: 'HR' },
    ]
    const { getByText, getAllByText, getByLabelText, queryByLabelText } = render(
      <DataTable data={ROWS2} columns={COLS2} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    const deptItem = getAllByText('Dept').find((el) => el.closest('th') === null)!
    fireEvent.click(deptItem)
    expect(getByLabelText('Eng', { exact: false })).toBeTruthy()
    expect(queryByLabelText('HR', { exact: false })).toBeNull()
  })

  it('keeps a selected value visible even when its live count drops to 0', () => {
    interface Row2 {
      id: number
      name: string
      dept: string
      score: number
    }
    const COLS2: ColumnDef<Row2>[] = [
      { key: 'name', label: 'Name', filterable: true },
      { key: 'dept', label: 'Dept', filterable: true },
      { key: 'score', label: 'Score', type: 'number', filterable: true },
    ]
    const ROWS2: Row2[] = [
      { id: 1, name: 'Alice', dept: 'Eng', score: 90 },
      { id: 2, name: 'Bob', dept: 'HR', score: 60 },
    ]
    const { getByText, getAllByText, getByLabelText, getByPlaceholderText } = render(
      <DataTable data={ROWS2} columns={COLS2} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const deptItem = getAllByText('Dept').find((el) => el.closest('th') === null)!
    fireEvent.click(deptItem)
    // Select dept=HR (Bob) while it's still the only active filter, so it's visible to check.
    fireEvent.click(getByLabelText('HR', { exact: false }))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    // A min-score range filter that excludes Bob (score 60) zeroes HR's live facet count —
    // range filters, unlike a column's own checklist filter, are never excluded from a facet.
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '100' } })
    fireEvent.click(deptItem)
    expect((getByLabelText('HR', { exact: false }) as HTMLInputElement).checked).toBe(true)
  })

  it('search narrows the checklist to matching values', () => {
    const { getByText, getAllByPlaceholderText, container } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    // The toolbar's global row search shares the same "Search…" placeholder as the
    // per-column filter search — the filter one renders first in the DOM.
    // The global toolbar search box shares this same default placeholder and now sits before
    // the Filter dropdown in the DOM (see the toolbar's shape/find cluster order) — the filter's
    // own per-column search box is the last "Search…" match, not the first.
    const searchInputs = getAllByPlaceholderText('Search…')
    const filterSearchInput = searchInputs[searchInputs.length - 1]
    fireEvent.change(filterSearchInput, { target: { value: 'ali' } })
    const labels = checklistLabels(container)
    expect(labels.some((t) => t.includes('Alice'))).toBe(true)
    expect(labels.some((t) => t.includes('Bob'))).toBe(false)
  })

  it('shift-clicking a checklist value selects the range from the last-clicked value', () => {
    const ROWS4: Row[] = [
      { id: 1, name: 'Alice', score: 90 },
      { id: 2, name: 'Bob', score: 60 },
      { id: 3, name: 'Clara', score: 80 },
      { id: 4, name: 'David', score: 70 },
    ]
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS4} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    fireEvent.click(getByLabelText('Clara', { exact: false }), { shiftKey: true })
    expect((getByLabelText('Alice', { exact: false }) as HTMLInputElement).checked).toBe(true)
    expect((getByLabelText('Bob', { exact: false }) as HTMLInputElement).checked).toBe(true)
    expect((getByLabelText('Clara', { exact: false }) as HTMLInputElement).checked).toBe(true)
    expect((getByLabelText('David', { exact: false }) as HTMLInputElement).checked).toBe(false)
  })

  it('shift-clicking an already-selected checklist value deselects the range', () => {
    const ROWS4: Row[] = [
      { id: 1, name: 'Alice', score: 90 },
      { id: 2, name: 'Bob', score: 60 },
      { id: 3, name: 'Clara', score: 80 },
      { id: 4, name: 'David', score: 70 },
    ]
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS4} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Select all'))
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    fireEvent.click(getByLabelText('Clara', { exact: false }), { shiftKey: true })
    expect((getByLabelText('Alice', { exact: false }) as HTMLInputElement).checked).toBe(false)
    expect((getByLabelText('Bob', { exact: false }) as HTMLInputElement).checked).toBe(false)
    expect((getByLabelText('Clara', { exact: false }) as HTMLInputElement).checked).toBe(false)
    expect((getByLabelText('David', { exact: false }) as HTMLInputElement).checked).toBe(true)
  })

  it("renders a range slider with bounds matching the numeric column's actual min/max", () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    const thumbs = container.querySelectorAll<HTMLInputElement>('input[type="range"]')
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0].min).toBe('60')
    expect(thumbs[0].max).toBe('90')
    expect(thumbs[0].value).toBe('60')
    expect(thumbs[1].value).toBe('90')
  })

  it("defaults the plain min/max inputs to the column's data bounds when no filter is set", () => {
    const { getByText, getAllByText, getByPlaceholderText, container } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    expect((getByPlaceholderText('Min') as HTMLInputElement).value).toBe('60') // Bob
    expect((getByPlaceholderText('Max') as HTMLInputElement).value).toBe('90') // Alice
    // Bounds are a display-only default — no filter is actually active yet.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(scoreItem.parentElement?.querySelectorAll('span')).toHaveLength(1) // no dot
  })

  it('dragging a slider thumb updates the plain min/max inputs and filters rows', () => {
    const { getByText, getAllByText, getByPlaceholderText, container } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    const thumbs = container.querySelectorAll<HTMLInputElement>('input[type="range"]')
    fireEvent.change(thumbs[0], { target: { value: '75' } })
    expect((getByPlaceholderText('Min') as HTMLInputElement).value).toBe('75')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1) // only Alice (90) remains
  })

  it('marks the column with a clear button and an active-bar chip once a range filter is set', () => {
    const { getByText, getAllByText, getByPlaceholderText, container } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    // The clear button is a sibling <button> of the column button, rendered only when the
    // column has an active filter — before this fix a range-only filter left it with no clear
    // button at all, even though the range itself was active.
    const row = scoreItem.closest('[data-filter-row-key]')!
    expect(row.querySelectorAll('button')).toHaveLength(2)
    const chip = [...container.querySelectorAll('span')].find((el) =>
      el.textContent?.includes('Score: 80'),
    )
    expect(chip).toBeTruthy()
  })

  it("clicking a range filter's active-bar chip clears it and unfilters the rows", () => {
    const { getByText, getAllByText, getByPlaceholderText, container } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreItem = getAllByText('Score').find((el) => el.closest('th') === null)!
    fireEvent.click(scoreItem)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1) // only Alice (90)
    // The × is now a real <button> (a sibling of the chip's own body button, not nested inside
    // it — a <button> can't contain another interactive element) — see "Active-bar chip click
    // actions".
    const chipX = [...container.querySelectorAll('span')]
      .find((el) => el.textContent?.trim().startsWith('Score: 80'))!
      .querySelector('button:last-child')!
    fireEvent.click(chipX)
    expect((getByPlaceholderText('Min') as HTMLInputElement).value).toBe('')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })
})

describe('DataTable — exclude filters (tri-state checklist)', () => {
  interface Game {
    id: number
    name: string
    tags: string[]
  }
  const GAME_COLS: ColumnDef<Game>[] = [
    { key: 'name', label: 'Name', filterable: false },
    { key: 'tags', label: 'Tags', filterable: true },
  ]
  const GAMES: Game[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
  ]

  function names(container: HTMLElement): string[] {
    return [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent ?? '',
    )
  }

  it('a plain click cycles a value through neutral -> include -> exclude -> neutral', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={GAMES} columns={GAME_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const rpg = () => getByLabelText('RPG', { exact: false }) as HTMLInputElement

    fireEvent.click(rpg())
    expect(rpg().checked).toBe(true)
    expect(rpg().indeterminate).toBe(false)
    expect(names(container)).toEqual(['Game A'])

    fireEvent.click(rpg())
    expect(rpg().checked).toBe(false)
    expect(rpg().indeterminate).toBe(true)
    expect(names(container)).toEqual(['Game B']) // Game A has RPG, now excluded

    fireEvent.click(rpg())
    expect(rpg().checked).toBe(false)
    expect(rpg().indeterminate).toBe(false)
    expect(names(container)).toEqual(['Game A', 'Game B'])
  })

  it('renders an exclude filter as its own chip, distinct from an include chip', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={GAMES} columns={GAME_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const rpg = () => getByLabelText('RPG', { exact: false }) as HTMLInputElement
    fireEvent.click(rpg())
    fireEvent.click(rpg()) // include -> exclude

    // Chips (in the active bar) render "Tags: value list" as their button's own text — scoped
    // this way to avoid matching a checklist row's own <span>{v}</span>, which just holds the
    // bare value with no "Tags:" prefix (same convention the range-filter chip tests above use).
    const chip = [...container.querySelectorAll('span')].find((el) =>
      el.textContent?.trim().startsWith('Tags: ≠'),
    )
    expect(chip).toBeTruthy()
    expect(chip!.textContent).toContain('RPG')
  })

  it("clearing an include chip on a column doesn't clear that same column's exclude chip, and vice versa", () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={GAMES} columns={GAME_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const action = () => getByLabelText('Action', { exact: false }) as HTMLInputElement
    const rpg = () => getByLabelText('RPG', { exact: false }) as HTMLInputElement
    fireEvent.click(action()) // include Action
    fireEvent.click(rpg())
    fireEvent.click(rpg()) // include -> exclude RPG

    const includeChip = [...container.querySelectorAll('span')].find((el) =>
      el.textContent?.trim().startsWith('Tags: Action'),
    )!
    const includeChipX = includeChip.querySelector('button:last-child')!
    fireEvent.click(includeChipX)

    expect(
      [...container.querySelectorAll('span')].some((el) =>
        el.textContent?.trim().startsWith('Tags: Action'),
      ),
    ).toBe(false)
    expect(rpg().indeterminate).toBe(true) // exclude untouched

    const excludeChip = [...container.querySelectorAll('span')].find((el) =>
      el.textContent?.trim().startsWith('Tags: ≠'),
    )!
    const excludeChipX = excludeChip.querySelector('button:last-child')!
    fireEvent.click(excludeChipX)
    expect(action().checked).toBe(false) // include stays cleared, not resurrected
  })

  it('select-all moves listed values into the include set, clearing any that were excluded', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={GAMES} columns={GAME_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const rpg = () => getByLabelText('RPG', { exact: false }) as HTMLInputElement
    fireEvent.click(rpg())
    fireEvent.click(rpg()) // include -> exclude

    fireEvent.click(getByLabelText('Select all'))
    expect(rpg().checked).toBe(true)
    expect(rpg().indeterminate).toBe(false)
  })

  it("select-all's deselect branch only clears the include set, leaving an unrelated exclude untouched", () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={GAMES} columns={GAME_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const action = () => getByLabelText('Action', { exact: false }) as HTMLInputElement
    const rpg = () => getByLabelText('RPG', { exact: false }) as HTMLInputElement
    fireEvent.click(action()) // include Action
    fireEvent.click(rpg())
    fireEvent.click(rpg()) // include -> exclude RPG

    expect((getByLabelText('Select all') as HTMLInputElement).indeterminate).toBe(true)
    fireEvent.click(getByLabelText('Select all'))

    expect(action().checked).toBe(false)
    expect(rpg().checked).toBe(false)
    expect(rpg().indeterminate).toBe(true)
    expect(names(container)).toEqual(['Game B'])
  })
})

describe('DataTable — any/all filter match mode', () => {
  interface Game {
    id: number
    name: string
    tags: string[]
  }
  const GAME_COLS: ColumnDef<Game>[] = [
    { key: 'name', label: 'Name', filterable: false },
    { key: 'tags', label: 'Tags', filterable: true },
  ]
  const GAMES: Game[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
    { id: 3, name: 'Game C', tags: ['RPG'] },
  ]

  function names(container: HTMLElement): string[] {
    return [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent ?? '',
    )
  }

  it('is shown as a segmented Any/All control for an array-valued column, both options always present', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={GAMES} columns={GAME_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const anyBtn = getByText('Any') as HTMLButtonElement
    const allBtn = getByText('All') as HTMLButtonElement
    // "Any" (the default) starts engaged, "All" doesn't — neither is a passive non-state, so
    // both remain visible the whole time, unlike a single button whose label/state would change.
    expect(anyBtn.getAttribute('aria-pressed')).toBe('true')
    expect(allBtn.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(getByLabelText('Action', { exact: false }))
    fireEvent.click(getByLabelText('RPG', { exact: false }))
    expect(names(container).sort()).toEqual(['Game A', 'Game B', 'Game C'])

    fireEvent.click(allBtn)
    expect(anyBtn.getAttribute('aria-pressed')).toBe('false')
    expect(allBtn.getAttribute('aria-pressed')).toBe('true')
    expect(names(container)).toEqual(['Game A'])

    // Clicking "Any" again sets it back directly (not a re-click-to-cycle-back toggle).
    fireEvent.click(anyBtn)
    expect(names(container).sort()).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('is not shown for a plain scalar column', () => {
    const cols: ColumnDef<Game>[] = [{ key: 'name', label: 'Name', filterable: true }]
    const { getByText, queryByText } = render(<DataTable data={GAMES} columns={cols} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    expect(queryByText('Any')).toBeNull()
    expect(queryByText('All')).toBeNull()
  })

  it("flipping one column's match mode updates another column's facet counts", () => {
    const cols: ColumnDef<Game>[] = [
      { key: 'name', label: 'Name', filterable: true },
      { key: 'tags', label: 'Tags', filterable: true },
    ]
    const { getByText, getByLabelText, queryByLabelText, container } = render(
      <DataTable data={GAMES} columns={cols} rowKey="id" />,
    )
    const selectCol = (key: string) =>
      fireEvent.click(container.querySelector(`[data-filter-col-key="${key}"]`)!)

    fireEvent.click(getByText('Filter'))
    selectCol('tags')
    fireEvent.click(getByLabelText('Action', { exact: false }))
    fireEvent.click(getByLabelText('RPG', { exact: false }))

    fireEvent.click(getByText('All'))
    selectCol('name')
    // Only Game A has both Action and RPG, so Game B/C never match the "all" narrowing and
    // drop out of Name's faceted checklist entirely.
    expect(queryByLabelText('Game B', { exact: false })).toBeNull()

    selectCol('tags')
    fireEvent.click(getByText('Any'))
    selectCol('name')
    expect(queryByLabelText('Game B', { exact: false })).not.toBeNull()
  })
})

describe('DataTable — virtualized filter checklist', () => {
  const MANY_COLS: ColumnDef<Row>[] = [{ key: 'name', label: 'Name', filterable: true }]
  const MANY_ROWS: Row[] = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    name: `Value ${String(i).padStart(4, '0')}`,
    score: i,
  }))

  function scrollableList(container: HTMLElement): HTMLElement {
    // The checklist fills its available height via `flex: 1` (see filterList in
    // DataTableView.tsx) rather than a fixed inline height, so `.style.flex` alone can't
    // disambiguate it from `.filterCols` (also `overflowY: 'auto'` — and jsdom's CSSOM reports a
    // non-empty `.style.flex` for it too, derived from its own `flexShrink: 0`). Its structural
    // signature is more reliable: the checklist's only child is the totalHeight spacer
    // (`position: relative`) used by the windowing math, which `.filterCols` has no equivalent of.
    const el = [...container.querySelectorAll<HTMLElement>('div')].find(
      (d) =>
        d.style.overflowY === 'auto' &&
        d.firstElementChild instanceof HTMLElement &&
        d.firstElementChild.style.position === 'relative',
    )
    if (!el) throw new Error('virtualized checklist container not found')
    return el
  }

  it('only mounts the rows scrolled into view, not every distinct value', () => {
    const { container, getByText } = render(
      <DataTable data={MANY_ROWS} columns={MANY_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const checkboxes = container.querySelectorAll(
      '.dt-filter-list-item, label input[type="checkbox"]',
    )
    // 500 distinct names exist, but only a small window (viewport/rowHeight + overscan) mounts.
    expect(checkboxes.length).toBeGreaterThan(0)
    expect(checkboxes.length).toBeLessThan(50)
  })

  it('renders a different slice of values after scrolling', async () => {
    const { container, getByText, queryByLabelText } = render(
      <DataTable data={MANY_ROWS} columns={MANY_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(queryByLabelText('Value 0000', { exact: false })).toBeTruthy()

    const list = scrollableList(container)
    fireEvent.scroll(list, { target: { scrollTop: 32 * 200 } })
    // scrollTop updates are throttled via requestAnimationFrame before the re-render.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(queryByLabelText('Value 0000', { exact: false })).toBeNull()
    expect(queryByLabelText('Value 0200', { exact: false })).toBeTruthy()
  })

  it('select-all still selects every matching value, not just the rendered window', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={MANY_ROWS} columns={MANY_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Select all'))
    expect(getByText(`500 / 500 rows`)).toBeTruthy()
  })
})

describe('DataTable — filter value sort', () => {
  interface TagRow {
    id: number
    name: string
    tags: string[]
  }
  const TAG_COLS: ColumnDef<TagRow>[] = [
    { key: 'name', label: 'Name', filterable: false },
    { key: 'tags', label: 'Tags', filterable: true },
  ]
  // Action=2, Adventure=1, RPG=1
  const TAG_ROWS: TagRow[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
  ]

  function checklistValueOrder(container: HTMLElement): string[] {
    return [...container.querySelectorAll('label')]
      .map((l) => l.textContent?.match(/^[A-Za-z]+/)?.[0])
      .filter((v): v is string => !!v)
  }

  it('sorts checklist values alphabetically ascending by default', () => {
    const { getByText, container } = render(
      <DataTable data={TAG_ROWS} columns={TAG_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(checklistValueOrder(container)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('cycles to alphabetical descending on the first click', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={TAG_ROWS} columns={TAG_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Sort values'))
    expect(checklistValueOrder(container)).toEqual(['RPG', 'Adventure', 'Action'])
  })

  it('cycles to count descending (tie-broken alphabetically) on the second click', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={TAG_ROWS} columns={TAG_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Sort values'))
    fireEvent.click(getByLabelText('Sort values'))
    expect(checklistValueOrder(container)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('cycles to count ascending (tie-broken alphabetically) on the third click', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={TAG_ROWS} columns={TAG_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Sort values'))
    fireEvent.click(getByLabelText('Sort values'))
    fireEvent.click(getByLabelText('Sort values'))
    expect(checklistValueOrder(container)).toEqual(['Adventure', 'RPG', 'Action'])
  })

  it('cycles back to alphabetical ascending on the fourth click', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={TAG_ROWS} columns={TAG_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Sort values'))
    fireEvent.click(getByLabelText('Sort values'))
    fireEvent.click(getByLabelText('Sort values'))
    fireEvent.click(getByLabelText('Sort values'))
    expect(checklistValueOrder(container)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it("starts at a column's defaultValueSort instead of alpha-ascending", () => {
    const cols: ColumnDef<TagRow>[] = [
      {
        key: 'tags',
        label: 'Tags',
        filterable: true,
        defaultValueSort: { by: 'alpha', dir: 'desc' },
      },
    ]
    const { getByText, getByLabelText, container } = render(
      <DataTable data={TAG_ROWS} columns={cols} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(checklistValueOrder(container)).toEqual(['RPG', 'Adventure', 'Action'])
    // The cycle still advances through all 4 states from that starting point — alpha-desc's next
    // state is count-desc.
    fireEvent.click(getByLabelText('Sort values'))
    expect(checklistValueOrder(container)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('toggles the date tree between chronologically ascending and descending', () => {
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
      { id: 2, name: 'Game C', released: '2021-01-02' },
    ]
    function yearOrder(container: HTMLElement): string[] {
      return [...container.querySelectorAll('label')]
        .map((l) => l.textContent?.match(/\d{4}/)?.[0])
        .filter((v): v is string => !!v)
    }
    const { getByText, getByLabelText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(yearOrder(container)).toEqual(['2021', '2023'])
    fireEvent.click(getByLabelText('Sort values'))
    expect(yearOrder(container)).toEqual(['2023', '2021'])
  })
})

describe('DataTable — date filter tree', () => {
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

  function toggleFor(container: HTMLElement, text: string): HTMLElement {
    const label = [...container.querySelectorAll('label')].find((l) =>
      l.textContent?.includes(text),
    )!
    return label.querySelector('span')!
  }

  // Day leaves render an empty arrow span (unlike year/month branches, which show ▶/▼), and
  // their visible day text has the hidden facet count digit glued onto it with no separator
  // (e.g. day "14" with a count of 1 renders as "141") — so an exact getByLabelText match never
  // works and a substring match collides with any year string containing the same digits (e.g.
  // "20" inside "2024"). Filtering to leaf rows first disambiguates cleanly.
  function dayCheckbox(container: HTMLElement, day: string): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find((l) => {
      const arrowText = l.querySelector('span')?.textContent ?? ''
      return arrowText === '' && l.textContent?.startsWith(day)
    })!
    return label.querySelector('input[type="checkbox"]') as HTMLInputElement
  }

  it('renders year nodes collapsed by default, with months hidden until expanded', () => {
    const { getByText, queryByText } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(getByText('2023')).toBeTruthy()
    expect(getByText('2021')).toBeTruthy()
    expect(queryByText('May')).toBeNull()
  })

  // Regression guard: the tree used to render with no wrapper at all — no height bound, no
  // overflow — so an expanded tree could bleed past the filter panel onto the page instead of
  // scrolling. It must now sit inside its own bounded, scrollable container (filterDateTreeWrap).
  it('bounds the date tree in a scrollable, flex-filling container', () => {
    const { getByText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const yearNode = getByText('2023')
    const wrap = [...container.querySelectorAll<HTMLElement>('div')].find(
      (d) => d.style.overflowY === 'auto' && d.contains(yearNode),
    )
    expect(wrap).toBeTruthy()
  })

  it('expanding a year reveals its months, expanding a month reveals its days', () => {
    const { getByText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(toggleFor(container, '2023'))
    expect(getByText('May')).toBeTruthy()
    fireEvent.click(toggleFor(container, 'May'))
    expect(getByText('14')).toBeTruthy()
    expect(getByText('20')).toBeTruthy()
  })

  it('checking a year node selects every date under it and filters rows accordingly', () => {
    const { getByText, getByLabelText, queryByText } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('2023', { exact: false }))
    expect(getByText('Game A')).toBeTruthy()
    expect(getByText('Game B')).toBeTruthy()
    expect(queryByText('Game C')).toBeNull()
  })

  it('unchecking an already fully-selected year deselects every date under it', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('2023', { exact: false }))
    fireEvent.click(getByLabelText('2023', { exact: false }))
    expect(getByText('Game C')).toBeTruthy()
  })

  it('is indeterminate on a month node when only some of its days are selected', () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(toggleFor(container, '2023'))
    fireEvent.click(toggleFor(container, 'May'))
    fireEvent.click(getByLabelText('14', { exact: false }))
    expect((getByLabelText('May', { exact: false }) as HTMLInputElement).indeterminate).toBe(true)
  })

  it('caps the active-filter chip at 3 values, summarizing the rest as "+N more"', () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-01-01' },
      { id: 2, name: 'Game B', released: '2023-02-01' },
      { id: 3, name: 'Game C', released: '2023-03-01' },
      { id: 4, name: 'Game D', released: '2023-04-01' },
    ]
    const { getByText, getByLabelText, container } = render(
      <DataTable data={rows} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('2023', { exact: false }))
    expect(container.textContent).toContain('2023-01-01, 2023-02-01, 2023-03-01, +1 more')
  })

  it('shift-clicking two day nodes selects the range between them, not other years', () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2023-05-20' },
      { id: 3, name: 'Game C', released: '2021-01-02' },
      { id: 4, name: 'Game D', released: '2024-07-01' },
    ]
    const { getByText, container, queryByText } = render(
      <DataTable data={rows} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(toggleFor(container, '2023'))
    fireEvent.click(toggleFor(container, 'May'))
    fireEvent.click(dayCheckbox(container, '14'))
    fireEvent.click(dayCheckbox(container, '20'), { shiftKey: true })
    expect(getByText('Game A')).toBeTruthy()
    expect(getByText('Game B')).toBeTruthy()
    expect(queryByText('Game C')).toBeNull()
    expect(queryByText('Game D')).toBeNull()
  })

  it('shift-clicking from a year down to a specific day does not pull in a later sibling day', () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2023-05-20' },
      { id: 3, name: 'Game C', released: '2021-01-02' },
      { id: 4, name: 'Game D', released: '2024-07-01' },
    ]
    const { getByText, getByLabelText, container, queryByText } = render(
      <DataTable data={rows} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(toggleFor(container, '2023'))
    fireEvent.click(toggleFor(container, 'May'))
    fireEvent.click(getByLabelText('2021', { exact: false }))
    fireEvent.click(dayCheckbox(container, '14'), { shiftKey: true })
    // The range is a chronological interval (2021-01-02 through 2023-05-14), not a sweep over
    // rendered rows — so day 20 (chronologically after the target) must stay excluded even
    // though the "2023" year row sits between the anchor and the target.
    expect(getByText('Game A')).toBeTruthy()
    expect(getByText('Game C')).toBeTruthy()
    expect(queryByText('Game B')).toBeNull()
    expect(queryByText('Game D')).toBeNull()
  })

  it('renders 2 native date inputs above the tree for a date column', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect((getByLabelText('Min') as HTMLInputElement).type).toBe('date')
    expect((getByLabelText('Max') as HTMLInputElement).type).toBe('date')
  })

  it("defaults the date inputs to the column's earliest/latest date when no filter is set", () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect((getByLabelText('Min') as HTMLInputElement).value).toBe('2021-01-02') // Game C
    expect((getByLabelText('Max') as HTMLInputElement).value).toBe('2023-05-20') // Game B
  })

  it('a date range narrows the tree itself and filters rows, without needing a checkbox ticked', () => {
    const { getByText, getByLabelText, queryByText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.change(getByLabelText('Min'), { target: { value: '2022-01-01' } })
    // The 2021 year (Game C) drops out of the tree entirely — narrowed like a search term, not
    // merely ANDed onto the final result once a checkbox is ticked.
    expect(queryByText('2021')).toBeNull()
    expect(getByText('2023')).toBeTruthy()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2) // Game A, Game B
  })

  it("a date range slider has epoch-based bounds matching the column's actual min/max date", () => {
    const { getByText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const thumbs = container.querySelectorAll<HTMLInputElement>('input[type="range"]')
    expect(thumbs).toHaveLength(2)
    expect(Number(thumbs[0].min)).toBe(new Date('2021-01-02').getTime())
    expect(Number(thumbs[0].max)).toBe(new Date('2023-05-20').getTime())
  })

  it('marks the date column with a clear button and an active-bar chip once a range filter is set, with no checkbox ticked', () => {
    const { getByText, getAllByText, getByLabelText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.change(getByLabelText('Min'), { target: { value: '2022-01-01' } })
    const releasedItem = getAllByText('Released').find((el) => el.closest('th') === null)!
    const row = releasedItem.closest('[data-filter-row-key]')!
    expect(row.querySelectorAll('button')).toHaveLength(2)
    const chip = [...container.querySelectorAll('span')].find((el) =>
      el.textContent?.includes('Released: 2022-01-01'),
    )
    expect(chip).toBeTruthy()
  })

  it("clicking a date range filter's active-bar chip clears it, restoring the full tree and rows", () => {
    const { getByText, getByLabelText, queryByText, container } = render(
      <DataTable data={DATE_ROWS} columns={DATE_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.change(getByLabelText('Min'), { target: { value: '2022-01-01' } })
    expect(queryByText('2021')).toBeNull()
    // The × is now a real <button>, a sibling of the chip's own body button — see
    // "Active-bar chip click actions".
    const chipX = [...container.querySelectorAll('span')]
      .find((el) => el.textContent?.trim().startsWith('Released: 2022-01-01'))!
      .querySelector('button:last-child')!
    fireEvent.click(chipX)
    expect(getByText('2021')).toBeTruthy()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })
})

describe('DataTable — search clear button', () => {
  it('does not render a clear button when the search query is empty', () => {
    const { queryByTitle } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    expect(queryByTitle('Clear search')).toBeNull()
  })

  it('renders and wires up a clear button once the search query is non-empty', () => {
    const { getByPlaceholderText, getByTitle, queryByTitle } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    const input = getByPlaceholderText('Search…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ali' } })
    expect(input.value).toBe('ali')
    fireEvent.click(getByTitle('Clear search'))
    expect(input.value).toBe('')
    expect(queryByTitle('Clear search')).toBeNull()
  })
})

// Draggable dropdown rows (active sort/group/column entries) vs. the table's own draggable
// <th> headers are told apart by tag — this excludes the headers so container-wide queries only
// ever see the dropdown's own rows.
function draggableRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[draggable="true"]:not(th)')]
}

// Both the table header and the dropdown itself render a column's label as text, so "not inside
// a <th>" is what isolates the dropdown's own copy — mirrors the existing filter-dropdown tests'
// `.find((el) => el.closest('th') === null)` idiom above.
function ddCopyOf(getAllByText: (text: string) => HTMLElement[], label: string): HTMLElement {
  return getAllByText(label).find((el) => el.closest('th') === null)!
}

// jsdom has no DragEvent constructor, so testing-library's fireEvent.dragOver/.drop fall back to
// a plain Event whose EventInit silently drops unrecognized keys like clientY. A real MouseEvent
// (which jsdom does support, clientY included) is needed for tests exercising the
// before/after-target cursor-position math.
function dragEvtAt(type: string, clientY: number): Event {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientY })
}

describe('DataTable — sort dropdown', () => {
  const SORT_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score', type: 'number' },
  ]

  it('lists a not-yet-sorted column under the add section as a real button', () => {
    const { getByText, getAllByText } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    expect(ddCopyOf(getAllByText, 'Score').closest('button')).not.toBeNull()
  })

  it('clicking an add-list column adds it ascending, and clicking the active row toggles direction', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    let names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Bob', 'Alice']) // 60, 90 — ascending

    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('[draggable="true"]')!)
    names = [...container.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent)
    expect(names).toEqual(['Alice', 'Bob']) // 90, 60 — descending
  })

  it('the × button removes the sort and moves the column back to the add section', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    const activeRow = ddCopyOf(getAllByText, 'Score').closest('[draggable="true"]')!
    const removeBtn = [...activeRow.querySelectorAll('button')].find((b) => b.textContent === '×')!
    fireEvent.click(removeBtn)
    expect(ddCopyOf(getAllByText, 'Score').closest('button')).not.toBeNull()
    const names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Alice', 'Bob']) // original order, no longer sorted
  })

  it('the Sort toolbar button has no clear-sorts button until a sort is active', () => {
    const { queryByTitle } = render(<DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />)
    expect(queryByTitle('Clear sorts')).toBeNull()
  })

  it('the toolbar clear-sorts button clears all sorts without opening the dropdown', () => {
    const { getAllByText, getByTitle, container, queryByText } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    const sortToggle = () =>
      [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Sort'))!
    fireEvent.click(sortToggle())
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    fireEvent.click(sortToggle()) // close it

    fireEvent.click(getByTitle('Clear sorts'))
    expect(queryByText('Active sorts')).toBeNull() // still closed, not reopened by the click
    const names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Alice', 'Bob']) // original order, no longer sorted
  })

  it('dragging an active sort row onto another reorders priority', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)

    const [nameRow, scoreRow] = draggableRows(container)
    fireEvent.dragStart(scoreRow)
    fireEvent.dragOver(nameRow)
    fireEvent.drop(nameRow)
    const after = draggableRows(container)
    expect(after[0].textContent).toContain('Score')
    expect(after[1].textContent).toContain('Name')
  })

  it('dropping past the last active sort row moves the dragged row to the end', () => {
    const cols: ColumnDef<Row>[] = [...SORT_COLS, { key: 'id', label: 'Id', type: 'number' }]
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={cols} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Id').closest('button')!)

    const [nameRow, , idRow] = draggableRows(container)
    // jsdom has no layout engine — getBoundingClientRect() returns all zeros unless stubbed.
    idRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = nameRow.parentElement! // the dropdown panel itself — a row's direct parent

    fireEvent.dragStart(nameRow)
    // Pointer is well below the last active row (id), over dead space (blank space in the
    // dropdown panel below the last row) that carries no active-row identity of its own — this
    // used to silently reject the drop entirely. jsdom has no DragEvent constructor, so
    // fireEvent.dragOver/.drop fall back to a plain Event that drops any clientY passed in
    // `init` — dispatching a real MouseEvent directly is what's needed to exercise the
    // before/after cursor-position math.
    fireEvent(panel, dragEvtAt('dragover', 100))
    fireEvent(panel, dragEvtAt('drop', 100))

    const after = draggableRows(container)
    expect(after.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Score'),
      expect.stringContaining('Id'),
      expect.stringContaining('Name'),
    ])
  })

  it('dropping on the bottom half of the last active sort row moves the dragged row after it', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)

    const [nameRow, scoreRow] = draggableRows(container)
    scoreRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    fireEvent.dragStart(nameRow)
    // clientY 35 falls in scoreRow's bottom half (30–40) — should insert name *after* score,
    // not before it (which "insert before" alone could never express for the last row).
    fireEvent(scoreRow, dragEvtAt('dragover', 35))
    fireEvent(scoreRow, dragEvtAt('drop', 35))

    const after = draggableRows(container)
    expect(after[0].textContent).toContain('Score')
    expect(after[1].textContent).toContain('Name')
  })

  it('Alt+ArrowUp on a focused active sort row reorders priority', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)

    const scoreRow = draggableRows(container)[1]
    fireEvent.keyDown(scoreRow, { key: 'ArrowUp', altKey: true })
    const after = draggableRows(container)
    expect(after[0].textContent).toContain('Score')
    expect(after[1].textContent).toContain('Name')
  })
})

// The table header and the dropdown's own copy of a column label share text, so pick the one
// actually inside a <th> — the inverse of `ddCopyOf` above.
function headerOf(getAllByText: (text: string) => HTMLElement[], label: string): HTMLElement {
  return getAllByText(label)
    .find((el) => el.closest('th') !== null)!
    .closest('th')!
}

describe('DataTable — header click sort', () => {
  const SORT_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score', type: 'number' },
  ]

  it('clicking a header sorts ascending, clicking again reverses to descending', () => {
    const { getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(headerOf(getAllByText, 'Score'))
    let names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Bob', 'Alice']) // 60, 90 — ascending

    fireEvent.click(headerOf(getAllByText, 'Score'))
    names = [...container.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent)
    expect(names).toEqual(['Alice', 'Bob']) // 90, 60 — descending
  })

  it('clicking a third time clears the sort', () => {
    const { getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(headerOf(getAllByText, 'Score'))
    fireEvent.click(headerOf(getAllByText, 'Score'))
    fireEvent.click(headerOf(getAllByText, 'Score'))
    const names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Alice', 'Bob']) // original order, no longer sorted
  })

  it('plain-clicking a different header replaces the sort instead of appending to it', () => {
    const { getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(headerOf(getAllByText, 'Name'))
    fireEvent.click(headerOf(getAllByText, 'Score'))
    // Only Score's arrow shows — Name is no longer sorted.
    expect(headerOf(getAllByText, 'Name').textContent).not.toMatch(/[↑↓]/)
    const names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Bob', 'Alice']) // sorted by score alone, ascending
  })

  it('shift-clicking a header appends it to the existing sort instead of replacing it', () => {
    const { getAllByText, container } = render(
      <DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />,
    )
    fireEvent.click(headerOf(getAllByText, 'Name'))
    fireEvent.click(headerOf(getAllByText, 'Score'), { shiftKey: true })
    expect(headerOf(getAllByText, 'Name').textContent).toMatch(/[↑↓]/)
    expect(headerOf(getAllByText, 'Score').textContent).toMatch(/[↑↓]/)
    const names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Alice', 'Bob']) // sorted by name asc (score is only a tiebreaker)
  })

  it('shift-clicking an already-sorted column flips its direction in place, without removing it', () => {
    const { getAllByText } = render(<DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />)
    fireEvent.click(headerOf(getAllByText, 'Name'))
    fireEvent.click(headerOf(getAllByText, 'Score'), { shiftKey: true })
    fireEvent.click(headerOf(getAllByText, 'Score'), { shiftKey: true })
    expect(headerOf(getAllByText, 'Score').textContent).toContain('2↓')
    // A third shift-click flips it back to asc rather than removing it from the stack.
    fireEvent.click(headerOf(getAllByText, 'Score'), { shiftKey: true })
    expect(headerOf(getAllByText, 'Score').textContent).toContain('2↑')
  })

  it('sortable: false makes a header click/shift-click a no-op', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', sortable: false },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const { getAllByText, container } = render(<DataTable data={ROWS} columns={cols} rowKey="id" />)
    fireEvent.click(headerOf(getAllByText, 'Name'))
    fireEvent.click(headerOf(getAllByText, 'Name'), { shiftKey: true })
    expect(headerOf(getAllByText, 'Name').textContent).not.toMatch(/[↑↓]/)
    const names = [...container.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent,
    )
    expect(names).toEqual(['Alice', 'Bob']) // unchanged, original order
  })

  it("sortable: false excludes the column from the Sort dropdown's addable list", () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', sortable: false },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const { getByText, getAllByText, queryAllByText } = render(
      <DataTable data={ROWS} columns={cols} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    expect(queryAllByText('Name').some((el) => el.closest('th') === null)).toBe(false)
    expect(ddCopyOf(getAllByText, 'Score').closest('button')).not.toBeNull()
  })

  it('a single sorted column shows only the direction arrow, no index number', () => {
    const { getAllByText } = render(<DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />)
    fireEvent.click(headerOf(getAllByText, 'Score'))
    expect(headerOf(getAllByText, 'Score').textContent).toContain('↑')
    expect(headerOf(getAllByText, 'Score').textContent).not.toMatch(/\d/)
  })

  it('shows an index number on each header once more than one column is sorted', () => {
    const { getAllByText } = render(<DataTable data={ROWS} columns={SORT_COLS} rowKey="id" />)
    fireEvent.click(headerOf(getAllByText, 'Name'))
    fireEvent.click(headerOf(getAllByText, 'Score'), { shiftKey: true })
    expect(headerOf(getAllByText, 'Name').textContent).toContain('1↑')
    expect(headerOf(getAllByText, 'Score').textContent).toContain('2↑')
  })

  it('a sort on a grouped-out column is not numbered and does not shift visible headers’ numbers', () => {
    interface DeptRow extends Row {
      dept: string
    }
    const cols: ColumnDef<DeptRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    const rows: DeptRow[] = ROWS.map((r) => ({ ...r, dept: r.name === 'Alice' ? 'Eng' : 'HR' }))
    const { getByText, getAllByText } = render(<DataTable data={rows} columns={cols} rowKey="id" />)
    // Sort by dept while it still has a header, then group by it — its sort entry (used to order
    // the groups) stays in `sorts`, but dept no longer has a header to show a number on.
    fireEvent.click(headerOf(getAllByText, 'Dept'))
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Dept').closest('button')!)
    fireEvent.click(headerOf(getAllByText, 'Score'), { shiftKey: true })
    // Only Score has a visible header, so no number — not "2", which would imply a missing "1".
    expect(headerOf(getAllByText, 'Score').textContent).toContain('↑')
    expect(headerOf(getAllByText, 'Score').textContent).not.toMatch(/\d/)
    expect(getAllByText('Dept').every((el) => el.closest('th') === null)).toBe(true) // header removed by grouping
  })
})

describe('DataTable — group dropdown', () => {
  const GROUP_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', groupable: true },
    { key: 'score', label: 'Score', type: 'number', groupable: true },
  ]

  it('lists a not-yet-grouped column under the add section as a real button', () => {
    const { getByText, getAllByText } = render(
      <DataTable data={ROWS} columns={GROUP_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    expect(ddCopyOf(getAllByText, 'Score').closest('button')).not.toBeNull()
  })

  it('the × button removes the group and moves the column back to the add section', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={GROUP_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    expect(container.querySelector('[draggable="true"]:not(th)')).not.toBeNull()
    const activeRow = ddCopyOf(getAllByText, 'Score').closest('[draggable="true"]')!
    const removeBtn = [...activeRow.querySelectorAll('button')].find((b) => b.textContent === '×')!
    fireEvent.click(removeBtn)
    expect(ddCopyOf(getAllByText, 'Score').closest('button')).not.toBeNull()
  })

  it('the Group toolbar button has no clear-groups button until a group is active', () => {
    const { queryByTitle } = render(<DataTable data={ROWS} columns={GROUP_COLS} rowKey="id" />)
    expect(queryByTitle('Clear groups')).toBeNull()
  })

  it('the toolbar clear-groups button clears all groups without opening the dropdown', () => {
    const { getAllByText, getByTitle, container, queryByText } = render(
      <DataTable data={ROWS} columns={GROUP_COLS} rowKey="id" />,
    )
    const groupToggle = () =>
      [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Group'))!
    fireEvent.click(groupToggle())
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    fireEvent.click(groupToggle()) // close it

    fireEvent.click(getByTitle('Clear groups'))
    expect(queryByText('Active groups')).toBeNull() // still closed, not reopened by the click
    expect(container.querySelector('[draggable="true"]:not(th)')).toBeNull()
  })

  it('dragging an active group row onto another reorders priority', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={GROUP_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)

    const [nameRow, scoreRow] = draggableRows(container)
    fireEvent.dragStart(scoreRow)
    fireEvent.dragOver(nameRow)
    fireEvent.drop(nameRow)
    const after = draggableRows(container)
    expect(after[0].textContent).toContain('Score')
    expect(after[1].textContent).toContain('Name')
  })

  it('dropping past the last active group row moves the dragged row to the end', () => {
    const cols: ColumnDef<Row>[] = [
      ...GROUP_COLS,
      { key: 'id', label: 'Id', type: 'number', groupable: true },
    ]
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={cols} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Id').closest('button')!)

    const [nameRow, , idRow] = draggableRows(container)
    // jsdom has no layout engine — getBoundingClientRect() returns all zeros unless stubbed.
    idRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = nameRow.parentElement! // the dropdown panel itself — a row's direct parent

    fireEvent.dragStart(nameRow)
    fireEvent(panel, dragEvtAt('dragover', 100))
    fireEvent(panel, dragEvtAt('drop', 100))

    const after = draggableRows(container)
    expect(after.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Score'),
      expect.stringContaining('Id'),
      expect.stringContaining('Name'),
    ])
  })

  it('dropping on the bottom half of the last active group row moves the dragged row after it', () => {
    const cols: ColumnDef<Row>[] = [
      ...GROUP_COLS,
      { key: 'id', label: 'Id', type: 'number', groupable: true },
    ]
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={cols} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    fireEvent.click(ddCopyOf(getAllByText, 'Id').closest('button')!)

    const [nameRow, , idRow] = draggableRows(container)
    idRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    fireEvent.dragStart(nameRow)
    // clientY 35 falls in idRow's bottom half (30–40) — should insert name *after* id,
    // not before it (which "insert before" alone could never express for the last row).
    fireEvent(idRow, dragEvtAt('dragover', 35))
    fireEvent(idRow, dragEvtAt('drop', 35))

    const after = draggableRows(container)
    expect(after.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Score'),
      expect.stringContaining('Id'),
      expect.stringContaining('Name'),
    ])
  })
})

describe('DataTable — columns dropdown', () => {
  it('column rows are draggable and reorder headers on drop, with no ▲▼ buttons', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const rows = draggableRows(container)
    expect(rows).toHaveLength(COLS.length)
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === '▲')).toBe(false)

    const [nameRow, scoreRow] = rows
    fireEvent.dragStart(scoreRow)
    fireEvent.dragOver(nameRow)
    fireEvent.drop(nameRow)
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers[0]).toContain('Score')
    expect(headers[1]).toContain('Name')
  })

  it('Alt+ArrowUp on a focused column checkbox reorders headers, Space still toggles visibility', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const checkboxes = [
      ...container.querySelectorAll<HTMLInputElement>('[draggable] input[type="checkbox"]'),
    ]
    fireEvent.keyDown(checkboxes[1], { key: 'ArrowUp', altKey: true })
    let headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers[0]).toContain('Score')

    fireEvent.click(checkboxes[0])
    headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers.some((h) => h?.includes('Name'))).toBe(false)
  })

  it('dropping past the last column row moves the dragged row to the end', () => {
    const cols: ColumnDef<Row>[] = [...COLS, { key: 'id', label: 'Id', type: 'number' }]
    const { getByText, container } = render(<DataTable data={ROWS} columns={cols} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const rows = draggableRows(container)
    const [nameRow, , idRow] = rows
    // jsdom has no layout engine — getBoundingClientRect() returns all zeros unless stubbed.
    idRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = nameRow.parentElement! // the dropdown panel itself — a row's direct parent

    fireEvent.dragStart(nameRow)
    fireEvent(panel, dragEvtAt('dragover', 100))
    fireEvent(panel, dragEvtAt('drop', 100))

    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers[0]).toContain('Score')
    expect(headers[1]).toContain('Id')
    expect(headers[2]).toContain('Name')
  })

  it('dropping on the bottom half of the last column row moves the dragged row after it', () => {
    const cols: ColumnDef<Row>[] = [...COLS, { key: 'id', label: 'Id', type: 'number' }]
    const { getByText, container } = render(<DataTable data={ROWS} columns={cols} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const rows = draggableRows(container)
    const [nameRow, , idRow] = rows
    idRow.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    fireEvent.dragStart(nameRow)
    // clientY 35 falls in idRow's bottom half (30–40) — should insert name *after* id,
    // not before it (which "insert before" alone could never express for the last row).
    fireEvent(idRow, dragEvtAt('dragover', 35))
    fireEvent(idRow, dragEvtAt('drop', 35))

    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers[0]).toContain('Score')
    expect(headers[1]).toContain('Id')
    expect(headers[2]).toContain('Name')
  })
})

describe('DataTable — filter column selector keyboard access', () => {
  const FILTER_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'score', label: 'Score', type: 'number', filterable: true },
  ]

  it('renders each column selector as a real, focusable <button>', () => {
    const { getByText, getAllByText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const nameItem = ddCopyOf(getAllByText, 'Name')
    const btn = nameItem.closest('button')
    expect(btn).not.toBeNull()
    expect(btn!.tabIndex).toBe(0)
  })
})

describe('DataTable — filter column ordering & clear button', () => {
  interface OrderRow {
    id: number
    name: string
    dept: string
    score: number
    joined: string
  }
  const ORDER_COLS: ColumnDef<OrderRow>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'dept', label: 'Dept', filterable: true },
    { key: 'score', label: 'Score', filterable: true, type: 'number' },
    { key: 'joined', label: 'Joined', filterable: true, type: 'date' },
  ]
  const ORDER_ROWS: OrderRow[] = [
    { id: 1, name: 'Alice', dept: 'Eng', score: 90, joined: '2023-01-15' },
    { id: 2, name: 'Bob', dept: 'HR', score: 60, joined: '2023-06-20' },
  ]

  function filterColLabels(container: HTMLElement): string[] {
    return [...container.querySelectorAll<HTMLElement>('[data-filter-row-key]')].map(
      (row) => row.querySelector('[data-filter-col-key]')?.textContent ?? '',
    )
  }

  function rowFor(container: HTMLElement, label: string): HTMLElement {
    return [...container.querySelectorAll<HTMLElement>('[data-filter-row-key]')].find((row) =>
      row.textContent?.includes(label),
    )!
  }

  it('is plain alphabetical order with nothing active', () => {
    const { getByText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(filterColLabels(container)).toEqual(['Dept', 'Joined', 'Name', 'Score'])
  })

  it('does not reorder mid-session when a filter is toggled while the panel stays open', () => {
    const { getByText, getByPlaceholderText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(rowFor(container, 'Score').querySelector('[data-filter-col-key]')!)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    expect(filterColLabels(container)).toEqual(['Dept', 'Joined', 'Name', 'Score'])
  })

  it('moves active-filter columns to the top on the next open', () => {
    const { getByText, getByPlaceholderText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(rowFor(container, 'Score').querySelector('[data-filter-col-key]')!)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    fireEvent.click(getByText('Filter')) // close
    fireEvent.click(getByText('Filter')) // reopen — snapshot re-taken
    expect(filterColLabels(container)).toEqual(['Score', 'Dept', 'Joined', 'Name'])
  })

  it('shows a clear button only for a column with an active filter', () => {
    const { getByText, getByPlaceholderText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    expect(rowFor(container, 'Score').querySelectorAll('button')).toHaveLength(1)
    fireEvent.click(rowFor(container, 'Score').querySelector('[data-filter-col-key]')!)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    expect(rowFor(container, 'Score').querySelectorAll('button')).toHaveLength(2)
  })

  it('clear button removes the filter without opening that column', () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(rowFor(container, 'Score').querySelector('[data-filter-col-key]')!)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    fireEvent.click(rowFor(container, 'Name').querySelector('[data-filter-col-key]')!) // switch away
    const scoreRow = rowFor(container, 'Score')
    fireEvent.click(scoreRow.querySelectorAll('button')[1]) // the clear button
    expect(scoreRow.querySelectorAll('button')).toHaveLength(1)
    // Still showing Name's pane (a checklist, no Min/Max inputs), not reopened onto Score's.
    expect(queryByPlaceholderText('Min')).toBeNull()
  })

  it('Delete on a focused, active column row clears its filter', () => {
    const { getByText, getByPlaceholderText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const scoreBtn = rowFor(container, 'Score').querySelector<HTMLButtonElement>(
      '[data-filter-col-key]',
    )!
    fireEvent.click(scoreBtn)
    fireEvent.change(getByPlaceholderText('Min'), { target: { value: '80' } })
    fireEvent.keyDown(scoreBtn, { key: 'Delete' })
    expect(rowFor(container, 'Score').querySelectorAll('button')).toHaveLength(1)
  })

  it('Backspace on a focused, inactive column row is a no-op', () => {
    const { getByText, container } = render(
      <DataTable data={ORDER_ROWS} columns={ORDER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const deptBtn = rowFor(container, 'Dept').querySelector<HTMLButtonElement>(
      '[data-filter-col-key]',
    )!
    fireEvent.keyDown(deptBtn, { key: 'Backspace' })
    expect(rowFor(container, 'Dept').querySelectorAll('button')).toHaveLength(1)
  })
})

describe('DataTable — active state bar', () => {
  it('renders with just the row-count stats when nothing is active', () => {
    const { getByText } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    expect(getByText('2 / 2 rows')).toBeTruthy()
  })

  it('shows sort, group, and filter chips together, each removable on its own', () => {
    const chipCols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', filterable: true, groupable: true },
      { key: 'score', label: 'Score', type: 'number', groupable: true },
    ]
    const { getByText, getAllByText, getByLabelText, container } = render(
      <DataTable data={ROWS} columns={chipCols} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Score').closest('button')!)
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name').closest('button')!)
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Alice', { exact: false }))

    // Sort/group chips now get the same at-a-glance treatment the filter chip always had — no
    // more bare count badge on the toolbar button itself (see the "Sort"/"Group" assertions).
    expect(getByText('Sort').closest('button')?.textContent).toBe('Sort')
    expect(getByText('Group').closest('button')?.textContent).toBe('Group')
    expect(container.textContent).toContain('Score')
    expect(container.textContent).toContain('Name: Alice')
  })
})

describe('DataTable — keyboard navigation', () => {
  const ROWS3: Row[] = [
    { id: 1, name: 'Alice', score: 90 },
    { id: 2, name: 'Bob', score: 60 },
    { id: 3, name: 'Clara', score: 80 },
  ]

  function dataRows(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('tbody tr')]
  }

  it('does not add a tabIndex to rows when neither selectable nor onRowClick is set', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" />)
    for (const row of dataRows(container)) expect(row.getAttribute('tabindex')).toBeNull()
  })

  it('makes the first row the sole tab stop by default, the rest tabIndex -1', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first, ...rest] = dataRows(container)
    expect(first.getAttribute('tabindex')).toBe('0')
    for (const row of rest) expect(row.getAttribute('tabindex')).toBe('-1')
  })

  it('excludes the row checkbox from the tab sequence', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const checkbox = container.querySelector('tbody tr input[type="checkbox"]')!
    expect(checkbox.getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowDown moves the roving tabIndex to the next row', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first, second] = dataRows(container)
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(first.getAttribute('tabindex')).toBe('-1')
    expect(second.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(second)
  })

  it('ArrowUp on the first row is a no-op (clamped at the boundary)', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first] = dataRows(container)
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(first.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(first)
  })

  it('End moves the roving tabIndex to the last row', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first, , last] = dataRows(container)
    first.focus()
    fireEvent.keyDown(first, { key: 'End' })
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
  })

  it('Space toggles selection on the focused row', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first] = dataRows(container)
    const checkbox = first.querySelector('input[type="checkbox"]') as HTMLInputElement
    first.focus()
    fireEvent.keyDown(first, { key: ' ' })
    expect(checkbox.checked).toBe(true)
    fireEvent.keyDown(first, { key: ' ' })
    expect(checkbox.checked).toBe(false)
  })

  it('Shift+ArrowDown extends the selection range like a shift-click would', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first, second] = dataRows(container)
    const firstCheckbox = first.querySelector('input[type="checkbox"]') as HTMLInputElement
    const secondCheckbox = second.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(firstCheckbox) // selects Alice, sets the anchor
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown', shiftKey: true })
    expect(firstCheckbox.checked).toBe(true)
    expect(secondCheckbox.checked).toBe(true)
    expect(document.activeElement).toBe(second)
  })

  it('Enter fires onRowClick with the row and the keyboard event', () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <DataTable data={ROWS3} columns={COLS} rowKey="id" onRowClick={onRowClick} />,
    )
    const [first] = dataRows(container)
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toEqual(ROWS3[0])
    expect(onRowClick.mock.calls[0][1].type).toBe('keydown')
  })

  it('Enter does nothing when onRowClick is not set', () => {
    const { container } = render(<DataTable data={ROWS3} columns={COLS} rowKey="id" selectable />)
    const [first] = dataRows(container)
    first.focus()
    expect(() => fireEvent.keyDown(first, { key: 'Enter' })).not.toThrow()
  })
})

describe('DataTable — keyboard navigation across pages', () => {
  const ROWS6: Row[] = [
    { id: 1, name: 'Alice', score: 90 },
    { id: 2, name: 'Bob', score: 60 },
    { id: 3, name: 'Clara', score: 80 },
    { id: 4, name: 'Dave', score: 70 },
    { id: 5, name: 'Eve', score: 50 },
    { id: 6, name: 'Frank', score: 40 },
  ]

  function dataRows(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('tbody tr')]
  }

  function clickNextPage(container: HTMLElement): void {
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent === '›')!)
  }

  it('the rows-per-page dropdown includes and selects a custom defaultPageSize not among the defaults', () => {
    const { container } = render(
      <DataTable data={ROWS6} columns={COLS} rowKey="id" defaultPageSize={2} />,
    )
    const select = container.querySelector('select')!
    expect([...select.options].map((o) => o.value)).toEqual(['2', '10', '20', '50', '100'])
    expect(select.value).toBe('2')
  })

  it('ArrowDown on the last row of a page moves to the first row of the next page', () => {
    const { container } = render(
      <DataTable data={ROWS6} columns={COLS} rowKey="id" selectable defaultPageSize={2} />,
    )
    const [, last] = dataRows(container)
    last.focus()
    fireEvent.keyDown(last, { key: 'ArrowDown' })
    const [newFirst] = dataRows(container)
    expect(newFirst.textContent).toContain('Clara')
    expect(newFirst.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(newFirst)
  })

  it('ArrowUp on the first row of a page moves to the last row of the previous page', () => {
    const { container } = render(
      <DataTable data={ROWS6} columns={COLS} rowKey="id" selectable defaultPageSize={2} />,
    )
    clickNextPage(container)
    const [first] = dataRows(container)
    expect(first.textContent).toContain('Clara')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    const rows = dataRows(container)
    const last = rows[rows.length - 1]
    expect(last.textContent).toContain('Bob')
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
  })

  it('Ctrl+End jumps to the true last row across all pages', () => {
    const { container } = render(
      <DataTable data={ROWS6} columns={COLS} rowKey="id" selectable defaultPageSize={2} />,
    )
    const [first] = dataRows(container)
    first.focus()
    fireEvent.keyDown(first, { key: 'End', ctrlKey: true })
    const rows = dataRows(container)
    const last = rows[rows.length - 1]
    expect(last.textContent).toContain('Frank')
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
  })

  it('Ctrl+Home jumps to the true first row across all pages', () => {
    const { container } = render(
      <DataTable data={ROWS6} columns={COLS} rowKey="id" selectable defaultPageSize={2} />,
    )
    const [first] = dataRows(container)
    first.focus()
    fireEvent.keyDown(first, { key: 'End', ctrlKey: true })
    const focused = document.activeElement as HTMLElement
    fireEvent.keyDown(focused, { key: 'Home', ctrlKey: true })
    const newFirst = dataRows(container)[0]
    expect(newFirst.textContent).toContain('Alice')
    expect(newFirst.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(newFirst)
  })

  it('Shift+ArrowDown across a page boundary extends the selection onto the next page', () => {
    const { container } = render(
      <DataTable data={ROWS6} columns={COLS} rowKey="id" selectable defaultPageSize={2} />,
    )
    const [, last] = dataRows(container)
    const lastCheckbox = last.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(lastCheckbox) // selects Bob, sets the anchor
    last.focus()
    fireEvent.keyDown(last, { key: 'ArrowDown', shiftKey: true })
    const newFirst = dataRows(container)[0]
    const newFirstCheckbox = newFirst.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(newFirstCheckbox.checked).toBe(true)
    expect(document.activeElement).toBe(newFirst)
  })
})

describe('DataTable — keyboard navigation with grouping', () => {
  interface GroupRow {
    id: number
    name: string
    dept: string
  }

  const GROUP_COLS: ColumnDef<GroupRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Department', groupable: true },
  ]

  const GROUP_ROWS: GroupRow[] = [
    { id: 1, name: 'Alice', dept: 'Eng' },
    { id: 2, name: 'Bob', dept: 'Eng' },
    { id: 3, name: 'Clara', dept: 'HR' },
    { id: 4, name: 'David', dept: 'HR' },
  ]

  function groupHeaderRows(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('tbody tr[aria-expanded]')]
  }

  // Clicking "Group" reveals a "Department" entry in the dropdown, ambiguous with the still
  // -present "Department" column header until the click actually applies groupBy (which then
  // removes that column from activeColumns) — so pick the dropdown's copy explicitly.
  function groupByDept(
    getByText: (t: string) => HTMLElement,
    getAllByText: (t: string) => HTMLElement[],
  ) {
    fireEvent.click(getByText('Group'))
    fireEvent.click(getAllByText('Department').find((el) => el.closest('th') === null)!)
  }

  it('makes every group header row a Tab stop, one at a time', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        selectable
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const headers = groupHeaderRows(container)
    expect(headers).toHaveLength(2)
    expect(headers[0].getAttribute('tabindex')).toBe('0')
    expect(headers[1].getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowDown walks through a group’s rows and on to the next group header', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        selectable
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }) // -> Alice
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }) // -> Bob
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }) // -> HR header
    expect(document.activeElement).toBe(groupHeaderRows(container)[1])
  })

  it('Enter toggles collapse on a focused group header, regardless of selectable/onRowClick', () => {
    const { getByText, getAllByText, container, queryByText } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    fireEvent.keyDown(firstHeader, { key: 'Enter' })
    expect(queryByText('Alice')).toBeNull()
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(queryByText('Alice')).toBeTruthy()
  })

  it('Space toggles the group’s own select-all checkbox on a focused group header', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        selectable
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    fireEvent.keyDown(firstHeader, { key: ' ' })
    const checkbox = firstHeader.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('Ctrl+End from a group header jumps to the true last row across all groups', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        selectable
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    fireEvent.keyDown(firstHeader, { key: 'End', ctrlKey: true })
    expect(document.activeElement?.textContent).toContain('David')
  })

  it('a collapsed group’s header stays reachable and its rows are skipped', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        selectable
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    fireEvent.keyDown(firstHeader, { key: 'Enter' }) // collapse Eng
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    // Eng's rows are hidden, so ArrowDown from its (still focusable) header goes straight to HR's header
    expect(document.activeElement).toBe(groupHeaderRows(container)[1])
  })

  it('starts groups collapsed by default, and Enter expands one', () => {
    const { getByText, getAllByText, container, queryByText } = render(
      <DataTable data={GROUP_ROWS} columns={GROUP_COLS} rowKey="id" />,
    )
    groupByDept(getByText, getAllByText)
    expect(queryByText('Alice')).toBeNull()
    const [firstHeader] = groupHeaderRows(container)
    firstHeader.focus()
    fireEvent.keyDown(firstHeader, { key: 'Enter' })
    expect(queryByText('Alice')).toBeTruthy()
  })

  it('defaultGroupsCollapsed={false} starts groups expanded', () => {
    const { getByText, getAllByText, queryByText } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    expect(queryByText('Alice')).toBeTruthy()
  })

  it('counts header rows toward the page budget, so a page never renders more than pageSize rows', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        defaultPageSize={2}
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    // 2 headers + 4 rows = 6 visible items; pageSize 2 => page 1 is [header Eng, Alice]
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.textContent).toContain('Alice')
    expect(container.textContent).not.toContain('Bob')
  })

  it("repeats a split group's header, marked as continued, on the page its rows continue onto", () => {
    const { getByText, getAllByText, container } = render(
      <DataTable
        data={GROUP_ROWS}
        columns={GROUP_COLS}
        rowKey="id"
        defaultPageSize={2}
        defaultGroupsCollapsed={false}
      />,
    )
    groupByDept(getByText, getAllByText)
    const nextPageBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === '›',
    )!
    fireEvent.click(nextPageBtn) // -> page 2: [Bob (Eng, continued), header HR (no rows of its own here)]
    expect(container.textContent).toContain('Bob')
    expect(container.textContent).not.toContain('Alice')
    const engHeader = groupHeaderRows(container).find((h) => h.textContent?.includes('Eng'))!
    expect(engHeader.textContent).toContain('cont')
    // HR's header lands as the very last item on this page with none of its own rows following
    // until the next page — it must still render its label (from a full-group sample row) instead
    // of crashing on an empty `rows` array.
    const hrHeader = groupHeaderRows(container).find((h) => h.textContent?.includes('HR'))!
    expect(hrHeader).toBeTruthy()
    expect(hrHeader.textContent).not.toContain('cont')
  })
})

describe('DataTable — computed columns', () => {
  it('renders a cell value produced by col.value instead of row[key]', () => {
    const cols: ColumnDef<Row>[] = [
      ...COLS,
      { key: 'grade', label: 'Grade', value: (row) => (row.score >= 70 ? 'Pass' : 'Fail') },
    ]
    const { getByText } = render(<DataTable data={ROWS} columns={cols} rowKey="id" />)
    expect(getByText('Pass')).toBeTruthy()
    expect(getByText('Fail')).toBeTruthy()
  })
})

describe('DataTable — bucketed grouping (groupValue/groupFormat)', () => {
  it('renders the bucket label from groupFormat instead of a sample row’s raw value', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      {
        key: 'score',
        label: 'Score',
        type: 'number',
        groupable: true,
        groupValue: (v) => Math.floor(Number(v) / 20) * 20,
        groupFormat: (k) => `${k}–${Number(k) + 20}`,
      },
    ]
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={cols} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    fireEvent.click(getAllByText('Score').find((el) => el.closest('th') === null)!)
    // scores 90 and 60 bucket to 80 and 60 -> "80–100" and "60–80"
    expect(container.textContent).toContain('80–100')
    expect(container.textContent).toContain('60–80')
  })
})
