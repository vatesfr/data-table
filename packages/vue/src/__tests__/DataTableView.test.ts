import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import { useTableState } from '../useTableState'
import DataTableViewRaw from '../DataTableView.vue'
import type { ColumnDef } from '../types'

// vue-tsc can't carry the SFC's `generic="TRow extends object"` parameter through to
// consumers, so cast once here rather than sprinkling `as any` through every test.
const DataTableView = DataTableViewRaw as unknown as new () => { $props: Record<string, unknown> }

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

type Table = ReturnType<typeof useTableState<Row>>

// Simulates a consumer that owns `useTableState` itself (for persistence, imperative
// selection control, etc.) and renders the built-in UI via `DataTableView` instead of
// `<DataTable>`.
function mountView(options: { selectable?: boolean; attachToBody?: boolean } = {}) {
  let table!: Table
  const Comp = defineComponent({
    setup() {
      table = useTableState(ROWS, COLS)
      return () =>
        h(DataTableView, {
          table,
          data: ROWS,
          columns: COLS,
          selectable: options.selectable,
        } as Record<string, unknown>)
    },
  })
  // vue-test-utils renders into a detached fragment by default — real DOM focus (`.focus()`
  // actually moving `document.activeElement`) needs the element connected to `document.body`.
  const wrapper = mount(Comp, options.attachToBody ? { attachTo: document.body } : undefined)
  return { table, wrapper }
}

