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

  it('adds the clickable class once a rowClick listener is attached after mount, on the next render', async () => {
    // isRowClickable used to be a one-time `getCurrentInstance()?.vnode.props?.onRowClick` read,
    // frozen forever after setup — see the audit's "Vue rowClickable reactivity" finding. It's now
    // re-derived in onUpdated, so a listener attached post-mount is picked up on the next render
    // rather than staying frozen at whatever was true at mount time.
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id' },
    })
    expect(wrapper.find('tbody tr').classes()).not.toContain('dt__tr--clickable')
    await wrapper.setProps({ onRowClick: vi.fn() })
    expect(wrapper.find('tbody tr').classes()).toContain('dt__tr--clickable')
  })
})

describe('DataTable — v-model:page / v-model:search-query', () => {
  it('emits the initial page and searchQuery once at mount, even with no interaction', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id' },
    })
    expect(wrapper.emitted('update:page')![0]).toEqual([1])
    expect(wrapper.emitted('update:searchQuery')![0]).toEqual([''])
  })

  it('emits update:page when the page changes via pagination controls', async () => {
    const manyRows: Row[] = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
      score: i,
    }))
    const wrapper = mount(DataTable, {
      props: { data: manyRows, columns: COLS, rowKey: 'id', defaultPageSize: 10 },
    })
    const nextBtn = wrapper.findAll('.dt__page-btn').find((b) => b.text() === '›')!
    await nextBtn.trigger('click')
    const pageEmits = wrapper.emitted('update:page')!
    expect(pageEmits[pageEmits.length - 1]).toEqual([2])
  })

  it('emits update:searchQuery when typing in the search box', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: COLS, rowKey: 'id' } })
    await wrapper.find('input.dt__search-input').setValue('ali')
    const queryEmits = wrapper.emitted('update:searchQuery')!
    expect(queryEmits[queryEmits.length - 1]).toEqual(['ali'])
  })

  it('binding :page jumps the table to that page at mount', () => {
    const manyRows: Row[] = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
      score: i,
    }))
    const wrapper = mount(DataTable, {
      props: { data: manyRows, columns: COLS, rowKey: 'id', defaultPageSize: 10, page: 3 },
    })
    expect(wrapper.find('.dt__page-info').text()).toBe('Page 3 of 3')
  })

  it('binding :search-query pre-filters rows at mount', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id', searchQuery: 'ali' },
    })
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice'])
  })

  it('changing the :page prop later re-syncs the table to that page', async () => {
    const manyRows: Row[] = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
      score: i,
    }))
    const wrapper = mount(DataTable, {
      props: { data: manyRows, columns: COLS, rowKey: 'id', defaultPageSize: 10, page: 1 },
    })
    await wrapper.setProps({ page: 2 })
    expect(wrapper.find('.dt__page-info').text()).toContain('2')
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

describe('DataTable — bucketed grouping (groupValue/groupFormat)', () => {
  it("renders the bucket label from groupFormat instead of a sample row's raw value", async () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      {
        key: 'score',
        label: 'Score',
        type: 'number',
        groupable: true,
        groupValue: (v) => Math.floor(Number(v) / 20) * 20,
        groupFormat: (k) => `${k}–${Number(k) + 20}`,
      },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    const groupBtn = wrapper.findAll('button').find((b) => b.text() === 'Group')!
    await groupBtn.trigger('click')
    const scoreItem = wrapper.findAll('.dt__dd-item').find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    // scores 90 and 60 bucket to 80 and 60 -> "80–100" and "60–80"
    expect(wrapper.text()).toContain('80–100')
    expect(wrapper.text()).toContain('60–80')
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
    await valueSearchInput(wrapper).setValue('ali')
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

  // The Filter dropdown's own value-search box shares the `.dt__dd-search` class with the left
  // column pane's newer column-search box (see "Dropdown column search and keyboard navigation")
  // — the column-search box renders first in DOM order, so grab the *last* match, not the first.
  function valueSearchInput(wrapper: ReturnType<typeof mount>) {
    const all = wrapper.findAll('.dt__dd-search')
    return all[all.length - 1]
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

  it('the Filter toolbar button has no clear-filters button until a filter is active', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    expect(wrapper.find('[title="Clear filters"]').exists()).toBe(false)
  })

  it('the toolbar clear-filters button clears all filters without opening the dropdown', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterToggle = () => wrapper.findAll('button').find((b) => b.text().startsWith('Filter'))!
    await filterToggle().trigger('click')
    await checklistCheckbox(wrapper, 'Alice').trigger('click')
    await filterToggle().trigger('click') // close it

    await wrapper.find('[title="Clear filters"]').trigger('click')
    expect(wrapper.find('.dropdown__menu').exists()).toBe(false) // still closed, not reopened
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('select-all checkbox only affects the search-narrowed values', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await valueSearchInput(wrapper).setValue('ali')
    await wrapper.find('.dt__filter-select-all').trigger('change')
    expect((checklistCheckbox(wrapper, 'Alice').element as HTMLInputElement).checked).toBe(true)
    await valueSearchInput(wrapper).setValue('')
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
    await valueSearchInput(wrapper).setValue('zzz')
    expect(wrapper.find('.dt__filter-select-all').exists()).toBe(false)
    expect(wrapper.find('.dt__dd-search').exists()).toBe(true)
  })

  it("renders a range slider with bounds matching the numeric column's actual min/max", async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    const thumbs = wrapper.findAll('.dt__range-slider-thumb')
    expect(thumbs).toHaveLength(2)
    expect((thumbs[0].element as HTMLInputElement).min).toBe('60')
    expect((thumbs[0].element as HTMLInputElement).max).toBe('90')
    expect((thumbs[0].element as HTMLInputElement).value).toBe('60')
    expect((thumbs[1].element as HTMLInputElement).value).toBe('90')
  })

  it("defaults the plain min/max inputs to the column's data bounds when no filter is set", async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    expect((wrapper.find('input[placeholder="Min"]').element as HTMLInputElement).value).toBe(
      '60', // Bob
    )
    expect((wrapper.find('input[placeholder="Max"]').element as HTMLInputElement).value).toBe(
      '90', // Alice
    )
    // Bounds are a display-only default — no filter is actually active yet.
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(scoreItem.find('.dt__filter-col-dot').exists()).toBe(false)
  })

  it('dragging a slider thumb updates the plain min/max inputs and filters rows', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    const low = wrapper.findAll('.dt__range-slider-thumb')[0]
    await low.setValue('75')
    expect((wrapper.find('input[placeholder="Min"]').element as HTMLInputElement).value).toBe('75')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1) // only Alice (90) remains
  })

  it('marks the column with a clear button and an active-bar chip once a range filter is set', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    const scoreRow = wrapper
      .findAll('.dt__filter-col-row')
      .find((el) => el.text().includes('Score'))!
    expect(scoreRow.find('.dt__filter-col-clear').exists()).toBe(true)
    const chip = wrapper.findAll('.dt__chip--info').find((el) => el.text().includes('Score'))
    expect(chip?.text()).toContain('80')
  })

  it("clicking a range filter's active-bar chip clears it and unfilters the rows", async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Score'))!
    await scoreItem.trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1) // only Alice (90) remains
    const chip = wrapper.findAll('.dt__chip--info').find((el) => el.text().includes('Score'))!
    await chip.find('.dt__chip-remove').trigger('click')
    expect((wrapper.find('input[placeholder="Min"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })
})

describe('DataTable — exclude filters (tri-state checklist)', () => {
  interface Game {
    id: number
    name: string
    tags: string[]
  }
  const GAME_COLS: ColumnDef<Game>[] = [
    { key: 'name', label: 'Name', filterable: false },
    { key: 'tags', label: 'Tags', filterable: true },
  ]
  const GAMES: Game[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
  ]

  function tagCheckbox(wrapper: ReturnType<typeof mount>, value: string) {
    return wrapper
      .findAll('.dt__dd-item')
      .find((el) => el.text().startsWith(value))!
      .find('input[type="checkbox"]')
  }

  function names(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
  }

  it('a plain click cycles a value through neutral -> include -> exclude -> neutral', async () => {
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: GAME_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')

    await tagCheckbox(wrapper, 'RPG').trigger('click')
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).checked).toBe(true)
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).indeterminate).toBe(false)
    expect(names(wrapper)).toEqual(['Game A'])

    await tagCheckbox(wrapper, 'RPG').trigger('click')
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).checked).toBe(false)
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).indeterminate).toBe(true)
    expect(names(wrapper)).toEqual(['Game B']) // Game A has RPG, now excluded

    await tagCheckbox(wrapper, 'RPG').trigger('click')
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).checked).toBe(false)
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).indeterminate).toBe(false)
    expect(names(wrapper)).toEqual(['Game A', 'Game B'])
  })

  it('renders an exclude filter as its own chip, distinct from an include chip', async () => {
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: GAME_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click') // include -> exclude

    const chip = wrapper.findAll('.dt__chip--danger').find((el) => el.text().includes('RPG'))
    expect(chip).toBeTruthy()
    expect(chip!.text()).toContain('≠')
  })

  it("clearing an include chip on a column doesn't clear that same column's exclude chip, and vice versa", async () => {
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: GAME_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await tagCheckbox(wrapper, 'Action').trigger('click') // include Action
    await tagCheckbox(wrapper, 'RPG').trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click') // include -> exclude RPG

    const includeChip = wrapper
      .findAll('.dt__chip--info')
      .find((el) => el.text().includes('Action'))!
    await includeChip.find('.dt__chip-remove').trigger('click')

    expect(wrapper.findAll('.dt__chip--info').some((el) => el.text().includes('Action'))).toBe(
      false,
    )
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).indeterminate).toBe(true)

    const excludeChip = wrapper
      .findAll('.dt__chip--danger')
      .find((el) => el.text().includes('RPG'))!
    await excludeChip.find('.dt__chip-remove').trigger('click')
    expect((tagCheckbox(wrapper, 'Action').element as HTMLInputElement).checked).toBe(false)
  })

  it('select-all moves listed values into the include set, clearing any that were excluded', async () => {
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: GAME_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click') // include -> exclude

    await wrapper.find('.dt__filter-select-all').trigger('change')
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).checked).toBe(true)
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).indeterminate).toBe(false)
  })

  it("select-all's deselect branch only clears the include set, leaving an unrelated exclude untouched", async () => {
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: GAME_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await tagCheckbox(wrapper, 'Action').trigger('click') // include Action
    await tagCheckbox(wrapper, 'RPG').trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click') // include -> exclude RPG

    const selectAll = wrapper.find('.dt__filter-select-all')
    expect((selectAll.element as HTMLInputElement).indeterminate).toBe(true)
    await selectAll.trigger('change')

    expect((tagCheckbox(wrapper, 'Action').element as HTMLInputElement).checked).toBe(false)
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).checked).toBe(false)
    expect((tagCheckbox(wrapper, 'RPG').element as HTMLInputElement).indeterminate).toBe(true)
    expect(names(wrapper)).toEqual(['Game B'])
  })
})

