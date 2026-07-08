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