describe('DataTableView', () => {
  it('U31: announces the row count and page in a polite status region', async () => {
    const { table, wrapper } = mountView()
    const status = () => wrapper.find('[role="status"]').text()
    expect(status()).toBe('2 / 2 rows')
    table.search.setQuery('ali')
    await nextTick()
    expect(status()).toBe('1 / 2 rows')
    table.search.setQuery('zzz')
    await nextTick()
    expect(status()).toBe('No matching rows')
    table.search.setQuery('')
    table.pagination.setPageSize(1)
    await nextTick()
    expect(status()).toBe('2 / 2 rows, Page 1 of 2')
  })

  it('renders the built-in table UI from an externally-owned table', () => {
    const { wrapper } = mountView()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('marks rows clickable when given a @row-click listener directly', () => {
    const Comp = defineComponent({
      setup() {
        const table = useTableState(ROWS, COLS)
        return () =>
          h(DataTableView, {
            table,
            data: ROWS,
            columns: COLS,
            onRowClick: () => {},
          } as Record<string, unknown>)
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.find('tbody tr').classes()).toContain('dt-tr--clickable')
  })

  it("injects core's shared stylesheet once, without theme tokens", () => {
    mountView()
    mountView()
    const styles = document.querySelectorAll('style[data-dt-styles]')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toContain('.dt-dd{')
    expect(styles[0].textContent).not.toContain('--color-background-primary:')
  })

  it('reflects external mutations to the table object (e.g. from a persistence helper)', async () => {
    const { table, wrapper } = mountView()
    // Acts on the table object directly, exactly as usePersistedView/useUrlView would after
    // decoding a stored/URL view — not through any DataTableView UI interaction.
    table.setViewState({ sorts: [{ key: 'score', dir: 'asc' }] })
    await wrapper.vm.$nextTick()
    // A single sorted column shows only the direction arrow, no index number.
    expect(wrapper.text()).toContain('Score ↑')
    expect(wrapper.text()).not.toContain('1↑')
    expect(table.getViewState()).toEqual({ sorts: [{ key: 'score', dir: 'asc' }] })
  })

  it('supports imperative selection control from outside via the table object', () => {
    const { table } = mountView()
    table.selection.toggle(ROWS[0])
    expect(table.selection.rows.value).toEqual([ROWS[0]])
    table.selection.clear()
    expect(table.selection.rows.value).toEqual([])
  })

  it('does not move real DOM focus by default', async () => {
    const { table, wrapper } = mountView({ selectable: true, attachToBody: true })
    table.focus.moveTo(ROWS[1])
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const bobRow = wrapper.findAll('tr').find((tr) => tr.text().includes('Bob'))!
    expect(document.activeElement).not.toBe(bobRow.element)
    wrapper.unmount()
  })

  it('moves real DOM focus when passed { focus: true }', async () => {
    const { table, wrapper } = mountView({ selectable: true, attachToBody: true })
    table.focus.moveTo(ROWS[1], { focus: true })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const bobRow = wrapper.findAll('tr').find((tr) => tr.text().includes('Bob'))!
    expect(document.activeElement).toBe(bobRow.element)
    wrapper.unmount()
  })
  it('exposes each sorted header direction as aria-sort', async () => {
    const { table, wrapper } = mountView()
    table.setViewState({ sorts: [{ key: 'score', dir: 'desc' }] })
    await wrapper.vm.$nextTick()
    const header = (label: string) => wrapper.findAll('th').find((th) => th.text().includes(label))!
    expect(header('Score').attributes('aria-sort')).toBe('descending')
    expect(header('Name').attributes('aria-sort')).toBeUndefined()
  })

  it('names the select-all, group and row checkboxes', async () => {
    const { table, wrapper } = mountView({ selectable: true })
    const names = () =>
      wrapper.findAll('input[type="checkbox"]').map((c) => c.attributes('aria-label'))
    expect(names()).toEqual(['Select all', 'Select row Alice', 'Select row Bob'])
    table.setViewState({ groupBy: ['score'] })
    await wrapper.vm.$nextTick()
    expect(names()).toContain('Select group 90')
  })
})

describe('DataTableView — filter checklist counts', () => {
  it('formats them with the formatCount label', async () => {
    const Comp = defineComponent({
      setup() {
        const table = useTableState(ROWS, COLS, { labels: { formatCount: (n) => `#${n}` } })
        return () =>
          h(DataTableView, { table, data: ROWS, columns: COLS } as Record<string, unknown>)
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Filter'))!
      .trigger('click')
    const counts = wrapper.findAll('.dt-filter-count').map((c) => c.text())
    expect(counts.length).toBeGreaterThan(0)
    expect(counts.every((c) => /^#\d+$/.test(c))).toBe(true)
    wrapper.unmount()
  })
})

describe('DataTableView — currentRow', () => {
  it('matches a current row held in a ref, which wraps it in a reactive proxy', () => {
    const current = ref<Row | null>(ROWS[1])
    const Comp = defineComponent({
      setup() {
        const table = useTableState(ROWS, COLS)
        return () =>
          h(DataTableView, {
            table,
            data: ROWS,
            columns: COLS,
            currentRow: current.value,
          } as Record<string, unknown>)
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.findAll('tbody tr[aria-current="true"]')).toHaveLength(1)
  })

  it('matches the current row by getRowId after a refetch', () => {
    const refetched = ROWS.map((r) => ({ ...r }))
    const Comp = defineComponent({
      setup() {
        const table = useTableState(refetched, COLS, { getRowId: (r) => r.id })
        return () =>
          h(DataTableView, { table, data: refetched, columns: COLS, currentRow: ROWS[1] } as Record<
            string,
            unknown
          >)
      },
    })
    const wrapper = mount(Comp)
    const marked = wrapper.findAll('tbody tr[aria-current="true"]')
    expect(marked).toHaveLength(1)
    expect(marked[0].text()).toContain(ROWS[1].name)
  })

  it('keeps DOM focus on a row that a refetch moves', async () => {
    const data = shallowRef(ROWS)
    let table!: Table
    const Comp = defineComponent({
      setup() {
        table = useTableState(data, COLS, { getRowId: (r) => r.id })
        return () =>
          h(DataTableView, {
            table,
            data: data.value,
            columns: COLS,
            selectable: true,
          } as Record<string, unknown>)
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    table.focus.moveTo(ROWS[1], { focus: true })
    await nextTick()
    await nextTick()
    const row = () => wrapper.findAll('tbody tr').find((tr) => tr.text().includes('Bob'))!.element
    expect(document.activeElement).toBe(row())
    data.value = [...ROWS].reverse().map((r) => ({ ...r }))
    await nextTick()
    await nextTick()
    expect(wrapper.find('tbody tr').text()).toContain('Bob')
    expect(document.activeElement).toBe(row())
    wrapper.unmount()
  })
})

describe('DataTableView — group aggregates', () => {
  // One group of 5, split over pages of 3 items (header + 2 rows, then 3 rows)
  const SPLIT: Row[] = [1, 2, 3, 4, 5].map((id) => ({ id, name: 'A', score: 10 }))
  const AGG_COLS: ColumnDef<Row>[] = [
    { key: 'name', label: 'Name', groupable: true },
    { key: 'score', label: 'Score', type: 'number', aggregate: 'sum' },
  ]
  function mountSplit(cols = AGG_COLS, slots: Record<string, (scope: never) => unknown> = {}) {
    let table!: Table
    const Comp = defineComponent({
      setup() {
        table = useTableState(SPLIT, cols, {
          defaultGroupsCollapsed: false,
          initialViewState: { groupBy: ['name'], pageSize: 3 },
        })
        return () =>
          h(
            DataTableView,
            {
              table,
              data: SPLIT,
              columns: cols,
              selectable: true,
            } as Record<string, unknown>,
            slots,
          )
      },
    })
    const wrapper = mount(Comp)
    const aggText = () => wrapper.find('.dt-agg-row [data-col-key="score"]').text()
    const countText = () => wrapper.find('.dt-group-count').text()
    return { table, wrapper, aggText, countText }
  }

  it("shows a split group's whole total and row count on every page", async () => {
    const { table, aggText, countText } = mountSplit()
    expect([aggText(), countText()]).toEqual(['50', '5 rows'])
    table.pagination.setPage(2)
    await nextTick()
    expect([aggText(), countText()]).toEqual(['50', '5 rows'])
  })

  it("selects a split group's rows on every page from its checkbox", async () => {
    const { table, wrapper } = mountSplit()
    await wrapper.find('input[aria-label^="Select group"]').trigger('change')
    expect(table.selection.rows.value).toEqual(SPLIT)
  })

  it('formats an aggregate with aggregateFormat instead of the cell format', () => {
    const { aggText } = mountSplit([
      AGG_COLS[0],
      {
        ...AGG_COLS[1],
        format: () => 'cell',
        aggregateFormat: (v, rows) => `${String(v)} over ${rows.length}`,
      },
    ])
    expect(aggText()).toBe('50 over 5')
  })

  it('renders an aggregate through the #aggregate-{key} slot, given the whole group', () => {
    const { wrapper } = mountSplit(AGG_COLS, {
      'aggregate-score': ({ value, rows }: { value: unknown; rows: Row[] }) =>
        h('b', `${String(value)} / ${rows.length}`),
    })
    expect(wrapper.find('.dt-agg-row [data-col-key="score"] b').text()).toBe('50 / 5')
  })

  it('prefers aggregateFormat to the #aggregate-{key} slot', () => {
    const slot = vi.fn(() => h('b', 'slot'))
    const { aggText } = mountSplit(
      [AGG_COLS[0], { ...AGG_COLS[1], aggregateFormat: (v) => `=${String(v)}` }],
      { 'aggregate-score': slot },
    )
    expect(aggText()).toBe('=50')
    expect(slot).not.toHaveBeenCalled()
  })

  it("doesn't render an empty aggregate through the #aggregate-{key} slot", () => {
    const slot = vi.fn(() => h('b', 'slot'))
    const { aggText } = mountSplit([AGG_COLS[0], { ...AGG_COLS[1], aggregate: () => null }], {
      'aggregate-score': slot,
    })
    expect(aggText()).toBe('')
    expect(slot).not.toHaveBeenCalled()
  })
})