describe('DataTable — any/all filter match mode', () => {
  interface Game {
    id: number
    name: string
    tags: string[]
  }
  const GAME_COLS: ColumnDef<Game>[] = [
    { key: 'name', label: 'Name', filterable: false },
    { key: 'tags', label: 'Tags', filterable: true },
  ]
  const GAMES: Game[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
    { id: 3, name: 'Game C', tags: ['RPG'] },
  ]

  function tagCheckbox(wrapper: ReturnType<typeof mount>, value: string) {
    return wrapper
      .findAll('.dt__dd-item')
      .find((el) => el.text().startsWith(value))!
      .find('input[type="checkbox"]')
  }

  function names(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
  }

  function matchModeBtn(wrapper: ReturnType<typeof mount>, label: 'Any' | 'All') {
    return wrapper.findAll('.dt__filter-match-mode').find((el) => el.text() === label)!
  }

  function selectFilterCol(wrapper: ReturnType<typeof mount>, label: string) {
    return wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text() === label)!
      .trigger('click')
  }

  it('is shown as a segmented Any/All control for an array-valued column, both options always present', async () => {
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: GAME_COLS, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')

    const anyBtn = matchModeBtn(wrapper, 'Any')
    const allBtn = matchModeBtn(wrapper, 'All')
    // "Any" (the default) starts engaged, "All" doesn't — neither is a passive non-state, so
    // both remain visible the whole time, unlike a single button whose label/state would change.
    expect(anyBtn.attributes('aria-pressed')).toBe('true')
    expect(allBtn.attributes('aria-pressed')).toBe('false')

    await tagCheckbox(wrapper, 'Action').trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click')
    expect(names(wrapper).sort()).toEqual(['Game A', 'Game B', 'Game C'])

    await allBtn.trigger('click')
    expect(matchModeBtn(wrapper, 'Any').attributes('aria-pressed')).toBe('false')
    expect(matchModeBtn(wrapper, 'All').attributes('aria-pressed')).toBe('true')
    expect(names(wrapper)).toEqual(['Game A'])

    // Clicking "Any" again sets it back directly (not a re-click-to-cycle-back toggle).
    await matchModeBtn(wrapper, 'Any').trigger('click')
    expect(names(wrapper).sort()).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('is not shown for a plain scalar column', async () => {
    const cols: ColumnDef<Game>[] = [{ key: 'name', label: 'Name', filterable: true }]
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: cols, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    expect(wrapper.findAll('.dt__filter-match-mode')).toHaveLength(0)
  })

  it("flipping one column's match mode updates another column's facet counts", async () => {
    const cols: ColumnDef<Game>[] = [
      { key: 'name', label: 'Name', filterable: true },
      { key: 'tags', label: 'Tags', filterable: true },
    ]
    const wrapper = mount(DataTable, { props: { data: GAMES, columns: cols, rowKey: 'id' } })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await selectFilterCol(wrapper, 'Tags')
    await tagCheckbox(wrapper, 'Action').trigger('click')
    await tagCheckbox(wrapper, 'RPG').trigger('click')

    await matchModeBtn(wrapper, 'All').trigger('click')
    await selectFilterCol(wrapper, 'Name')
    // Only Game A has both Action and RPG, so Game B/C never match the "all" narrowing and
    // drop out of Name's faceted checklist entirely.
    expect(wrapper.findAll('.dt__dd-item').some((el) => el.text().startsWith('Game B'))).toBe(false)

    await selectFilterCol(wrapper, 'Tags')
    await matchModeBtn(wrapper, 'Any').trigger('click')
    await selectFilterCol(wrapper, 'Name')
    expect(wrapper.findAll('.dt__dd-item').some((el) => el.text().startsWith('Game B'))).toBe(true)
  })
})

describe('DataTable — virtualized filter checklist', () => {
  const MANY_COLS: ColumnDef<Row>[] = [{ key: 'name', label: 'Name', filterable: true }]
  const MANY_ROWS: Row[] = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    name: `Value ${String(i).padStart(4, '0')}`,
    score: i,
  }))

  it('only mounts the rows scrolled into view, not every distinct value', async () => {
    const wrapper = mount(DataTable, {
      props: { data: MANY_ROWS, columns: MANY_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const items = wrapper.findAll('.dt__dd-item.dt__dd-item--clickable')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(50)
  })

  it('renders a different slice of values after scrolling', async () => {
    const wrapper = mount(DataTable, {
      props: { data: MANY_ROWS, columns: MANY_COLS, rowKey: 'id', defaultPageSize: 10 },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const list = wrapper.find('.dt__filter-list')
    expect(list.text()).toContain('Value 0000')

    Object.defineProperty(list.element, 'scrollTop', { value: 32 * 200, writable: true })
    await list.trigger('scroll')
    // scrollTop updates are throttled via requestAnimationFrame before the re-render.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await wrapper.vm.$nextTick()

    const listAfter = wrapper.find('.dt__filter-list')
    expect(listAfter.text()).not.toContain('Value 0000')
    expect(listAfter.text()).toContain('Value 0200')
  })

  it('select-all still selects every matching value, not just the rendered window', async () => {
    const wrapper = mount(DataTable, {
      props: { data: MANY_ROWS, columns: MANY_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.find('.dt__filter-select-all').trigger('change')
    expect(wrapper.text()).toContain('500 / 500 rows')
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

  it("starts at a column's defaultValueSort instead of alpha-ascending", async () => {
    const cols: ColumnDef<TagRow>[] = [
      {
        key: 'tags',
        label: 'Tags',
        filterable: true,
        defaultValueSort: { by: 'alpha', dir: 'desc' },
      },
    ]
    const wrapper = mount(DataTable, { props: { data: TAG_ROWS, columns: cols, rowKey: 'id' } })
    await openTagsFilter(wrapper)
    expect(checklistValueOrder(wrapper)).toEqual(['RPG', 'Adventure', 'Action'])
    // The cycle still advances through all 4 states from that starting point — alpha-desc's next
    // state is count-desc.
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

  // Regression guard: the tree used to render with no wrapper at all — no height bound, no
  // overflow — so an expanded tree could bleed past the filter panel onto the page instead of
  // scrolling. It must now sit inside its own bounded, scrollable container.
  it('bounds the date tree in a scrollable, flex-filling container', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const wrap = wrapper.find('.dt__date-tree-wrap')
    expect(wrap.exists()).toBe(true)
    expect(wrap.text()).toContain('2023')
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

  it('renders 2 native date inputs above the tree for a date column', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const dateInputs = wrapper.findAll('input[type="date"]')
    expect(dateInputs).toHaveLength(2)
  })

  it("defaults the date inputs to the column's earliest/latest date when no filter is set", async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const dateInputs = wrapper.findAll('input[type="date"]')
    expect((dateInputs[0].element as HTMLInputElement).value).toBe('2021-01-02') // Game C
    expect((dateInputs[1].element as HTMLInputElement).value).toBe('2023-05-20') // Game B
  })

  it('a date range narrows the tree itself and filters rows, without needing a checkbox ticked', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.findAll('input[type="date"]')[0].setValue('2022-01-01')
    // The 2021 year (Game C) drops out of the tree entirely — narrowed like a search term, not
    // merely ANDed onto the final result once a checkbox is ticked.
    expect(wrapper.findAll('.dt__date-tree-item').some((el) => el.text().includes('2021'))).toBe(
      false,
    )
    expect(wrapper.text()).toContain('2023')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2) // Game A, Game B
  })

  it("a date range slider has epoch-based bounds matching the column's actual min/max date", async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    const thumbs = wrapper.findAll('.dt__range-slider-thumb')
    expect(thumbs).toHaveLength(2)
    expect(Number((thumbs[0].element as HTMLInputElement).min)).toBe(
      new Date('2021-01-02').getTime(),
    )
    expect(Number((thumbs[0].element as HTMLInputElement).max)).toBe(
      new Date('2023-05-20').getTime(),
    )
  })

  it('marks the date column with a clear button and an active-bar chip once a range filter is set, with no checkbox ticked', async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.findAll('input[type="date"]')[0].setValue('2022-01-01')
    const releasedRow = wrapper
      .findAll('.dt__filter-col-row')
      .find((el) => el.text().includes('Released'))!
    expect(releasedRow.find('.dt__filter-col-clear').exists()).toBe(true)
    const chip = wrapper.findAll('.dt__chip--info').find((el) => el.text().includes('Released'))
    expect(chip?.text()).toContain('2022-01-01')
  })

  it("clicking a date range filter's active-bar chip clears it, restoring the full tree and rows", async () => {
    const wrapper = mount(DataTable, {
      props: { data: DATE_ROWS, columns: DATE_COLS, rowKey: 'id' },
    })
    const filterBtn = wrapper.findAll('button').find((b) => b.text() === 'Filter')!
    await filterBtn.trigger('click')
    await wrapper.findAll('input[type="date"]')[0].setValue('2022-01-01')
    expect(wrapper.findAll('.dt__date-tree-item').some((el) => el.text().includes('2021'))).toBe(
      false,
    )
    const chip = wrapper.findAll('.dt__chip--info').find((el) => el.text().includes('Released'))!
    await chip.find('.dt__chip-remove').trigger('click')
    expect(wrapper.findAll('.dt__date-tree-item').some((el) => el.text().includes('2021'))).toBe(
      true,
    )
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })
})

describe('DataTable — search clear button', () => {
  it('does not render a clear button when the search query is empty', () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: COLS, rowKey: 'id' } })
    expect(wrapper.find('.dt__search-clear').exists()).toBe(false)
  })

  it('renders and wires up a clear button once the search query is non-empty', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    const input = wrapper.find('input.dt__search-input')
    await input.setValue('ali')
    expect((input.element as HTMLInputElement).value).toBe('ali')
    await wrapper.find('.dt__search-clear').trigger('click')
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('.dt__search-clear').exists()).toBe(false)
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })
})

