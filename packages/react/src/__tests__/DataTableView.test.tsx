import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useTableState } from '../useTableState'
import { DataTableView } from '../DataTableView'
import type { ColumnDef } from '../types'

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

afterEach(cleanup)

// Simulates a consumer that owns `useTableState` itself (for persistence, imperative
// selection control, etc.) and renders the built-in UI via `DataTableView` instead of
// `<DataTable>`. `onReady` hands the live table object out so tests can drive it exactly
// like external code (a persistence helper, a toolbar outside the table) would.
function Harness({ onReady }: { onReady: (table: ReturnType<typeof useTableState<Row>>) => void }) {
  const table = useTableState(ROWS, COLS)
  onReady(table)
  return <DataTableView table={table} data={ROWS} columns={COLS} rowKey="id" />
}

describe('DataTableView', () => {
  it('renders the built-in table UI from an externally-owned table', () => {
    const { getByText } = render(<Harness onReady={() => {}} />)
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText('Bob')).toBeTruthy()
  })

  it('reflects external mutations to the table object (e.g. from a persistence helper)', () => {
    let table: ReturnType<typeof useTableState<Row>> | undefined
    const { getAllByText } = render(
      <Harness
        onReady={(t) => {
          table = t
        }}
      />,
    )
    // Acts on the table object directly, exactly as usePersistedView/useUrlView would after
    // decoding a stored/URL view — not through any DataTableView UI interaction.
    act(() => {
      table!.setViewState({ sorts: [{ key: 'score', dir: 'asc' }] })
    })
    expect(getAllByText('1↑').length).toBeGreaterThan(0)
    expect(table!.getViewState()).toEqual({ sorts: [{ key: 'score', dir: 'asc' }] })
  })

  it('supports imperative selection control from outside via the table object', () => {
    let table: ReturnType<typeof useTableState<Row>> | undefined
    render(
      <Harness
        onReady={(t) => {
          table = t
        }}
      />,
    )
    act(() => {
      table!.toggleRowSelection(ROWS[0])
    })
    expect(table!.selectedRows).toEqual([ROWS[0]])
    act(() => {
      table!.clearSelection()
    })
    expect(table!.selectedRows).toEqual([])
  })
})
