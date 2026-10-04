import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import type { TableViewState } from '@vates/data-table-core'
import { useTableState } from '../useTableState'
import { DataTableView } from '../DataTableView'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  dept: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'dept', label: 'Dept', groupable: true },
  { key: 'score', label: 'Score', type: 'number', category: 'Metrics', sortable: false },
]
const ROWS: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', score: 90 },
  { id: 2, name: 'Bob', dept: 'HR', score: 60 },
]

afterEach(cleanup)

const tick = () => act(() => new Promise((r) => setTimeout(r)))

function Harness({
  cols,
  initialViewState,
  onReady,
}: {
  cols: ColumnDef<Row>[]
  initialViewState?: TableViewState
  onReady: (table: ReturnType<typeof useTableState<Row>>) => void
}) {
  const table = useTableState(ROWS, cols, { initialViewState })
  onReady(table)
  return <DataTableView table={table} data={ROWS} columns={cols} rowKey="id" />
}

function mount(cols = COLS, initialViewState?: TableViewState) {
  let table!: ReturnType<typeof useTableState<Row>>
  const { container } = render(
    <Harness cols={cols} initialViewState={initialViewState} onReady={(t) => (table = t)} />,
  )
  const trigger = (label: string) =>
    container.querySelector<HTMLButtonElement>(`[aria-label="${label} options"]`)
  const items = () =>
    [...container.querySelectorAll<HTMLButtonElement>('[role=menuitem]')].map((b) =>
      b.textContent!.trim(),
    )
  const item = (name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('[role=menuitem]')].find((b) =>
      b.textContent!.includes(name),
    )!
  const menu = () => container.querySelector<HTMLElement>('[role=menu]')
  const click = async (el: HTMLElement) => {
    act(() => el.click())
    await tick()
  }
  return { container, table: () => table, trigger, items, item, menu, click }
}

describe('HeaderMenu', () => {
  it('offers only the actions a column supports', async () => {
    const { trigger, items, click } = mount()
    await click(trigger('Name')!)
    expect(items()).toEqual(['↑ Sort ascending', '↓ Sort descending', 'Filter…', 'Hide column'])
    await click(trigger('Name')!)
    await click(trigger('Score')!)
    expect(items()).toEqual(['Filter…', 'Hide column'])
    await click(trigger('Score')!)
    await click(trigger('Dept')!)
    expect(items()).toContain('Group by this column')
  })

  it('has no button when nothing applies', () => {
    const { trigger } = mount([{ key: 'name', label: 'Name', sortable: false, filterable: false }])
    expect(trigger('Name')).toBeNull()
  })

  it('sorts in the chosen direction without the header click toggling it, then refocuses its button', async () => {
    const { container, table, trigger, item, click } = mount()
    await click(trigger('Name')!)
    await click(item('Sort descending'))
    expect(table().sort.entries).toEqual([{ key: 'name', dir: 'desc' }])
    expect(container.querySelector('th[aria-sort]')?.getAttribute('aria-sort')).toBe('descending')
    expect(document.activeElement).toBe(trigger('Name'))
  })

  it('moves focus to the button now in place of a hidden column', async () => {
    const { table, trigger, item, click } = mount()
    await click(trigger('Name')!)
    await click(item('Hide column'))
    expect(table().columns.visible).not.toContain('name')
    expect(document.activeElement).toBe(trigger('Dept'))
  })

  it('groups by the column, then drops the item once grouped', async () => {
    const { table, trigger, items, item, click } = mount()
    await click(trigger('Dept')!)
    await click(item('Group by this column'))
    expect(table().group.by).toEqual(['dept'])
    expect(trigger('Dept')).toBeNull()
    await click(trigger('Name')!)
    expect(items()).not.toContain('Group by this column')
  })

  it('opens the Filter dropdown on the column, expanding its category', async () => {
    const { container, trigger, item, menu, click } = mount()
    await click(trigger('Score')!)
    await click(item('Filter…'))
    await tick()
    const active = container.querySelector('[data-filter-col-key="score"]')
    expect(active).not.toBeNull()
    expect(document.activeElement).toBe(active)
    expect(menu()).toBeNull()
  })

  it('closes on Escape back to its button and moves between items with arrows', async () => {
    const { trigger, menu, click } = mount()
    await click(trigger('Name')!)
    expect(document.activeElement?.textContent).toContain('Sort ascending')
    fireEvent.keyDown(menu()!, { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toContain('Hide column')
    fireEvent.keyDown(menu()!, { key: 'Escape' })
    await tick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Name'))
  })

  it('marks the button of a filtered column', () => {
    const { trigger } = mount(COLS, { filters: { dept: ['Eng'] } })
    expect(trigger('Dept')!.style.color).toBe('var(--color-text-info)')
    expect(trigger('Name')!.style.color).toBe('var(--color-text-secondary)')
  })
})