describe('DataTable — sort dropdown', () => {
  const SORT_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score', type: 'number' },
  ]

  it('excludes a sortable: false column from the addable list', async () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', sortable: false },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    expect(wrapper.findAll('.dt__dd-item--clickable').some((el) => el.text() === 'Name')).toBe(
      false,
    )
    expect(wrapper.findAll('.dt__dd-item--clickable').some((el) => el.text() === 'Score')).toBe(
      true,
    )
  })

  it('lists a not-yet-sorted column under the add section as a real button', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
    expect(scoreItem.element.tagName).toBe('BUTTON')
  })

  it('clicking an add-list column adds it ascending, and clicking the active row toggles direction', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    let names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Bob', 'Alice']) // 60, 90 — ascending

    await wrapper.find('.dt__dd-item--sortrow').trigger('click')
    names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // 90, 60 — descending
  })

  it('the × button removes the sort and moves the column back to the add section', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await wrapper.find('.dt__dd-item--sortrow .dt__item-remove').trigger('click')
    expect(wrapper.find('.dt__dd-item--sortrow').exists()).toBe(false)
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // original order, no longer sorted
  })

  it('the Sort toolbar button has no clear-sorts button until a sort is active', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    expect(wrapper.find('[title="Clear sorts"]').exists()).toBe(false)
  })

  it('the toolbar clear-sorts button clears all sorts without opening the dropdown', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    const sortToggle = () => wrapper.findAll('button').find((b) => b.text().startsWith('Sort'))!
    await sortToggle().trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await sortToggle().trigger('click') // close it

    await wrapper.find('[title="Clear sorts"]').trigger('click')
    expect(wrapper.find('.dt__dd-item--sortrow').exists()).toBe(false)
    expect(wrapper.find('.dropdown__menu').exists()).toBe(false) // still closed, not reopened
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // original order, no longer sorted
  })

  it('dragging an active sort row onto another reorders priority', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--sortrow')
    await rows[1].trigger('dragstart')
    await rows[0].trigger('dragover')
    await rows[0].trigger('drop')
    const after = wrapper.findAll('.dt__dd-item--sortrow')
    expect(after[0].text()).toContain('Score')
    expect(after[1].text()).toContain('Name')
  })

  it('dropping past the last active sort row moves the dragged row to the end', async () => {
    const cols: ColumnDef<Row>[] = [...SORT_COLS, { key: 'id', label: 'Id', type: 'number' }]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Id')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--sortrow')
    // jsdom has no layout engine — getBoundingClientRect() returns all zeros unless stubbed.
    rows[2].element.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = wrapper.find('.dropdown__menu')

    await rows[0].trigger('dragstart')
    // Pointer is well below the last active row (id), over dead space (blank space in the
    // dropdown panel below the last row) that carries no active-row identity of its own — this
    // used to silently reject the drop entirely.
    await panel.trigger('dragover', { clientY: 100 })
    await panel.trigger('drop', { clientY: 100 })

    const after = wrapper.findAll('.dt__dd-item--sortrow')
    expect(after.map((r) => r.text())).toEqual([
      expect.stringContaining('Score'),
      expect.stringContaining('Id'),
      expect.stringContaining('Name'),
    ])
  })

  it('dropping on the bottom half of the last active sort row moves the dragged row after it', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--sortrow')
    rows[1].element.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    await rows[0].trigger('dragstart')
    // clientY 35 falls in scoreRow's bottom half (30–40) — should insert name *after* score,
    // not before it (which "insert before" alone could never express for the last row).
    await rows[1].trigger('dragover', { clientY: 35 })
    await rows[1].trigger('drop', { clientY: 35 })

    const after = wrapper.findAll('.dt__dd-item--sortrow')
    expect(after[0].text()).toContain('Score')
    expect(after[1].text()).toContain('Name')
  })

  it('Alt+ArrowUp on a focused active sort row reorders priority', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--sortrow')
    await rows[1].trigger('keydown', { key: 'ArrowUp', altKey: true })
    const after = wrapper.findAll('.dt__dd-item--sortrow')
    expect(after[0].text()).toContain('Score')
    expect(after[1].text()).toContain('Name')
  })
})

