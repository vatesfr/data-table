import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
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
          rowKey: 'id',
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
  it('renders the built-in table UI from an externally-owned table', () => {
    const { wrapper } = mountView()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
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
})
