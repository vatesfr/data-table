import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTableRaw from '../DataTable.vue'
import type { ColumnDef } from '../types'

// vue-tsc can't carry the SFC's `generic="TRow extends object"` parameter through
// to consumers, so `mount()` sees props typed for the unbounded default — cast once
// here rather than sprinkling `as any` through every test.
const DataTable = DataTableRaw as unknown as new () => { $props: Record<string, unknown> }

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

describe('DataTable — rowClick', () => {
  it('emits rowClick with the row and the click event', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id' },
    })
    await wrapper.find('tbody tr').trigger('click')
    expect(wrapper.emitted('rowClick')).toBeTruthy()
    expect(wrapper.emitted('rowClick')![0][0]).toEqual(ROWS[0])
  })

  it('does not add the clickable class when no rowClick listener is attached', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id' },
    })
    expect(wrapper.find('tbody tr').classes()).not.toContain('dt__tr--clickable')
  })

  it('adds the clickable class when a rowClick listener is attached', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id', onRowClick: vi.fn() },
    })
    expect(wrapper.find('tbody tr').classes()).toContain('dt__tr--clickable')
  })

  it('clicking the selection checkbox does not emit rowClick', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id', selectable: true },
    })
    await wrapper.find('tbody tr input[type="checkbox"]').trigger('click')
    expect(wrapper.emitted('rowClick')).toBeFalsy()
  })
})

describe('DataTable — aggregate row', () => {
  it('does not render an aggregate row when there is no grouping', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', type: 'number', aggregate: 'sum' },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    expect(wrapper.find('.dt__agg-row').exists()).toBe(false)
  })

  it('renders an aggregate row per group when grouping is active', async () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', groupable: true },
      { key: 'score', label: 'Score', type: 'number', aggregate: 'sum' },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    const groupBtn = wrapper.findAll('button').find((b) => b.text() === 'Group')!
    await groupBtn.trigger('click')
    const nameItem = wrapper.findAll('.dt__dd-item').find((el) => el.text().includes('Name'))!
    await nameItem.trigger('click')
    expect(wrapper.find('.dt__agg-row').exists()).toBe(true)
  })
})

describe('DataTable — filter dropdown', () => {
  const FILTER_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'score', label: 'Score', type: 'number', filterable: true },
  ]

  it('defaults the detail pane to the first filterable column', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    expect(
      wrapper
        .findAll('.dt__filter-col-item')
        .find((el) => el.text().includes('Name'))!
        .classes(),
    ).toContain('dt__filter-col-item--active')
    expect(wrapper.findAll('.dt__dd-item').some((el) => el.text().includes('Alice'))).toBe(true)
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('clicking a column in the list switches the detail pane to it', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    expect(wrapper.find('input[type="number"]').exists()).toBe(true)
    expect(wrapper.findAll('.dt__dd-item')).toHaveLength(0)
  })

  it('search narrows the checklist to matching values', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.find('.dt__dd-search').setValue('ali')
    const labels = wrapper.findAll('.dt__dd-item').map((el) => el.text())
    expect(labels.some((t) => t.includes('Alice'))).toBe(true)
    expect(labels.some((t) => t.includes('Bob'))).toBe(false)
  })

  function checklistCheckbox(wrapper: ReturnType<typeof mount>, value: string) {
    return wrapper
      .findAll('.dt__dd-item')
      .find((el) => el.text() === value)!
      .find('input[type="checkbox"]')
  }

  it('select-all checkbox selects every currently listed value', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.find('.dt__filter-select-all').trigger('change')
    expect((checklistCheckbox(wrapper, 'Alice').element as HTMLInputElement).checked).toBe(true)
    expect((checklistCheckbox(wrapper, 'Bob').element as HTMLInputElement).checked).toBe(true)
  })

  it('select-all checkbox deselects every value when all are already selected', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const selectAll = wrapper.find('.dt__filter-select-all')
    await selectAll.trigger('change')
    await selectAll.trigger('change')
    expect((checklistCheckbox(wrapper, 'Alice').element as HTMLInputElement).checked).toBe(false)
    expect((checklistCheckbox(wrapper, 'Bob').element as HTMLInputElement).checked).toBe(false)
  })

  it('select-all checkbox only affects the search-narrowed values', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.find('.dt__dd-search').setValue('ali')
    await wrapper.find('.dt__filter-select-all').trigger('change')
    expect((checklistCheckbox(wrapper, 'Alice').element as HTMLInputElement).checked).toBe(true)
    await wrapper.find('.dt__dd-search').setValue('')
    expect((checklistCheckbox(wrapper, 'Bob').element as HTMLInputElement).checked).toBe(false)
  })

  it('hides the select-all checkbox when search matches no values', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.find('.dt__dd-search').setValue('zzz')
    expect(wrapper.find('.dt__filter-select-all').exists()).toBe(false)
    expect(wrapper.find('.dt__dd-search').exists()).toBe(true)
  })
})

describe('DataTable — computed columns', () => {
  it('renders a cell value produced by col.value instead of row[key]', () => {
    const cols: ColumnDef<Row>[] = [
      ...COLS,
      { key: 'grade', label: 'Grade', value: (row: Row) => (row.score >= 70 ? 'Pass' : 'Fail') },
    ]
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: cols, rowKey: 'id' },
    })
    expect(wrapper.text()).toContain('Pass')
    expect(wrapper.text()).toContain('Fail')
  })
})