function headerOf(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('th').find((th) => th.text().includes(label))!
}

describe('DataTable — header click sort', () => {
  const SORT_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score', type: 'number' },
  ]

  it('clicking a header sorts ascending, clicking again reverses to descending', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Score').trigger('click')
    let names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Bob', 'Alice']) // 60, 90 — ascending

    await headerOf(wrapper, 'Score').trigger('click')
    names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // 90, 60 — descending
  })

  it('clicking a third time clears the sort', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Score').trigger('click')
    await headerOf(wrapper, 'Score').trigger('click')
    await headerOf(wrapper, 'Score').trigger('click')
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // original order, no longer sorted
  })

  it('plain-clicking a different header replaces the sort instead of appending to it', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Name').trigger('click')
    await headerOf(wrapper, 'Score').trigger('click')
    // Only Score's arrow shows — Name is no longer sorted.
    expect(headerOf(wrapper, 'Name').text()).not.toMatch(/[↑↓]/)
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Bob', 'Alice']) // sorted by score alone, ascending
  })

  it('shift-clicking a header appends it to the existing sort instead of replacing it', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Name').trigger('click')
    await headerOf(wrapper, 'Score').trigger('click', { shiftKey: true })
    expect(headerOf(wrapper, 'Name').text()).toMatch(/[↑↓]/)
    expect(headerOf(wrapper, 'Score').text()).toMatch(/[↑↓]/)
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // sorted by name asc (score is only a tiebreaker)
  })

  it('shift-clicking an already-sorted column flips its direction in place, without removing it', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Name').trigger('click')
    await headerOf(wrapper, 'Score').trigger('click', { shiftKey: true })
    await headerOf(wrapper, 'Score').trigger('click', { shiftKey: true })
    expect(headerOf(wrapper, 'Score').text()).toContain('2↓')
    // A third shift-click flips it back to asc rather than removing it from the stack.
    await headerOf(wrapper, 'Score').trigger('click', { shiftKey: true })
    expect(headerOf(wrapper, 'Score').text()).toContain('2↑')
  })

  it('sortable: false makes a header click/shift-click a no-op', async () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', sortable: false },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await headerOf(wrapper, 'Name').trigger('click')
    await headerOf(wrapper, 'Name').trigger('click', { shiftKey: true })
    expect(headerOf(wrapper, 'Name').text()).not.toMatch(/[↑↓]/)
    const names = wrapper.findAll('tbody tr td:first-child').map((td) => td.text())
    expect(names).toEqual(['Alice', 'Bob']) // unchanged, original order
  })

  it('a single sorted column shows only the direction arrow, no index number', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Score').trigger('click')
    expect(headerOf(wrapper, 'Score').text()).toContain('↑')
    expect(headerOf(wrapper, 'Score').text()).not.toMatch(/\d/)
  })

  it('shows an index number on each header once more than one column is sorted', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: SORT_COLS, rowKey: 'id' } })
    await headerOf(wrapper, 'Name').trigger('click')
    await headerOf(wrapper, 'Score').trigger('click', { shiftKey: true })
    expect(headerOf(wrapper, 'Name').text()).toContain('1↑')
    expect(headerOf(wrapper, 'Score').text()).toContain('2↑')
  })

  it('a sort on a grouped-out column is not numbered and does not shift visible headers’ numbers', async () => {
    interface DeptRow extends Row {
      dept: string
    }
    const cols: ColumnDef<DeptRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'dept', label: 'Dept', groupable: true },
    ]
    const rows: DeptRow[] = ROWS.map((r) => ({ ...r, dept: r.name === 'Alice' ? 'Eng' : 'HR' }))
    const wrapper = mount(DataTable, { props: { data: rows, columns: cols, rowKey: 'id' } })
    // Sort by dept while it still has a header, then group by it — its sort entry (used to order
    // the groups) stays in `sorts`, but dept no longer has a header to show a number on.
    await headerOf(wrapper, 'Dept').trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Group')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Dept')!
      .trigger('click')
    await headerOf(wrapper, 'Score').trigger('click', { shiftKey: true })
    // Only Score has a visible header, so no number — not "2", which would imply a missing "1".
    expect(headerOf(wrapper, 'Score').text()).toContain('↑')
    expect(headerOf(wrapper, 'Score').text()).not.toMatch(/\d/)
    expect(wrapper.findAll('th').some((th) => th.text().includes('Dept'))).toBe(false) // header removed by grouping
  })
})

