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
function mountView() {
  let table!: Table
  const Comp = defineComponent({
    setup() {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Vue's setup(), not a React component; the rule's naming heuristic doesn't know Vue
      table = useTableState(ROWS, COLS)
      return () =>
        h(DataTableView, { table, data: ROWS, columns: COLS, rowKey: 'id' } as Record<
          string,
          unknown
        >)
    },
  })
  const wrapper = mount(Comp)
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
    expect(wrapper.text()).toContain('1↑')
    expect(table.getViewState()).toEqual({ sorts: [{ key: 'score', dir: 'asc' }] })
  })

  it('supports imperative selection control from outside via the table object', () => {
    const { table } = mountView()
    table.toggleRowSelection(ROWS[0])
    expect(table.selectedRows.value).toEqual([ROWS[0]])
    table.clearSelection()
    expect(table.selectedRows.value).toEqual([])
  })
})
