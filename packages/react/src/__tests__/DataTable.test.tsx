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
    expect((getByLabelText('Alice') as HTMLInputElement).checked).toBe(true)
    expect((getByLabelText('Bob') as HTMLInputElement).checked).toBe(true)
  })

  it('select-all checkbox deselects every value when all are already selected', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Select all'))
    fireEvent.click(getByLabelText('Select all'))
    expect((getByLabelText('Alice') as HTMLInputElement).checked).toBe(false)
    expect((getByLabelText('Bob') as HTMLInputElement).checked).toBe(false)
  })

  it('select-all checkbox only affects the search-narrowed values', () => {
    const { getByText, getAllByPlaceholderText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    const [filterSearchInput] = getAllByPlaceholderText('Search…')
    fireEvent.change(filterSearchInput, { target: { value: 'ali' } })
    fireEvent.click(getByLabelText('Select all'))
    expect((getByLabelText('Alice') as HTMLInputElement).checked).toBe(true)
    fireEvent.change(filterSearchInput, { target: { value: '' } })
    expect((getByLabelText('Bob') as HTMLInputElement).checked).toBe(false)
  })

  it('select-all checkbox is indeterminate when only some listed values are selected', () => {
    const { getByText, getByLabelText } = render(
      <DataTable data={ROWS} columns={FILTER_COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Alice'))
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