describe('DataTable — group dropdown', () => {
  const GROUP_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', groupable: true },
    { key: 'score', label: 'Score', type: 'number', groupable: true },
  ]

  it('lists a not-yet-grouped column under the add section as a real button', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: GROUP_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Group')!
      .trigger('click')
    const scoreItem = wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
    expect(scoreItem.element.tagName).toBe('BUTTON')
  })

  it('the × button removes the group and moves the column back to the add section', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: GROUP_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Group')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    expect(wrapper.find('.dt__dd-item--grouprow').exists()).toBe(true)
    await wrapper.find('.dt__dd-item--grouprow .dt__item-remove').trigger('click')
    expect(wrapper.find('.dt__dd-item--grouprow').exists()).toBe(false)
  })

  it('the Group toolbar button has no clear-groups button until a group is active', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: GROUP_COLS, rowKey: 'id' } })
    expect(wrapper.find('[title="Clear groups"]').exists()).toBe(false)
  })

  it('the toolbar clear-groups button clears all groups without opening the dropdown', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: GROUP_COLS, rowKey: 'id' } })
    const groupToggle = () => wrapper.findAll('button').find((b) => b.text().startsWith('Group'))!
    await groupToggle().trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await groupToggle().trigger('click') // close it

    await wrapper.find('[title="Clear groups"]').trigger('click')
    expect(wrapper.find('.dt__dd-item--grouprow').exists()).toBe(false)
    expect(wrapper.find('.dropdown__menu').exists()).toBe(false) // still closed, not reopened
  })

  it('dragging an active group row onto another reorders priority', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: GROUP_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Group')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--grouprow')
    await rows[1].trigger('dragstart')
    await rows[0].trigger('dragover')
    await rows[0].trigger('drop')
    const after = wrapper.findAll('.dt__dd-item--grouprow')
    expect(after[0].text()).toContain('Score')
    expect(after[1].text()).toContain('Name')
  })

  it('dropping past the last active group row moves the dragged row to the end', async () => {
    const cols: ColumnDef<Row>[] = [
      ...GROUP_COLS,
      { key: 'id', label: 'Id', type: 'number', groupable: true },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Group')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Id')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--grouprow')
    // jsdom has no layout engine — getBoundingClientRect() returns all zeros unless stubbed.
    rows[2].element.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = wrapper.find('.dropdown__menu')

    await rows[0].trigger('dragstart')
    // Pointer is well below the last active row (id), over dead space (blank space in the
    // dropdown panel below the last row) that carries no active-row identity of its own — this
    // used to silently reject the drop entirely.
    await panel.trigger('dragover', { clientY: 100 })
    await panel.trigger('drop', { clientY: 100 })

    const after = wrapper.findAll('.dt__dd-item--grouprow')
    expect(after.map((r) => r.text())).toEqual([
      expect.stringContaining('Score'),
      expect.stringContaining('Id'),
      expect.stringContaining('Name'),
    ])
  })

  it('dropping on the bottom half of the last active group row moves the dragged row after it', async () => {
    const cols: ColumnDef<Row>[] = [
      ...GROUP_COLS,
      { key: 'id', label: 'Id', type: 'number', groupable: true },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Group')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Id')!
      .trigger('click')

    const rows = wrapper.findAll('.dt__dd-item--grouprow')
    rows[2].element.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    await rows[0].trigger('dragstart')
    // clientY 35 falls in idRow's bottom half (30–40) — should insert name *after* id,
    // not before it (which "insert before" alone could never express for the last row).
    await rows[2].trigger('dragover', { clientY: 35 })
    await rows[2].trigger('drop', { clientY: 35 })

    const after = wrapper.findAll('.dt__dd-item--grouprow')
    expect(after.map((r) => r.text())).toEqual([
      expect.stringContaining('Score'),
      expect.stringContaining('Id'),
      expect.stringContaining('Name'),
    ])
  })
})

describe('DataTable — columns dropdown', () => {
  it('column rows are draggable and reorder headers on drop, with no ▲▼ buttons', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Columns')!
      .trigger('click')
    const rows = wrapper.findAll('.dt__dd-item--colrow')
    expect(rows).toHaveLength(COLS.length)
    expect(wrapper.findAll('button').some((b) => b.text() === '▲')).toBe(false)

    await rows[1].trigger('dragstart')
    await rows[0].trigger('dragover')
    await rows[0].trigger('drop')
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers[0]).toContain('Score')
    expect(headers[1]).toContain('Name')
  })

  it('Alt+ArrowUp on a focused column checkbox reorders headers, click still toggles visibility', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Columns')!
      .trigger('click')
    const checkboxes = wrapper.findAll('.dt__dd-item--colrow input[type="checkbox"]')
    await checkboxes[1].trigger('keydown', { key: 'ArrowUp', altKey: true })
    let headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers[0]).toContain('Score')

    await checkboxes[0].setValue(false)
    headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers.some((h) => h.includes('Name'))).toBe(false)
  })

  it('dropping past the last column row moves the dragged row to the end', async () => {
    const cols: ColumnDef<Row>[] = [...COLS, { key: 'id', label: 'Id', type: 'number' }]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Columns')!
      .trigger('click')
    const rows = wrapper.findAll('.dt__dd-item--colrow')
    // jsdom has no layout engine — getBoundingClientRect() returns all zeros unless stubbed.
    rows[2].element.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect
    const panel = wrapper.find('.dropdown__menu')

    await rows[0].trigger('dragstart')
    await panel.trigger('dragover', { clientY: 100 })
    await panel.trigger('drop', { clientY: 100 })

    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers[0]).toContain('Score')
    expect(headers[1]).toContain('Id')
    expect(headers[2]).toContain('Name')
  })

  it('dropping on the bottom half of the last column row moves the dragged row after it', async () => {
    const cols: ColumnDef<Row>[] = [...COLS, { key: 'id', label: 'Id', type: 'number' }]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: cols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Columns')!
      .trigger('click')
    const rows = wrapper.findAll('.dt__dd-item--colrow')
    rows[2].element.getBoundingClientRect = () => ({ top: 20, bottom: 40, height: 20 }) as DOMRect

    await rows[0].trigger('dragstart')
    // clientY 35 falls in idRow's bottom half (30–40) — should insert name *after* id,
    // not before it (which "insert before" alone could never express for the last row).
    await rows[2].trigger('dragover', { clientY: 35 })
    await rows[2].trigger('drop', { clientY: 35 })

    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers[0]).toContain('Score')
    expect(headers[1]).toContain('Id')
    expect(headers[2]).toContain('Name')
  })
})

describe('DataTable — filter column selector keyboard access', () => {
  const FILTER_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'score', label: 'Score', type: 'number', filterable: true },
  ]

  it('renders each column selector as a real, focusable <button>', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: FILTER_COLS, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Filter')!
      .trigger('click')
    const nameItem = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().includes('Name'))!
    expect(nameItem.element.tagName).toBe('BUTTON')
  })
})

