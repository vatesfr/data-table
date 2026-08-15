import { describe, it, expect, afterEach } from 'vitest'
import { act } from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { DataTable } from '../DataTable'
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

afterEach(cleanup)

// Both the table header and the dropdown itself render a column's label as text — this isolates
// the dropdown's own copy, mirroring the identical helper in DataTable.test.tsx.
function ddCopyOf(getAllByText: (text: string) => HTMLElement[], label: string): HTMLElement {
  return getAllByText(label).find((el) => el.closest('th') === null)!
}

describe('DataTable — dropdown column search', () => {
  it('the Columns dropdown search box narrows the column list by label', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const search = container.querySelector<HTMLInputElement>('input[data-dd-search]')!
    fireEvent.change(search, { target: { value: 'sc' } })
    const rowLabels = [...container.querySelectorAll('[data-col-row-key] label')].map((l) =>
      l.textContent?.trim(),
    )
    expect(rowLabels).toEqual(['Score'])
  })

  it('the Sort dropdown search box narrows only the addable list, alphabetized, leaving active sorts untouched', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Dept'))
    // Name/Score, alphabetized — Dept is already active and excluded from this list.
    const addable = [...container.querySelectorAll('button[data-sort-add-key]')].map(
      (b) => b.textContent,
    )
    expect(addable).toEqual(['Name', 'Score'])
    const search = container.querySelector<HTMLInputElement>('input[data-dd-search]')!
    fireEvent.change(search, { target: { value: 'sco' } })
    expect(
      [...container.querySelectorAll('button[data-sort-add-key]')].map((b) => b.textContent),
    ).toEqual(['Score'])
    // The active-sorts section (Dept) stays visible regardless of the search term.
    expect(container.querySelector('[data-sort-key="dept"]')).not.toBeNull()
  })

  it('the Group dropdown search box narrows the addable list', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Group'))
    const search = container.querySelector<HTMLInputElement>('input[data-dd-search]')!
    fireEvent.change(search, { target: { value: 'xyz' } })
    expect(container.querySelectorAll('button[data-group-add-key]').length).toBe(0)
  })

  it('the Filter dropdown search box narrows the left column pane, alphabetized', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    const labelsBefore = [
      ...container.querySelectorAll('[data-filter-col-key] span:first-child'),
    ].map((el) => el.textContent)
    expect(labelsBefore).toEqual(['Dept', 'Name', 'Score']) // already alphabetical here
    const search = container.querySelector<HTMLInputElement>('input[data-dd-search]')!
    fireEvent.change(search, { target: { value: 'sc' } })
    expect(
      [...container.querySelectorAll('[data-filter-col-key] span:first-child')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['Score'])
  })
})

describe('DataTable — dropdown focus-on-open', () => {
  it('opening a dropdown focuses its search box', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    expect(document.activeElement).toBe(container.querySelector('input[data-dd-search]'))
  })

  it('opening a dropdown with no search box (nothing left to add) focuses the first active row', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name'))
    fireEvent.click(ddCopyOf(getAllByText, 'Score'))
    fireEvent.click(ddCopyOf(getAllByText, 'Dept'))
    fireEvent.click(getByText('Sort')) // close
    fireEvent.click(getByText('Sort')) // reopen
    expect(document.activeElement).toBe(container.querySelector('[data-sort-key]'))
  })
})

describe('DataTable — dropdown keyboard navigation order and Escape', () => {
  it('ArrowDown moves through Sort dropdown rows in visible order: active row, then search box, then addable rows', () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Dept'))
    const deptRow = container.querySelector<HTMLElement>('[data-sort-key="dept"]')!
    deptRow.focus()
    fireEvent.keyDown(deptRow, { key: 'ArrowDown' })
    const search = container.querySelector<HTMLInputElement>('input[data-dd-search]')!
    expect(document.activeElement).toBe(search)
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(container.querySelector('[data-sort-add-key="name"]'))
  })

  it('Home/End jump to the first/last row, skipping the search box', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const rows = [...container.querySelectorAll<HTMLElement>('[data-col-row-key] input')]
    rows[0].focus()
    fireEvent.keyDown(rows[0], { key: 'End' })
    expect(document.activeElement).toBe(rows[rows.length - 1])
    fireEvent.keyDown(rows[rows.length - 1], { key: 'Home' })
    expect(document.activeElement).toBe(rows[0])
  })

  it('Escape clears a non-empty dropdown search term before closing the dropdown', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const search = container.querySelector<HTMLInputElement>('input[data-dd-search]')!
    fireEvent.change(search, { target: { value: 'sc' } })
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(search.value).toBe('')
    // Dropdown is still open — a second Escape (nothing left to clear) closes it.
    expect(container.querySelector('input[data-dd-search]')).not.toBeNull()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(container.querySelector('input[data-dd-search]')).toBeNull()
  })

  it('Escape closes the dropdown immediately when its search term is already empty, refocusing the toggle button', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Columns'))
    const checkbox = container.querySelector<HTMLElement>('[data-col-row-key] input')!
    checkbox.focus()
    fireEvent.keyDown(checkbox, { key: 'Escape' })
    expect(container.querySelector('input[data-dd-search]')).toBeNull()
    expect(document.activeElement?.textContent).toBe('Columns')
  })
})

