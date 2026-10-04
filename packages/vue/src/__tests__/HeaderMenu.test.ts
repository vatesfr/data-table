import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useTableState } from '../useTableState'
import DataTableViewRaw from '../DataTableView.vue'
import type { ColumnDef } from '../types'
import type { TableViewState } from '@vates/data-table-core'

const DataTableView = DataTableViewRaw as unknown as new () => { $props: Record<string, unknown> }

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

function mountView(cols = COLS, initialViewState?: TableViewState) {
  let table!: ReturnType<typeof useTableState<Row>>
  const Comp = defineComponent({
    setup() {
      table = useTableState(ROWS, cols, { initialViewState })
      return () =>
        h(DataTableView, { table, data: ROWS, columns: cols, rowKey: 'id' } as Record<
          string,
          unknown
        >)
    },
  })
  const wrapper = mount(Comp, { attachTo: document.body })
  const el = wrapper.element as HTMLElement
  const trigger = (label: string) =>
    el.querySelector<HTMLButtonElement>(`[aria-label="${label} options"]`)
  const menuItems = () => [...el.querySelectorAll<HTMLButtonElement>('[role=menuitem]')]
  const items = () => menuItems().map((b) => b.textContent!.trim())
  const item = (name: string) => menuItems().find((b) => b.textContent!.includes(name))!
  const menu = () => el.querySelector<HTMLElement>('[role=menu]')
  return { table, el, trigger, items, item, menu, unmount: () => wrapper.unmount() }
}

describe('HeaderMenu', () => {
  it('offers only the actions a column supports', async () => {
    const { trigger, items, unmount } = mountView()
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
    unmount()
  })

  it('has no button when nothing applies', () => {
    const { trigger, unmount } = mountView([
      { key: 'name', label: 'Name', sortable: false, filterable: false },
    ])
    expect(trigger('Name')).toBeNull()
    unmount()
  })

  it('sorts from the header label button, adding with Shift, but not from ▾', async () => {
    const { el, table, trigger, unmount } = mountView()
    const sortButton = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('button.dt__th-sort')].find((b) =>
        b.textContent!.trim().startsWith(label),
      )
    trigger('Name')!.click()
    await tick()
    expect(table.sort.entries.value).toEqual([])
    sortButton('Name')!.click()
    expect(table.sort.entries.value).toEqual([{ key: 'name', dir: 'asc' }])
    sortButton('Dept')!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    expect(table.sort.entries.value).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'dept', dir: 'asc' },
    ])
    expect(sortButton('Score')).toBeUndefined()
    unmount()
  })

  it('moves focus to the button now in place of a hidden column', async () => {
    const { table, trigger, item, unmount } = mountView()
    trigger('Name')!.click()
    await tick()
    item('Hide column').click()
    await tick()
    expect(table.columns.visible.value).not.toContain('name')
    expect(document.activeElement).toBe(trigger('Dept'))
    unmount()
  })

  it('groups by the column, then drops the item once grouped', async () => {
    const { table, trigger, items, item, unmount } = mountView()
    trigger('Dept')!.click()
    await tick()
    item('Group by this column').click()
    await tick()
    expect(table.group.by.value).toEqual(['dept'])
    expect(trigger('Dept')).toBeNull()
    trigger('Name')!.click()
    await tick()
    expect(items()).not.toContain('Group by this column')
    unmount()
  })

  it('filters the column from a flyout', async () => {
    const { el, table, trigger, item, unmount } = mountView()
    trigger('Dept')!.click()
    await tick()
    item('Filter').click()
    await tick()
    const flyout = el.querySelector<HTMLElement>('.dt__th-filter-flyout')!
    expect(document.activeElement).toBe(flyout.querySelector('input.dt__dd-search'))
    flyout.querySelector<HTMLInputElement>('input[data-value="HR"]')!.click()
    await tick()
    expect([...(table.filter.exclude.value.dept ?? [])]).toEqual(['HR'])
    expect(trigger('Dept')!.classList.contains('dt__th-menu--filtered')).toBe(true)
    unmount()
  })

  it('keeps ← in the flyout search box, and backs out one level per Escape', async () => {
    const { el, trigger, item, menu, unmount } = mountView()
    trigger('Dept')!.click()
    await tick()
    item('Filter').click()
    await tick()
    const search = document.activeElement as HTMLInputElement
    const key = (k: string) =>
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    search.value = 'E'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
    key('ArrowLeft')
    await tick()
    expect(el.querySelector('.dt__th-filter-flyout')).not.toBeNull()
    key('Escape')
    await tick()
    expect(search.value).toBe('')
    key('Escape')
    await tick()
    expect(el.querySelector('.dt__th-filter-flyout')).toBeNull()
    expect(document.activeElement).toBe(item('Filter'))
    key('Escape')
    await tick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger('Dept'))
    unmount()
  })

  it('closes on Escape back to its button and moves between items with arrows', async () => {
    const { trigger, menu, unmount } = mountView()
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
    unmount()
  })

  it('stops its header from dragging while open, so the flyout slider drags its thumb', async () => {
    const { trigger, unmount } = mountView()
    const th = () => trigger('Score')!.closest('th')!
    expect(th().getAttribute('draggable')).toBe('true')
    trigger('Score')!.click()
    await tick()
    expect(th().getAttribute('draggable')).toBe('false')
    trigger('Score')!.click()
    await tick()
    expect(th().getAttribute('draggable')).toBe('true')
    unmount()
  })

  it('marks the button of a filtered column', () => {
    const { trigger, unmount } = mountView(COLS, { filters: { dept: ['Eng'] } })
    expect(trigger('Dept')!.classList.contains('dt__th-menu--filtered')).toBe(true)
    expect(trigger('Name')!.classList.contains('dt__th-menu--filtered')).toBe(false)
    unmount()
  })
})
