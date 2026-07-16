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

  it('select-all checkbox only affects the search-narrowed values', () => {
    const { getByText, getAllByPlaceholderText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const [filterSearchInput] = getAllByPlaceholderText('Search…')
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
    const [filterSearchInput] = getAllByPlaceholderText('Search…')
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
    const [filterSearchInput] = getAllByPlaceholderText('Search…')
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
