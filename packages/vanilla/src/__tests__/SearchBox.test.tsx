import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { SearchBox } from '../components/SearchBox'
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

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const table = createTableState(ROWS, COLS)
  const dispose = createRoot((d) => {
    render(() => <SearchBox table={table} />, container)
    return d
  })
  return { container, table, dispose }
}

describe('SearchBox', () => {
  it('typing into the search input narrows processedData', () => {
    const { container, table, dispose } = mount()
    const input = container.querySelector<HTMLInputElement>('input')!
    input.value = 'ali'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(table.searchQuery()).toBe('ali')
    expect(table.processedData()).toEqual([ROWS[0]])
    dispose()
  })

  it('the clear button only renders once there is a query, and clears it on click', () => {
    const { container, dispose } = mount()
    expect(container.querySelector('.dt-search-clear')).toBeNull()

    const input = container.querySelector<HTMLInputElement>('input')!
    input.value = 'ali'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    const clearBtn = container.querySelector<HTMLButtonElement>('.dt-search-clear')!
    expect(clearBtn).not.toBeNull()
    clearBtn.click()
    expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('')
    expect(container.querySelector('.dt-search-clear')).toBeNull()
    dispose()
  })

  it('regression: typing consecutive digits appends in order, with zero manual caret-restore code', () => {
    // Same scenario as the vanilla render()-based regression test (see createDataTable.test.ts),
    // reproduced here against the Solid component to confirm the fix is structural: Solid reuses
    // this exact <input> DOM node across every state-driven re-render, so the browser's own
    // caret position is never disturbed — unlike the old innerHTML-rebuild-per-keystroke model,
    // which needed (and could fail to apply) an explicit selectionStart/setSelectionRange restore.
    const { container, dispose } = mount()
    const input = container.querySelector<HTMLInputElement>('input')!
    input.focus()

    function typeChar(char: string): void {
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? input.value.length
      input.value = input.value.slice(0, start) + char + input.value.slice(end)
      input.setSelectionRange(start + char.length, start + char.length)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }

    typeChar('8')
    typeChar('5')
    expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('85')
    expect(container.querySelector<HTMLInputElement>('input')).toBe(input) // same DOM node reused
    dispose()
  })
})