describe('DataTable — filter column ordering & clear button', () => {
  interface OrderRow {
    id: number
    name: string
    dept: string
    score: number
    joined: string
  }
  const ORDER_COLS: ColumnDef<OrderRow>[] = [
    { key: 'name', label: 'Name', filterable: true },
    { key: 'dept', label: 'Dept', filterable: true },
    { key: 'score', label: 'Score', filterable: true, type: 'number' },
    { key: 'joined', label: 'Joined', filterable: true, type: 'date' },
  ]
  const ORDER_ROWS: OrderRow[] = [
    { id: 1, name: 'Alice', dept: 'Eng', score: 90, joined: '2023-01-15' },
    { id: 2, name: 'Bob', dept: 'HR', score: 60, joined: '2023-06-20' },
  ]

  function filterColLabels(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper
      .findAll('.dt__filter-col-row')
      .map((row) => row.find('.dt__filter-col-item').text())
  }

  function rowFor(wrapper: ReturnType<typeof mount>, label: string) {
    return wrapper.findAll('.dt__filter-col-row').find((row) => row.text().includes(label))!
  }

  async function openFilter(wrapper: ReturnType<typeof mount>) {
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Filter')!
      .trigger('click')
  }

  it('is plain alphabetical order with nothing active', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    expect(filterColLabels(wrapper)).toEqual(['Dept', 'Joined', 'Name', 'Score'])
  })

  it('does not reorder mid-session when a filter is toggled while the panel stays open', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    await rowFor(wrapper, 'Score').find('.dt__filter-col-item').trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    expect(filterColLabels(wrapper)).toEqual(['Dept', 'Joined', 'Name', 'Score'])
  })

  it('moves active-filter columns to the top on the next open', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    await rowFor(wrapper, 'Score').find('.dt__filter-col-item').trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    await openFilter(wrapper) // close
    await openFilter(wrapper) // reopen — snapshot re-taken
    expect(filterColLabels(wrapper)).toEqual(['Score', 'Dept', 'Joined', 'Name'])
  })

  it('shows a clear button only for a column with an active filter', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    expect(rowFor(wrapper, 'Score').find('.dt__filter-col-clear').exists()).toBe(false)
    await rowFor(wrapper, 'Score').find('.dt__filter-col-item').trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    expect(rowFor(wrapper, 'Score').find('.dt__filter-col-clear').exists()).toBe(true)
  })

  it('clear button removes the filter without opening that column', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    await rowFor(wrapper, 'Score').find('.dt__filter-col-item').trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    await rowFor(wrapper, 'Name').find('.dt__filter-col-item').trigger('click') // switch away
    await rowFor(wrapper, 'Score').find('.dt__filter-col-clear').trigger('click')
    expect(rowFor(wrapper, 'Score').find('.dt__filter-col-clear').exists()).toBe(false)
    // Still showing Name's pane (a checklist, no Min/Max inputs), not reopened onto Score's.
    expect(wrapper.find('input[placeholder="Min"]').exists()).toBe(false)
  })

  it('Delete on a focused, active column row clears its filter', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    const scoreBtn = rowFor(wrapper, 'Score').find('.dt__filter-col-item')
    await scoreBtn.trigger('click')
    await wrapper.find('input[placeholder="Min"]').setValue('80')
    await scoreBtn.trigger('keydown', { key: 'Delete' })
    expect(rowFor(wrapper, 'Score').find('.dt__filter-col-clear').exists()).toBe(false)
  })

  it('Backspace on a focused, inactive column row is a no-op', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ORDER_ROWS, columns: ORDER_COLS, rowKey: 'id' },
    })
    await openFilter(wrapper)
    const deptBtn = rowFor(wrapper, 'Dept').find('.dt__filter-col-item')
    await deptBtn.trigger('keydown', { key: 'Backspace' })
    expect(rowFor(wrapper, 'Dept').find('.dt__filter-col-clear').exists()).toBe(false)
  })
})

describe('DataTable — active state bar', () => {
  it('renders with just the row-count stats when nothing is active', () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: COLS, rowKey: 'id' } })
    expect(wrapper.find('.dt__active-bar').exists()).toBe(true)
    expect(wrapper.find('.dt__active-bar .dt__chip').exists()).toBe(false)
    expect(wrapper.find('.dt__stats').text()).toContain('2 / 2 rows')
  })

  it('shows sort, group, and filter chips together, each removable on its own', async () => {
    const chipCols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name', filterable: true, groupable: true },
      { key: 'score', label: 'Score', type: 'number', groupable: true },
    ]
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: chipCols, rowKey: 'id' } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Sort')!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Score')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Group'))!
      .trigger('click')
    await wrapper
      .findAll('.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Filter'))!
      .trigger('click')
    await wrapper
      .findAll('input[type="checkbox"]')
      .find((el) => el.element.closest('.dt__dd-item')?.textContent?.includes('Alice'))!
      .trigger('click')

    // Sort/group chips now get the same at-a-glance treatment the filter chip always had — no
    // more bare count badge on the toolbar button itself.
    expect(wrapper.findAll('button').find((b) => b.text() === 'Sort')).toBeTruthy()
    const bar = wrapper.find('.dt__active-bar')
    expect(bar.text()).toContain('Score')
    expect(bar.text()).toContain('Name: Alice')

    const scoreChip = bar.findAll('.dt__chip').find((c) => c.text().includes('Score'))!
    await scoreChip.find('.dt__chip-remove').trigger('click')
    expect(wrapper.find('.dt__active-bar').text()).not.toContain('Score')
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

  it('the rows-per-page dropdown includes and selects a custom defaultPageSize not among the defaults', () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS6, columns: COLS, rowKey: 'id', defaultPageSize: 2 },
    })
    const select = wrapper.find('select').element as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['2', '10', '20', '50', '100'])
    expect(select.value).toBe('2')
  })

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

describe('DataTable — keyboard navigation with grouping', () => {
  interface GroupRow {
    id: number
    name: string
    dept: string
  }

  const GROUP_COLS: ColumnDef<GroupRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Department', groupable: true },
  ]

  const GROUP_ROWS: GroupRow[] = [
    { id: 1, name: 'Alice', dept: 'Eng' },
    { id: 2, name: 'Bob', dept: 'Eng' },
    { id: 3, name: 'Clara', dept: 'HR' },
    { id: 4, name: 'David', dept: 'HR' },
  ]

  function groupHeaderRows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('.dt__group-row')
  }

  function dataRows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('tbody tr:not(.dt__group-row):not(.dt__agg-row)')
  }

  // Finds the wrapper for whichever row/header currently has DOM focus, since a keydown can move
  // focus to an element we don't already hold a stale reference to (e.g. across a re-render).
  function activeItemWrapper(wrapper: ReturnType<typeof mount>) {
    return [...groupHeaderRows(wrapper), ...dataRows(wrapper)].find(
      (r) => r.element === document.activeElement,
    )!
  }

  async function groupByDept(wrapper: ReturnType<typeof mount>): Promise<void> {
    const groupBtn = wrapper.findAll('button').find((b) => b.text() === 'Group')!
    await groupBtn.trigger('click')
    const deptItem = wrapper.findAll('.dt__dd-item').find((el) => el.text().includes('Department'))!
    await deptItem.trigger('click')
  }

  it('makes every group header row a Tab stop, one at a time', async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        selectable: true,
        defaultGroupsCollapsed: false,
      },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    const headers = groupHeaderRows(wrapper)
    expect(headers).toHaveLength(2)
    expect(headers[0].attributes('tabindex')).toBe('0')
    expect(headers[1].attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  })

  it("ArrowDown walks through a group's rows and on to the next group header", async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        selectable: true,
        defaultGroupsCollapsed: false,
      },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    const [firstHeader] = groupHeaderRows(wrapper)
    ;(firstHeader.element as HTMLElement).focus()
    await firstHeader.trigger('keydown', { key: 'ArrowDown' }) // -> Alice
    await activeItemWrapper(wrapper).trigger('keydown', { key: 'ArrowDown' }) // -> Bob
    await activeItemWrapper(wrapper).trigger('keydown', { key: 'ArrowDown' }) // -> HR header
    expect(document.activeElement).toBe(groupHeaderRows(wrapper)[1].element)
    wrapper.unmount()
  })

  it('Enter toggles collapse on a focused group header, regardless of selectable/onRowClick', async () => {
    const wrapper = mount(DataTable, {
      props: { data: GROUP_ROWS, columns: GROUP_COLS, rowKey: 'id', defaultGroupsCollapsed: false },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    const [firstHeader] = groupHeaderRows(wrapper)
    ;(firstHeader.element as HTMLElement).focus()
    await firstHeader.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).not.toContain('Alice')
    await activeItemWrapper(wrapper).trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('Alice')
    wrapper.unmount()
  })

  it("Space toggles the group's own select-all checkbox on a focused group header", async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        selectable: true,
        defaultGroupsCollapsed: false,
      },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    const [firstHeader] = groupHeaderRows(wrapper)
    ;(firstHeader.element as HTMLElement).focus()
    await firstHeader.trigger('keydown', { key: ' ' })
    const checkbox = firstHeader.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    wrapper.unmount()
  })

  it('Ctrl+End from a group header jumps to the true last row across all groups', async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        selectable: true,
        defaultGroupsCollapsed: false,
      },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    const [firstHeader] = groupHeaderRows(wrapper)
    ;(firstHeader.element as HTMLElement).focus()
    await firstHeader.trigger('keydown', { key: 'End', ctrlKey: true })
    expect(document.activeElement?.textContent).toContain('David')
    wrapper.unmount()
  })

  it("a collapsed group's header stays reachable and its rows are skipped", async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        selectable: true,
        defaultGroupsCollapsed: false,
      },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    const [firstHeader] = groupHeaderRows(wrapper)
    ;(firstHeader.element as HTMLElement).focus()
    await firstHeader.trigger('keydown', { key: 'Enter' }) // collapse Eng
    await activeItemWrapper(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(groupHeaderRows(wrapper)[1].element)
    wrapper.unmount()
  })

  it('starts groups collapsed by default, and Enter expands one', async () => {
    const wrapper = mount(DataTable, {
      props: { data: GROUP_ROWS, columns: GROUP_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    expect(dataRows(wrapper)).toHaveLength(0)
    const [firstHeader] = groupHeaderRows(wrapper)
    ;(firstHeader.element as HTMLElement).focus()
    await firstHeader.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('Alice')
    wrapper.unmount()
  })

  it('defaultGroupsCollapsed: false starts groups expanded', async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        defaultGroupsCollapsed: false,
      },
      attachTo: document.body,
    })
    await groupByDept(wrapper)
    expect(wrapper.text()).toContain('Alice')
    wrapper.unmount()
  })
})

