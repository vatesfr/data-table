import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { DataTableView } from '../DataTableView'
import type { ColumnDef } from '../types'
import type { TableViewState } from '@vates/data-table-core'
import { stubMatchMedia } from './stubMatchMedia'

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
    container.querySelector<HTMLButtonElement>(`[aria-label^="${label} options"]`)
  const menu = () => container.querySelector<HTMLElement>('[role=dialog]')
  // The panel's own items, not the filter flyout's controls
  const menuItems = () =>
    [...(menu()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].filter(
      (b) => !b.closest('.dt-th-filter-flyout'),
    )
  const items = () => menuItems().map((b) => b.textContent!.trim())
  const item = (name: string) => menuItems().find((b) => b.textContent!.includes(name))!
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
    expect(items()).toEqual(['Filter▸', 'Hide column'])
    trigger('Name')!.click()
    trigger('Score')!.click()
    await tick()
    expect(items()).toEqual(['Filter▸', 'Hide column'])
    trigger('Score')!.click()
    trigger('Dept')!.click()
    await tick()
    expect(items()).toContain('Group by this column')
    dispose()
  })

  it('shows a sort arrow on sortable headers only', () => {
    const { trigger, dispose } = mount()
    const th = (label: string) => trigger(label)!.closest('th')!
    expect(th('Name').textContent).toContain('↕')
    expect(th('Score').textContent).not.toContain('↕')
    dispose()
  })

  it('has no button when nothing applies', () => {
    const { trigger, dispose } = mount([
      { key: 'name', label: 'Name', sortable: false, filterable: false },
    ])
    expect(trigger('Name')).toBeNull()
    dispose()
  })

  it('sorts from the header label button, adding with Shift, but not from ▾', async () => {
    const { container, table, trigger, dispose } = mount()
    const sortButton = (label: string) =>
      [...container.querySelectorAll<HTMLButtonElement>('button.dt-th-sort')].find((b) =>
        b.textContent!.startsWith(label),
      )
    trigger('Name')!.click()
    await tick()
    expect(table.sort.entries()).toEqual([])
    sortButton('Name')!.click()
    expect(table.sort.entries()).toEqual([{ key: 'name', dir: 'asc' }])
    sortButton('Dept')!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    expect(table.sort.entries()).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'dept', dir: 'asc' },
    ])
    expect(sortButton('Score')).toBeUndefined()
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

  it('removes the group from a grouped column kept visible', async () => {
    const { table, trigger, item, dispose } = mount(
      COLS.map((c) => (c.key === 'dept' ? { ...c, keepVisibleWhenGrouped: true } : c)),
      { groupBy: ['dept'] },
    )
    trigger('Dept')!.click()
    await tick()
    item('Remove group').click()
    await tick()
    expect(table.group.by()).toEqual([])
    dispose()
  })

  it('filters the column from a flyout', async () => {
    const { container, table, trigger, item, dispose } = mount()
    trigger('Dept')!.click()
    await tick()
    item('Filter').click()
    await tick()
    const flyout = container.querySelector<HTMLElement>('.dt-th-filter-flyout')!
    expect(document.activeElement).toBe(flyout.querySelector('input[data-dd-value-search]'))
    flyout.querySelector<HTMLInputElement>('input[data-value="HR"]')!.click()
    expect([...(table.filter.exclude().dept ?? [])]).toEqual(['HR'])
    expect(trigger('Dept')!.classList.contains('dt-th-menu--filtered')).toBe(true)
    dispose()
  })

  it('keeps ← in the flyout search box, and backs out one level per Escape', async () => {
    const { container, trigger, item, menu, dispose } = mount()
    trigger('Dept')!.click()
    await tick()
    item('Filter').click()
    await tick()
    const search = document.activeElement as HTMLInputElement
    const key = (k: string) =>
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    search.value = 'E'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    key('ArrowLeft')
    expect(container.querySelector('.dt-th-filter-flyout')).not.toBeNull()
    key('Escape')
    expect(search.value).toBe('')
    key('Escape')
    expect(container.querySelector('.dt-th-filter-flyout')).toBeNull()
    expect(document.activeElement).toBe(item('Filter'))
    key('Escape')
    await tick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Dept'))
    dispose()
  })

  it('is a dialog named after its column, with a labelled filter group', async () => {
    const { container, trigger, item, menu, dispose } = mount()
    trigger('Dept')!.click()
    await tick()
    expect(trigger('Dept')!.getAttribute('aria-haspopup')).toBe('dialog')
    expect(menu()!.getAttribute('aria-label')).toBe('Dept options')
    item('Filter').click()
    await tick()
    const flyout = container.querySelector<HTMLElement>('.dt-th-filter-flyout')!
    expect(flyout.getAttribute('role')).toBe('group')
    expect(flyout.getAttribute('aria-label')).toBe('Filter')
    dispose()
  })

  it('lets Tab move through it, and closes once focus leaves it', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const { trigger, menu, dispose } = mount()
    trigger('Name')!.click()
    await tick()
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    await tick()
    expect(menu()).not.toBeNull()
    outside.focus()
    await tick()
    expect(menu()).toBeNull()
    outside.remove()
    dispose()
  })

  it('closes on Escape back to its button and moves between items with arrows', async () => {
    const { trigger, menu, dispose } = mount()
    trigger('Name')!.click()
    await tick()
    expect(document.activeElement?.textContent).toContain('Filter')
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    )
    expect(document.activeElement?.textContent).toContain('Hide column')
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await tick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Name'))
    dispose()
  })

  it('stops its header from dragging while open, so the flyout slider drags its thumb', async () => {
    const { trigger, dispose } = mount()
    const th = () => trigger('Score')!.closest('th')!
    expect(th().getAttribute('draggable')).toBe('true')
    trigger('Score')!.click()
    await tick()
    expect(th().getAttribute('draggable')).toBe('false')
    trigger('Score')!.click()
    expect(th().getAttribute('draggable')).toBe('true')
    dispose()
  })

  it('clears a filtered column from its menu, then refocuses its button', async () => {
    const { table, trigger, items, item, dispose } = mount(COLS, {
      excludeFilters: { dept: ['HR'] },
    })
    trigger('Name')!.click()
    await tick()
    expect(items()).not.toContain('Clear filter')
    trigger('Name')!.click()
    trigger('Dept')!.click()
    await tick()
    expect(items()).toEqual(['Filter▸', 'Clear filter', 'Group by this column', 'Hide column'])
    item('Clear filter').click()
    await tick()
    expect(table.filter.activeCount()).toBe(0)
    expect(document.activeElement).toBe(trigger('Dept'))
    dispose()
  })

  it('marks the button of a filtered column', () => {
    const { trigger, dispose } = mount(COLS, { filters: { dept: ['Eng'] } })
    expect(trigger('Dept')!.classList.contains('dt-th-menu--filtered')).toBe(true)
    expect(trigger('Name')!.classList.contains('dt-th-menu--filtered')).toBe(false)
    // Named and shaped as filtered, not only colored (U19)
    expect(trigger('Dept')!.getAttribute('aria-label')).toBe('Dept options, filtered')
    expect(trigger('Dept')!.querySelector('svg')).not.toBeNull()
    expect(trigger('Name')!.getAttribute('aria-label')).toBe('Name options')
    expect(trigger('Name')!.querySelector('svg')).toBeNull()
    dispose()
  })
})

describe('HeaderMenu — narrow screen', () => {
  let restore: () => void
  beforeEach(() => {
    restore = stubMatchMedia(true)
  })
  afterEach(() => restore())

  it('swaps its items for the filter pane, focusing the back row, and goes back', async () => {
    const { trigger, items, item, menu, dispose } = mount()
    trigger('Dept')!.click()
    await tick()
    item('Filter').click()
    await tick()
    const back = menu()!.querySelector<HTMLButtonElement>('[data-menu-back]')!
    expect(back.textContent).toContain('Dept')
    expect(document.activeElement).toBe(back)
    expect(
      menu()!.querySelector('[role=group][aria-label="Filter"] input[data-dd-value-search]'),
    ).not.toBeNull()
    expect(items()).not.toContain('Hide column')
    back.click()
    await tick()
    expect(items()).toContain('Hide column')
    expect(document.activeElement).toBe(item('Filter'))
    dispose()
  })

  it('goes back to its items on Escape', async () => {
    const { trigger, items, item, menu, dispose } = mount()
    trigger('Dept')!.click()
    await tick()
    item('Filter').click()
    await tick()
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await tick()
    expect(menu()).not.toBeNull()
    expect(items()).toContain('Hide column')
    dispose()
  })
})
