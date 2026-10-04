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

const isFiltered = (el: HTMLElement) => el.style.color === 'var(--color-text-info)'

describe('HeaderMenu', () => {
  it('offers only the actions a column supports', async () => {
    const { trigger, items, click } = mount()
    await click(trigger('Name')!)
    expect(items()).toEqual(['Filter▸', 'Hide column'])
    await click(trigger('Name')!)
    await click(trigger('Score')!)
    expect(items()).toEqual(['Filter▸', 'Hide column'])
    await click(trigger('Score')!)
    await click(trigger('Dept')!)
    expect(items()).toContain('Group by this column')
  })

  it('has no button when nothing applies', () => {
    const { trigger } = mount([{ key: 'name', label: 'Name', sortable: false, filterable: false }])
    expect(trigger('Name')).toBeNull()
  })

  it('sorts from the header label button, adding with Shift, but not from ▾', async () => {
    const { container, table, trigger, click } = mount()
    const sortButton = (label: string) =>
      [...container.querySelectorAll<HTMLButtonElement>('th button:not([data-col-menu])')].find(
        (b) => b.textContent!.startsWith(label),
      )
    await click(trigger('Name')!)
    expect(table().sort.entries).toEqual([])
    await click(sortButton('Name')!)
    expect(table().sort.entries).toEqual([{ key: 'name', dir: 'asc' }])
    act(() => {
      fireEvent.click(sortButton('Dept')!, { shiftKey: true })
    })
    await tick()
    expect(table().sort.entries).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'dept', dir: 'asc' },
    ])
    expect(sortButton('Score')).toBeUndefined()
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

  it('filters the column from a flyout', async () => {
    const { container, table, trigger, item, click } = mount()
    await click(trigger('Dept')!)
    await click(item('Filter'))
    const flyout = container.querySelector<HTMLElement>('[data-category-submenu]')!
    expect(document.activeElement).toBe(flyout.querySelector('input[data-dd-value-search]'))
    await click(flyout.querySelector<HTMLInputElement>('input[data-value="HR"]')!)
    expect([...(table().filter.exclude.dept ?? [])]).toEqual(['HR'])
    expect(isFiltered(trigger('Dept')!)).toBe(true)
  })

  it('keeps ← in the flyout search box, and backs out one level per Escape', async () => {
    const { container, trigger, item, menu, click } = mount()
    await click(trigger('Dept')!)
    await click(item('Filter'))
    const search = document.activeElement as HTMLInputElement
    const key = async (k: string) => {
      act(() => {
        fireEvent.keyDown(document.activeElement!, { key: k })
      })
      await tick()
    }
    act(() => {
      fireEvent.change(search, { target: { value: 'E' } })
    })
    await key('ArrowLeft')
    expect(container.querySelector('[data-category-submenu]')).not.toBeNull()
    await key('Escape')
    expect(search.value).toBe('')
    await key('Escape')
    expect(container.querySelector('[data-category-submenu]')).toBeNull()
    expect(document.activeElement).toBe(item('Filter'))
    await key('Escape')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Dept'))
  })

  it('closes on Escape back to its button and moves between items with arrows', async () => {
    const { trigger, menu, click } = mount()
    await click(trigger('Name')!)
    expect(document.activeElement?.textContent).toContain('Filter')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toContain('Hide column')
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await tick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Name'))
  })

  it('stops its header from dragging while open, so the flyout slider drags its thumb', async () => {
    const { trigger, click } = mount()
    const th = () => trigger('Score')!.closest('th')!
    expect(th().getAttribute('draggable')).toBe('true')
    await click(trigger('Score')!)
    expect(th().getAttribute('draggable')).toBe('false')
    await click(trigger('Score')!)
    expect(th().getAttribute('draggable')).toBe('true')
  })

  it('marks the button of a filtered column', () => {
    const { trigger } = mount(COLS, { filters: { dept: ['Eng'] } })
    expect(isFiltered(trigger('Dept')!)).toBe(true)
    expect(isFiltered(trigger('Name')!)).toBe(false)
  })
})