describe('DataTable — pagination with grouping', () => {
  interface GroupRow {
    id: number
    name: string
    dept: string
  }

  const GROUP_COLS: ColumnDef<GroupRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Department', groupable: true },
  ]

  const GROUP_ROWS: GroupRow[] = [
    { id: 1, name: 'Alice', dept: 'Eng' },
    { id: 2, name: 'Bob', dept: 'Eng' },
    { id: 3, name: 'Clara', dept: 'HR' },
    { id: 4, name: 'David', dept: 'HR' },
  ]

  function groupHeaderRows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('.dt__group-row')
  }

  function tableRows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('tbody tr:not(.dt__agg-row)')
  }

  async function groupByDept(wrapper: ReturnType<typeof mount>): Promise<void> {
    const groupBtn = wrapper.findAll('button').find((b) => b.text() === 'Group')!
    await groupBtn.trigger('click')
    const deptItem = wrapper.findAll('.dt__dd-item').find((el) => el.text().includes('Department'))!
    await deptItem.trigger('click')
  }

  async function clickNextPage(wrapper: ReturnType<typeof mount>): Promise<void> {
    const btn = wrapper.findAll('button').find((b) => b.text() === '›')!
    await btn.trigger('click')
  }

  it('counts header rows toward the page budget, so a page never renders more than pageSize rows', async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        defaultPageSize: 2,
        defaultGroupsCollapsed: false,
      },
    })
    await groupByDept(wrapper)
    // 2 headers + 4 rows = 6 visible items; pageSize 2 => page 1 is [header Eng, Alice]
    expect(tableRows(wrapper)).toHaveLength(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')
  })

  it("repeats a split group's header, marked as continued, on the page its rows continue onto", async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: GROUP_ROWS,
        columns: GROUP_COLS,
        rowKey: 'id',
        defaultPageSize: 2,
        defaultGroupsCollapsed: false,
      },
    })
    await groupByDept(wrapper)
    await clickNextPage(wrapper) // -> page 2: [Bob (Eng, continued), header HR (no rows here)]
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).not.toContain('Alice')
    const engHeader = groupHeaderRows(wrapper).find((h) => h.text().includes('Eng'))!
    expect(engHeader.text()).toContain('cont')
    // HR's header lands as the very last item on this page with none of its own rows following
    // until the next page — it must still render its label instead of crashing on empty `rows`.
    const hrHeader = groupHeaderRows(wrapper).find((h) => h.text().includes('HR'))!
    expect(hrHeader).toBeTruthy()
    expect(hrHeader.text()).not.toContain('cont')
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

