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

  it('hides a value with zero rows matching under other active filters', async () => {
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
    const wrapper = mount(DataTable, { props: { data: ROWS2, columns: COLS2, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await checklistCheckbox(wrapper, 'Alice').trigger('click')
    const deptItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Dept'))!
    await deptItem.trigger('click')
    const labels = wrapper.findAll('.dt__dd-item').map((el) => el.text())
    expect(labels.some((t) => t.startsWith('Eng'))).toBe(true)
    expect(labels.some((t) => t.startsWith('HR'))).toBe(false)
  })

  it('keeps a selected value visible even when its live count drops to 0', async () => {
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
    const wrapper = mount(DataTable, { props: { data: ROWS2, columns: COLS2, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const deptItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Dept'))!
    await deptItem.trigger('click')
    // Select dept=HR (Bob) while it's still the only active filter, so it's visible to check.
    await checklistCheckbox(wrapper, 'HR').trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    // A min-score range filter that excludes Bob (score 60) zeroes HR's live facet count —
    // range filters, unlike a column's own checklist filter, are never excluded from a facet.
    await wrapper.find('input[placeholder="Min"]').setValue('100')
    await deptItem.trigger('click')
    expect((checklistCheckbox(wrapper, 'HR').element as HTMLInputElement).checked).toBe(true)
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
      .find((el) => el.text().startsWith(value))!
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

  it('shift-clicking a checklist value selects the range from the last-clicked value', async () => {
    const ROWS4: Row[] = [
      { id: 1, name: 'Alice', score: 90 },
      { id: 2, name: 'Bob', score: 60 },
      { id: 3, name: 'Clara', score: 80 },
      { id: 4, name: 'David', score: 70 },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS4, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await checklistCheckbox(wrapper, 'Alice').trigger('click')
    await checklistCheckbox(wrapper, 'Clara').trigger('click', { shiftKey: true })
    expect((checklistCheckbox(wrapper, 'Alice').element as HTMLInputElement).checked).toBe(true)
    expect((checklistCheckbox(wrapper, 'Bob').element as HTMLInputElement).checked).toBe(true)
    expect((checklistCheckbox(wrapper, 'Clara').element as HTMLInputElement).checked).toBe(true)
    expect((checklistCheckbox(wrapper, 'David').element as HTMLInputElement).checked).toBe(false)
  })

  it('shift-clicking an already-selected checklist value deselects the range', async () => {
    const ROWS4: Row[] = [
      { id: 1, name: 'Alice', score: 90 },
      { id: 2, name: 'Bob', score: 60 },
      { id: 3, name: 'Clara', score: 80 },
      { id: 4, name: 'David', score: 70 },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS4, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.find('.dt__filter-select-all').trigger('change')
    await checklistCheckbox(wrapper, 'Alice').trigger('click')
    await checklistCheckbox(wrapper, 'Alice').trigger('click')
    await checklistCheckbox(wrapper, 'Clara').trigger('click', { shiftKey: true })
    expect((checklistCheckbox(wrapper, 'Alice').element as HTMLInputElement).checked).toBe(false)
    expect((checklistCheckbox(wrapper, 'Bob').element as HTMLInputElement).checked).toBe(false)
    expect((checklistCheckbox(wrapper, 'Clara').element as HTMLInputElement).checked).toBe(false)
    expect((checklistCheckbox(wrapper, 'David').element as HTMLInputElement).checked).toBe(true)
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

  function checklistValueOrder(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper
      .findAll('.dt__dd-item')
      .map((el) => el.text().match(/^[A-Za-z]+/)?.[0])
      .filter((v): v is string => !!v)
  }

  async function openTagsFilter(wrapper: ReturnType<typeof mount>) {
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
  }

  it('sorts checklist values alphabetically ascending by default', async () => {
    const wrapper = mount(DataTable, { props: { data: TAG_ROWS, columns: TAG_COLS, rowKey: 'id' } })
    await openTagsFilter(wrapper)
    expect(checklistValueOrder(wrapper)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('cycles to alphabetical descending on the first click', async () => {
    const wrapper = mount(DataTable, { props: { data: TAG_ROWS, columns: TAG_COLS, rowKey: 'id' } })
    await openTagsFilter(wrapper)
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    expect(checklistValueOrder(wrapper)).toEqual(['RPG', 'Adventure', 'Action'])
  })

  it('cycles to count descending (tie-broken alphabetically) on the second click', async () => {
    const wrapper = mount(DataTable, { props: { data: TAG_ROWS, columns: TAG_COLS, rowKey: 'id' } })
    await openTagsFilter(wrapper)
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    expect(checklistValueOrder(wrapper)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('cycles to count ascending (tie-broken alphabetically) on the third click', async () => {
    const wrapper = mount(DataTable, { props: { data: TAG_ROWS, columns: TAG_COLS, rowKey: 'id' } })
    await openTagsFilter(wrapper)
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    expect(checklistValueOrder(wrapper)).toEqual(['Adventure', 'RPG', 'Action'])
  })

  it('cycles back to alphabetical ascending on the fourth click', async () => {
    const wrapper = mount(DataTable, { props: { data: TAG_ROWS, columns: TAG_COLS, rowKey: 'id' } })
    await openTagsFilter(wrapper)
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    expect(checklistValueOrder(wrapper)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('toggles the date tree between chronologically ascending and descending', async () => {
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
    function yearOrder(wrapper: ReturnType<typeof mount>): string[] {
      return wrapper
        .findAll('.dt__date-tree-item')
        .map((el) => el.text().match(/\d{4}/)?.[0])
        .filter((v): v is string => !!v)
    }
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    await openTagsFilter(wrapper)
    expect(yearOrder(wrapper)).toEqual(['2021', '2023'])
    await wrapper.find('.dt__value-sort-btn').trigger('click')
    expect(yearOrder(wrapper)).toEqual(['2023', '2021'])
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

  function treeItem(wrapper: ReturnType<typeof mount>, text: string) {
    return wrapper.findAll('.dt__date-tree-item').find((el) => el.text().includes(text))!
  }

  // Day leaves have no `.dt__date-tree-toggle--branch` span (only year/month branches do), and
  // their rendered text has the hidden facet count glued on with no separator (e.g. day "20"
  // renders as "201"), so a plain substring match on a year like "2024" would also match "20" —
  // filtering to leaf rows first disambiguates cleanly.
  function dayTreeItem(wrapper: ReturnType<typeof mount>, day: string) {
    return wrapper
      .findAll('.dt__date-tree-item')
      .find(
        (el) => !el.find('.dt__date-tree-toggle--branch').exists() && el.text().startsWith(day),
      )!
  }

  it('renders year nodes collapsed by default, with months hidden until expanded', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    expect(wrapper.text()).toContain('2023')
    expect(wrapper.text()).toContain('2021')
    expect(wrapper.text()).not.toContain('May')
  })

  it('expanding a year reveals its months, expanding a month reveals its days', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await treeItem(wrapper, '2023').find('.dt__date-tree-toggle--branch').trigger('click')
    expect(wrapper.text()).toContain('May')
    await treeItem(wrapper, 'May').find('.dt__date-tree-toggle--branch').trigger('click')
    expect(treeItem(wrapper, '14').exists()).toBe(true)
    expect(treeItem(wrapper, '20').exists()).toBe(true)
  })

  it('checking a year node selects every date under it and filters rows accordingly', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await treeItem(wrapper, '2023').find('input[type="checkbox"]').trigger('click')
    expect(wrapper.text()).toContain('Game A')
    expect(wrapper.text()).toContain('Game B')
    expect(wrapper.text()).not.toContain('Game C')
  })

  it('unchecking an already fully-selected year deselects every date under it', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const yearCheckbox = treeItem(wrapper, '2023').find('input[type="checkbox"]')
    await yearCheckbox.trigger('click')
    await yearCheckbox.trigger('click')
    expect(wrapper.text()).toContain('Game C')
  })

  it('is indeterminate on a month node when only some of its days are selected', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await treeItem(wrapper, '2023').find('.dt__date-tree-toggle--branch').trigger('click')
    await treeItem(wrapper, 'May').find('.dt__date-tree-toggle--branch').trigger('click')
    await treeItem(wrapper, '14').find('input[type="checkbox"]').trigger('click')
    const monthCheckbox = treeItem(wrapper, 'May').find('input[type="checkbox"]')
      .element as HTMLInputElement
    expect(monthCheckbox.indeterminate).toBe(true)
  })

  it('caps the active-filter chip at 3 values, summarizing the rest as "+N more"', async () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-01-01' },
      { id: 2, name: 'Game B', released: '2023-02-01' },
      { id: 3, name: 'Game C', released: '2023-03-01' },
      { id: 4, name: 'Game D', released: '2023-04-01' },
    ]
    const wrapper = mount(DataTable, { props: { data: rows, columns: DATE_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await treeItem(wrapper, '2023').find('input[type="checkbox"]').trigger('click')
    expect(wrapper.find('.dt__chip--info').text()).toContain(
      '2023-01-01, 2023-02-01, 2023-03-01, +1 more',
    )
  })

  it('shift-clicking two day nodes selects the range between them, not other years', async () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2023-05-20' },
      { id: 3, name: 'Game C', released: '2021-01-02' },
      { id: 4, name: 'Game D', released: '2024-07-01' },
    ]
    const wrapper = mount(DataTable, { props: { data: rows, columns: DATE_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await treeItem(wrapper, '2023').find('.dt__date-tree-toggle--branch').trigger('click')
    await treeItem(wrapper, 'May').find('.dt__date-tree-toggle--branch').trigger('click')
    await dayTreeItem(wrapper, '14').find('input[type="checkbox"]').trigger('click')
    await dayTreeItem(wrapper, '20')
      .find('input[type="checkbox"]')
      .trigger('click', { shiftKey: true })
    expect(wrapper.text()).toContain('Game A')
    expect(wrapper.text()).toContain('Game B')
    expect(wrapper.text()).not.toContain('Game C')
    expect(wrapper.text()).not.toContain('Game D')
  })

  it('shift-clicking from a year down to a specific day does not pull in a later sibling day', async () => {
    const rows: GameRow[] = [
      { id: 1, name: 'Game A', released: '2023-05-14' },
      { id: 2, name: 'Game B', released: '2023-05-20' },
      { id: 3, name: 'Game C', released: '2021-01-02' },
      { id: 4, name: 'Game D', released: '2024-07-01' },
    ]
    const wrapper = mount(DataTable, { props: { data: rows, columns: DATE_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await treeItem(wrapper, '2023').find('.dt__date-tree-toggle--branch').trigger('click')
    await treeItem(wrapper, 'May').find('.dt__date-tree-toggle--branch').trigger('click')
    await treeItem(wrapper, '2021').find('input[type="checkbox"]').trigger('click')
    await dayTreeItem(wrapper, '14')
      .find('input[type="checkbox"]')
      .trigger('click', { shiftKey: true })
    // The range is a chronological interval (2021-01-02 through 2023-05-14), not a sweep over
    // rendered rows — so day 20 (chronologically after the target) must stay excluded even
    // though the "2023" year row sits between the anchor and the target.
    expect(wrapper.text()).toContain('Game A')
    expect(wrapper.text()).toContain('Game C')
    expect(wrapper.text()).not.toContain('Game B')
    expect(wrapper.text()).not.toContain('Game D')
  })
})

describe('DataTable — keyboard navigation', () => {
  const ROWS3: Row[] = [
    { id: 1, name: 'Alice', score: 90 },
    { id: 2, name: 'Bob', score: 60 },
    { id: 3, name: 'Clara', score: 80 },
  ]

  function dataRows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('tbody tr')
  }

  it('does not add a tabindex to rows when neither selectable nor onRowClick is set', () => {
    const wrapper = mount(DataTable, { props: { data: ROWS3, columns: COLS, rowKey: 'id' } })
    for (const row of dataRows(wrapper)) expect(row.attributes('tabindex')).toBeUndefined()
  })

  it('makes the first row the sole tab stop by default, the rest tabindex -1', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
    })
    const [first, ...rest] = dataRows(wrapper)
    expect(first.attributes('tabindex')).toBe('0')
    for (const row of rest) expect(row.attributes('tabindex')).toBe('-1')
  })

  it('excludes the row checkbox from the tab sequence', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
    })
    expect(wrapper.find('tbody tr input[type="checkbox"]').attributes('tabindex')).toBe('-1')
  })

  // document.activeElement only reflects focus() for elements connected to `document` — mount()
  // renders into a detached fragment by default, so these need `attachTo: document.body`.
  it('ArrowDown moves the roving tabindex to the next row', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
      attachTo: document.body,
    })
    const [first, second] = dataRows(wrapper)
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'ArrowDown' })
    expect(first.attributes('tabindex')).toBe('-1')
    expect(second.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(second.element)
    wrapper.unmount()
  })

  it('ArrowUp on the first row is a no-op (clamped at the boundary)', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
      attachTo: document.body,
    })
    const [first] = dataRows(wrapper)
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'ArrowUp' })
    expect(first.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(first.element)
    wrapper.unmount()
  })

  it('End moves the roving tabindex to the last row', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
      attachTo: document.body,
    })
    const rows = dataRows(wrapper)
    const first = rows[0]
    const last = rows[rows.length - 1]
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'End' })
    expect(last.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last.element)
    wrapper.unmount()
  })

  it('Space toggles selection on the focused row', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
    })
    const [first] = dataRows(wrapper)
    const checkbox = first.find('input[type="checkbox"]')
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: ' ' })
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    await first.trigger('keydown', { key: ' ' })
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })

  it('Shift+ArrowDown extends the selection range like a shift-click would', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', selectable: true },
      attachTo: document.body,
    })
    const [first, second] = dataRows(wrapper)
    const firstCheckbox = first.find('input[type="checkbox"]')
    const secondCheckbox = second.find('input[type="checkbox"]')
    await firstCheckbox.trigger('click') // selects Alice, sets the anchor
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect((firstCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect((secondCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect(document.activeElement).toBe(second.element)
    wrapper.unmount()
  })

  it('Enter emits rowClick with the row and the keyboard event', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS3, columns: COLS, rowKey: 'id', onRowClick: vi.fn() },
    })
    const [first] = dataRows(wrapper)
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('rowClick')).toBeTruthy()
    expect(wrapper.emitted('rowClick')![0][0]).toEqual(ROWS3[0])
  })
})

