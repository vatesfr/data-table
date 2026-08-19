import { describe, it, expect, vi } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DataTable } from '../DataTable'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
}

const COLS: ColumnDef<Row>[] = [{ key: 'name', label: 'Name' }]
const ROWS: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.dt-tr[data-proc-idx] .dt-td')].map(
    (td) => td.textContent ?? '',
  )
}

describe('DataTable', () => {
  it('renders the given columns and rows with no createTableState/DataTableView wiring needed', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={COLS} rowKey="id" />, container)
      return d
    })
    expect(container.querySelector('.dt-th')?.textContent).toContain('Name')
    expect(rowNames(container)).toEqual(['Alice', 'Bob'])
    dispose()
  })

  it('tracks reactive data/columns props with no manual sync effect from the consumer', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const [rows, setRows] = createSignal(ROWS)
    const dispose = createRoot((d) => {
      render(() => <DataTable data={rows()} columns={COLS} rowKey="id" />, container)
      return d
    })
    expect(rowNames(container)).toEqual(['Alice', 'Bob'])
    setRows([...ROWS, { id: 3, name: 'Clara' }])
    expect(rowNames(container)).toEqual(['Alice', 'Bob', 'Clara'])
    dispose()
  })

  it('fires onSelectionChange, with no need to hold onto a TableState to observe it', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const onSelectionChange = vi.fn()
    const dispose = createRoot((d) => {
      render(
        () => (
          <DataTable
            data={ROWS}
            columns={COLS}
            rowKey="id"
            selectable
            onSelectionChange={onSelectionChange}
          />
        ),
        container,
      )
      return d
    })
    const checkbox = container.querySelector<HTMLInputElement>(
      '.dt-tr[data-proc-idx] input[type="checkbox"]',
    )!
    checkbox.click()
    expect(onSelectionChange).toHaveBeenCalledWith([ROWS[0]])
    dispose()
  })
})