describe('DataTable — dropdown column search and keyboard navigation', () => {
  const THREE_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', filterable: true, groupable: true },
    { key: 'score', label: 'Score', type: 'number', filterable: true, groupable: true },
    { key: 'id', label: 'Id', type: 'number', groupable: true },
  ]

  function openDd(wrapper: ReturnType<typeof mount>, label: string) {
    return wrapper
      .findAll('button')
      .find((b) => b.text() === label)!
      .trigger('click')
  }
  function ddSearchInput(wrapper: ReturnType<typeof mount>) {
    return wrapper.find('.dropdown__menu input.dt__dd-search')
  }

  it('the columns dropdown search box narrows the column list by label', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' } })
    await openDd(wrapper, 'Columns')
    await ddSearchInput(wrapper).setValue('sc')
    const rows = wrapper.findAll('.dt__dd-item--colrow').map((r) => r.text())
    expect(rows).toEqual([expect.stringContaining('Score')])
  })

  it('the sort dropdown search box narrows only the addable list, alphabetized, leaving active sorts untouched', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' } })
    await openDd(wrapper, 'Sort')
    await wrapper
      .findAll('button.dt__dd-item--clickable')
      .find((el) => el.text() === 'Id')!
      .trigger('click')
    const addable = wrapper.findAll('button.dt__dd-item--clickable').map((el) => el.text())
    expect(addable).toEqual(['Name', 'Score']) // alphabetized, Id excluded (already active)
    await ddSearchInput(wrapper).setValue('sco')
    expect(wrapper.findAll('button.dt__dd-item--clickable').map((el) => el.text())).toEqual([
      'Score',
    ])
    // The active-sorts section (Id) stays visible regardless of the search term.
    expect(wrapper.find('.dt__dd-item--sortrow').exists()).toBe(true)
  })

  it('the group dropdown search box narrows the addable list', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' } })
    await openDd(wrapper, 'Group')
    await ddSearchInput(wrapper).setValue('xyz')
    expect(wrapper.findAll('button.dt__dd-item--clickable')).toHaveLength(0)
  })

  it('the filter dropdown search box narrows the left column pane, alphabetized', async () => {
    const wrapper = mount(DataTable, { props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' } })
    await openDd(wrapper, 'Filter')
    expect(wrapper.findAll('.dt__filter-col-item span:first-child').map((s) => s.text())).toEqual(
      ['Id', 'Name', 'Score'], // filterable defaults to true, so Id is included, alphabetized
    )
    await ddSearchInput(wrapper).setValue('sc')
    expect(wrapper.findAll('.dt__filter-col-item span:first-child').map((s) => s.text())).toEqual([
      'Score',
    ])
  })

  it('opening a dropdown focuses its search box', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Columns')
    expect(document.activeElement).toBe(ddSearchInput(wrapper).element)
  })

  it('opening a dropdown with no search box (nothing left to add) focuses the first active row', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Sort')
    for (const label of ['Name', 'Score', 'Id']) {
      await wrapper
        .findAll('button.dt__dd-item--clickable')
        .find((el) => el.text() === label)!
        .trigger('click')
    }
    await openDd(wrapper, 'Sort') // close
    await openDd(wrapper, 'Sort') // reopen
    expect(document.activeElement).toBe(wrapper.find('.dt__dd-item--sortrow').element)
  })

  it('ArrowDown moves through Sort dropdown rows in visible order: active row, then search box, then addable rows', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Sort')
    await wrapper
      .findAll('button.dt__dd-item--clickable')
      .find((el) => el.text() === 'Id')!
      .trigger('click')
    const idRow = wrapper.find('.dt__dd-item--sortrow')
    ;(idRow.element as HTMLElement).focus()
    await idRow.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(ddSearchInput(wrapper).element)
    await ddSearchInput(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      wrapper.findAll('button.dt__dd-item--clickable').find((el) => el.text() === 'Name')!.element,
    )
  })

  it('ArrowUp on the first row is a no-op (stays put, no wrap)', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Columns')
    const search = ddSearchInput(wrapper)
    await search.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search.element)
  })

  it('Home/End jump to the first/last row, skipping the search box', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Columns')
    const rows = () => wrapper.findAll('.dt__dd-item--colrow input[type="checkbox"]')
    ;(rows()[0].element as HTMLElement).focus()
    await rows()[0].trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(rows()[2].element)
    await rows()[2].trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(rows()[0].element)
  })

  it('Escape clears a non-empty dropdown search term before closing the dropdown', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Columns')
    await ddSearchInput(wrapper).setValue('sc')
    await ddSearchInput(wrapper).trigger('keydown', { key: 'Escape' })
    expect((ddSearchInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('.dropdown__menu').exists()).toBe(true) // still open
    await ddSearchInput(wrapper).trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.dropdown__menu').exists()).toBe(false)
    expect(document.activeElement).toBe(
      wrapper.findAll('button').find((b) => b.text() === 'Columns')!.element,
    )
  })

  it('activating an addable column in the Sort dropdown keeps focus on its new active row', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Sort')
    const nameBtn = wrapper
      .findAll('button.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
    await nameBtn.trigger('click')
    expect(document.activeElement).toBe(wrapper.find('.dt__dd-item--sortrow').element)
  })

  it('removing an active Sort column returns focus to its addable button', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Sort')
    await wrapper
      .findAll('button.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await wrapper.find('.dt__item-remove').trigger('click')
    expect(document.activeElement).toBe(
      wrapper.findAll('button.dt__dd-item--clickable').find((el) => el.text() === 'Name')!.element,
    )
  })

  it('activating/removing an active Group column keeps focus, same as Sort', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Group')
    const idBtn = wrapper.findAll('button.dt__dd-item--clickable').find((el) => el.text() === 'Id')!
    await idBtn.trigger('click')
    expect(document.activeElement).toBe(wrapper.find('.dt__dd-item--grouprow').element)
    await wrapper.find('.dt__item-remove').trigger('click')
    expect(document.activeElement).toBe(
      wrapper.findAll('button.dt__dd-item--clickable').find((el) => el.text() === 'Id')!.element,
    )
  })

  it('ArrowRight on the left column list enters the right detail pane', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Filter')
    const nameBtn = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().startsWith('Name'))!
    ;(nameBtn.element as HTMLElement).focus()
    await nameBtn.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.find('.dt__filter-detail').element.contains(document.activeElement)).toBe(true)
  })

  it('ArrowLeft from a checklist row returns focus to the active column button', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Filter')
    const row = wrapper.find('.dt__filter-list input[type="checkbox"]')
    ;(row.element as HTMLElement).focus()
    await row.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(wrapper.find('.dt__filter-col-item--active').element)
  })

  it('ArrowLeft does not hijack cursor movement in the value-search text box', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Filter')
    const search = wrapper.find('.dt__filter-detail input.dt__dd-search')
    ;(search.element as HTMLElement).focus()
    await search.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(search.element)
  })

  it('ArrowDown/ArrowUp move between checklist rows in the filter detail pane', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Filter')
    const search = wrapper.find('.dt__filter-detail input.dt__dd-search')
    ;(search.element as HTMLElement).focus()
    await search.trigger('keydown', { key: 'ArrowDown' })
    const firstRow = wrapper.find('.dt__filter-list input[type="checkbox"]')
    expect(document.activeElement).toBe(firstRow.element)
    await firstRow.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search.element)
  })

  it('focusing a different column in the left pane updates the right pane immediately, with no Enter/Space needed', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Filter')
    expect(wrapper.find('.dt__range-input').exists()).toBe(false) // 'Name' (string) starts active
    const scoreBtn = wrapper
      .findAll('.dt__filter-col-item')
      .find((el) => el.text().startsWith('Score'))!
    ;(scoreBtn.element as HTMLElement).focus() // simulates Tab arrival, not a click/Enter/Space
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dt__range-input').exists()).toBe(true) // 'Score' (number) now active
  })
})

describe('DataTable — active-bar chip click actions', () => {
  const THREE_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', filterable: true, groupable: true },
    { key: 'score', label: 'Score', type: 'number', filterable: true, groupable: true },
    { key: 'id', label: 'Id', type: 'number', groupable: true },
  ]
  function openDd(wrapper: ReturnType<typeof mount>, label: string) {
    return wrapper
      .findAll('button')
      .find((b) => b.text() === label)!
      .trigger('click')
  }

  it("clicking a sort chip body toggles that column's direction and keeps focus on it", async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Sort')
    await wrapper
      .findAll('button.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await openDd(wrapper, 'Sort') // close

    const chipBody = wrapper.find('.dt__chip .dt__chip-body')
    expect(chipBody.text()).toContain('↑')
    ;(chipBody.element as HTMLElement).focus()
    await chipBody.trigger('click')
    expect(wrapper.find('.dt__chip .dt__chip-body').text()).toContain('↓')
    expect(document.activeElement).toBe(wrapper.find('.dt__chip .dt__chip-body').element)
  })

  it('clicking a group chip body opens the Group dropdown focused on that entry', async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Group')
    await wrapper
      .findAll('button.dt__dd-item--clickable')
      .find((el) => el.text() === 'Name')!
      .trigger('click')
    await openDd(wrapper, 'Group') // close

    expect(wrapper.find('.dropdown__menu').exists()).toBe(false)
    // Grouping also auto-inserts a matching sort entry (issue #17) — rather than two
    // identically-labeled chips, this merges into one dt__chip--grouped-sort chip; its own
    // group-mark button (not the body, which now toggles sort direction) opens the dropdown.
    const groupMark = wrapper.find('[data-chip-group-mark="name"]')
    expect(groupMark.exists()).toBe(true)
    await groupMark.trigger('click')
    expect(wrapper.find('.dropdown__menu').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('.dt__dd-item--grouprow').element)
  })

  it("clicking a filter chip body opens the Filter dropdown focused on that column's detail pane", async () => {
    const wrapper = mount(DataTable, {
      props: { data: ROWS, columns: THREE_COLS, rowKey: 'id' },
      attachTo: document.body,
    })
    await openDd(wrapper, 'Filter')
    const nameRow = wrapper.findAll('.dt__dd-item').find((el) => el.text().startsWith('Alice'))!
    await nameRow.find('input[type="checkbox"]').trigger('click')
    await openDd(wrapper, 'Filter') // close

    expect(wrapper.find('.dropdown__menu').exists()).toBe(false)
    const chipBody = wrapper.find('.dt__chip--info .dt__chip-body')
    expect(chipBody.text()).toContain('Alice')
    await chipBody.trigger('click')
    expect(wrapper.find('.dropdown__menu').exists()).toBe(true)
    // Detail pane already shows Name's checklist (not Score's range inputs) on the very first
    // render, and the Name column button in the left pane is focused.
    expect(wrapper.find('.dt__range-input').exists()).toBe(false)
    expect(document.activeElement).toBe(
      wrapper.findAll('.dt__filter-col-item').find((el) => el.text().startsWith('Name'))!.element,
    )
  })
})