describe('DataTable — keyboard navigation across pages', () => {
  const ROWS6: Row[] = [
    { id: 1, name: 'Alice', score: 90 },
    { id: 2, name: 'Bob', score: 60 },
    { id: 3, name: 'Clara', score: 80 },
    { id: 4, name: 'Dave', score: 70 },
    { id: 5, name: 'Eve', score: 50 },
    { id: 6, name: 'Frank', score: 40 },
  ]

  function dataRows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('tbody tr')
  }

  async function clickNextPage(wrapper: ReturnType<typeof mount>): Promise<void> {
    const btn = wrapper.findAll('button').find((b) => b.text() === '›')!
    await btn.trigger('click')
  }

  it('ArrowDown on the last row of a page moves to the first row of the next page', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS6, columns: COLS, rowKey: 'id', selectable: true, defaultPageSize: 2 },
      attachTo: document.body,
    })
    const [, last] = dataRows(wrapper)
    ;(last.element as HTMLElement).focus()
    await last.trigger('keydown', { key: 'ArrowDown' })
    const newFirst = dataRows(wrapper)[0]
    expect(newFirst.text()).toContain('Clara')
    expect(newFirst.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(newFirst.element)
    wrapper.unmount()
  })

  it('ArrowUp on the first row of a page moves to the last row of the previous page', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS6, columns: COLS, rowKey: 'id', selectable: true, defaultPageSize: 2 },
      attachTo: document.body,
    })
    await clickNextPage(wrapper)
    const [first] = dataRows(wrapper)
    expect(first.text()).toContain('Clara')
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'ArrowUp' })
    const rows = dataRows(wrapper)
    const last = rows[rows.length - 1]
    expect(last.text()).toContain('Bob')
    expect(last.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last.element)
    wrapper.unmount()
  })

  it('Ctrl+End jumps to the true last row across all pages', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS6, columns: COLS, rowKey: 'id', selectable: true, defaultPageSize: 2 },
      attachTo: document.body,
    })
    const [first] = dataRows(wrapper)
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'End', ctrlKey: true })
    const rows = dataRows(wrapper)
    const last = rows[rows.length - 1]
    expect(last.text()).toContain('Frank')
    expect(last.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last.element)
    wrapper.unmount()
  })

  it('Ctrl+Home jumps to the true first row across all pages', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS6, columns: COLS, rowKey: 'id', selectable: true, defaultPageSize: 2 },
      attachTo: document.body,
    })
    const [first] = dataRows(wrapper)
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'End', ctrlKey: true })
    const focusedRow = dataRows(wrapper).find((r) => r.element === document.activeElement)!
    await focusedRow.trigger('keydown', { key: 'Home', ctrlKey: true })
    const newFirst = dataRows(wrapper)[0]
    expect(newFirst.text()).toContain('Alice')
    expect(newFirst.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(newFirst.element)
    wrapper.unmount()
  })

  it('Shift+ArrowDown across a page boundary extends the selection onto the next page', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS6, columns: COLS, rowKey: 'id', selectable: true, defaultPageSize: 2 },
      attachTo: document.body,
    })
    const [, last] = dataRows(wrapper)
    const lastCheckbox = last.find('input[type="checkbox"]')
    await lastCheckbox.trigger('click') // selects Bob, sets the anchor
    ;(last.element as HTMLElement).focus()
    await last.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    const newFirst = dataRows(wrapper)[0]
    const newFirstCheckbox = newFirst.find('input[type="checkbox"]')
    expect((newFirstCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect(document.activeElement).toBe(newFirst.element)
    wrapper.unmount()
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