describe('DataTable — filter dropdown left/right pane navigation', () => {
  it('ArrowRight on the left column list enters the right detail pane', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    const nameBtn = container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!
    nameBtn.focus()
    fireEvent.keyDown(nameBtn, { key: 'ArrowRight' })
    expect(container.querySelector('[data-filter-detail]')!.contains(document.activeElement)).toBe(
      true,
    )
  })

  it('ArrowLeft from a checklist row returns focus to the active column button', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    const row = container.querySelector<HTMLInputElement>('input[data-dd-value-row]')!
    row.focus()
    fireEvent.keyDown(row, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(container.querySelector('[data-filter-col-key="name"]'))
  })

  it('ArrowLeft does not hijack cursor movement in the value-search text box', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    const search = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    search.focus()
    fireEvent.keyDown(search, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(search)
  })

  it('ArrowDown/ArrowUp move between checklist rows in the filter detail pane', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    const search = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    search.focus()
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    const firstRow = container.querySelector<HTMLInputElement>('input[data-dd-value-row]')!
    expect(document.activeElement).toBe(firstRow)
    fireEvent.keyDown(firstRow, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search)
  })

  it('Escape clears the value-search term before closing the dropdown', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    const search = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    fireEvent.change(search, { target: { value: 'ali' } })
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(search.value).toBe('')
  })
})

describe('DataTable — filter dropdown "focus follows selection"', () => {
  it('focusing a different column in the left pane updates the right pane immediately, with no Enter/Space needed', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Filter'))
    expect(container.querySelector('input[type="number"]')).toBeNull() // 'dept' (string) starts active alphabetically... 'Dept' comes first
    const scoreBtn = container.querySelector<HTMLElement>('[data-filter-col-key="score"]')!
    // A real .focus() (not fireEvent.focus, which only dispatches the event without actually
    // moving document.activeElement) to simulate arriving via Tab/arrow-key rather than a click
    // or Enter/Space activation, wrapped in act() so the state update it triggers flushes before
    // the assertions below run.
    act(() => {
      scoreBtn.focus()
    })
    expect(container.querySelector('input[type="number"]')).not.toBeNull() // score (number) now active
    expect(document.activeElement).toBe(container.querySelector('[data-filter-col-key="score"]'))
  })
})

describe('DataTable — active-bar chip click actions', () => {
  it("clicking a sort chip's body toggles its direction in place and keeps focus on the chip", () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Sort'))
    fireEvent.click(ddCopyOf(getAllByText, 'Name'))
    const chipBody = [...container.querySelectorAll('span')]
      .find((el) => el.textContent?.includes('Name') && el.querySelector('button:first-child'))!
      .querySelector<HTMLButtonElement>('button:first-child')!
    const iconBefore = chipBody.textContent
    chipBody.focus()
    fireEvent.click(chipBody)
    expect(chipBody.textContent).not.toBe(iconBefore) // direction flipped
    expect(document.activeElement).toBe(chipBody)
  })

  it("clicking a group chip's body opens the Group dropdown, focused on that entry's row", () => {
    const { getByText, getAllByText, container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Group'))
    fireEvent.click(ddCopyOf(getAllByText, 'Dept'))
    fireEvent.click(getByText('Group')) // close the dropdown
    expect(container.querySelector('[data-group-key="dept"]')).toBeNull()
    const chipBody = [...container.querySelectorAll('span')]
      .find((el) => el.textContent?.trim() === 'Dept×')!
      .querySelector('button:first-child')!
    fireEvent.click(chipBody)
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="dept"]'))
  })

  it("clicking a filter chip's body opens the Filter dropdown, focused on that column's detail pane", () => {
    const { getByText, getByLabelText, container } = render(
      <DataTable data={ROWS} columns={COLS} rowKey="id" />,
    )
    fireEvent.click(getByText('Filter'))
    fireEvent.click(getByLabelText('Alice', { exact: false }))
    fireEvent.click(getByText('Filter')) // close the dropdown
    expect(container.querySelector('[data-filter-col-key]')).toBeNull()
    const chipBody = [...container.querySelectorAll('span')]
      .find((el) => el.textContent?.trim().startsWith('Name: Alice'))!
      .querySelector('button:first-child')!
    fireEvent.click(chipBody)
    expect(document.activeElement).toBe(container.querySelector('[data-filter-col-key="name"]'))
    expect(container.querySelector('input[data-dd-value-row]')).not.toBeNull() // name's checklist shown
  })
})

describe('DataTable — Sort/Group activate/remove focus retention', () => {
  it('activating an addable column in the Sort dropdown keeps focus on its new active row', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Sort'))
    const nameBtn = container.querySelector<HTMLElement>('[data-sort-add-key="name"]')!
    nameBtn.focus()
    fireEvent.click(nameBtn)
    expect(document.activeElement).toBe(container.querySelector('[data-sort-key="name"]'))
  })

  it('removing an active Sort column returns focus to its addable button', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Sort'))
    const nameBtn = container.querySelector<HTMLElement>('[data-sort-add-key="name"]')!
    fireEvent.click(nameBtn)
    const removeBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === '×' && b.closest('[data-sort-key="name"]'),
    )!
    removeBtn.focus()
    fireEvent.click(removeBtn)
    expect(document.activeElement).toBe(container.querySelector('[data-sort-add-key="name"]'))
  })

  it('activating/removing an active Group column keeps focus, same as Sort', () => {
    const { getByText, container } = render(<DataTable data={ROWS} columns={COLS} rowKey="id" />)
    fireEvent.click(getByText('Group'))
    const deptBtn = container.querySelector<HTMLElement>('[data-group-add-key="dept"]')!
    deptBtn.focus()
    fireEvent.click(deptBtn)
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="dept"]'))
    const removeBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === '×' && b.closest('[data-group-key="dept"]'),
    )!
    removeBtn.focus()
    fireEvent.click(removeBtn)
    expect(document.activeElement).toBe(container.querySelector('[data-group-add-key="dept"]'))
  })
})
