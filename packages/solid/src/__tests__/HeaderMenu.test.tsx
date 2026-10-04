import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { DataTableView } from '../DataTableView'
import type { ColumnDef } from '../types'
import type { TableViewState } from '@vates/data-table-core'

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

const tick = () => new Promise((r) => setTimeout(r))

function mount(cols = COLS, initialViewState?: TableViewState) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, cols, { initialViewState })
    render(() => <DataTableView table={table} rowKey="id" />, container)
    return d
  })
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
  return {
    container,
    table,
    trigger,
    items,
    item,
    menu,
    dispose: () => {
      dispose()
      container.remove()
    },
  }
}

describe('HeaderMenu', () => {
  it('offers only the actions a column supports', async () => {
    const { trigger, items, dispose } = mount()
    trigger('Name')!.click()
    await tick()
    expect(items()).toEqual(['↑ Sort ascending', '↓ Sort descending', 'Filter…', 'Hide column'])
    trigger('Name')!.click()
    trigger('Score')!.click()
    await tick()
    expect(items()).toEqual(['Filter…', 'Hide column'])
    trigger('Score')!.click()
    trigger('Dept')!.click()
    await tick()
    expect(items()).toContain('Group by this column')
    dispose()
  })

  it('has no button when nothing applies', () => {
    const { trigger, dispose } = mount([
      { key: 'name', label: 'Name', sortable: false, filterable: false },
    ])
    expect(trigger('Name')).toBeNull()
    dispose()
  })

  it('sorts in the chosen direction without the header click toggling it, then refocuses its button', async () => {
    const { container, table, trigger, item, dispose } = mount()
    trigger('Name')!.click()
    await tick()
    item('Sort descending').click()
    await tick()
    expect(table.sort.entries()).toEqual([{ key: 'name', dir: 'desc' }])
    expect(container.querySelector('th[aria-sort]')?.getAttribute('aria-sort')).toBe('descending')
    expect(document.activeElement).toBe(trigger('Name'))
    dispose()
  })

  it('moves focus to the button now in place of a hidden column', async () => {
    const { table, trigger, item, dispose } = mount()
    trigger('Name')!.click()
    await tick()
    item('Hide column').click()
    await tick()
    expect(table.columns.visible()).not.toContain('name')
    expect(document.activeElement).toBe(trigger('Dept'))
    dispose()
  })

  it('groups by the column, then drops the item once grouped', async () => {
    const { table, trigger, items, item, dispose } = mount()
    trigger('Dept')!.click()
    await tick()
    item('Group by this column').click()
    await tick()
    expect(table.group.by()).toEqual(['dept'])
    expect(trigger('Dept')).toBeNull()
    trigger('Name')!.click()
    await tick()
    expect(items()).not.toContain('Group by this column')
    dispose()
  })

  it('opens the Filter dropdown on the column, expanding its category', async () => {
    const { container, trigger, item, menu, dispose } = mount()
    trigger('Score')!.click()
    await tick()
    item('Filter…').click()
    await tick()
    await tick()
    const active = container.querySelector('[data-filter-col-key="score"]')
    expect(active).not.toBeNull()
    expect(document.activeElement).toBe(active)
    expect(menu()).toBeNull()
    dispose()
  })

  it('closes on Escape back to its button and moves between items with arrows', async () => {
    const { trigger, menu, dispose } = mount()
    trigger('Name')!.click()
    await tick()
    expect(document.activeElement?.textContent).toContain('Sort ascending')
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement?.textContent).toContain('Hide column')
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Name'))
    dispose()
  })

  it('marks the button of a filtered column', () => {
    const { trigger, dispose } = mount(COLS, { filters: { dept: ['Eng'] } })
    expect(trigger('Dept')!.classList.contains('dt-th-menu--filtered')).toBe(true)
    expect(trigger('Name')!.classList.contains('dt-th-menu--filtered')).toBe(false)
    dispose()
  })
})
