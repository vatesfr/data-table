import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { GroupDropdown } from '../components/GroupDropdown'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  dept: string
  team: string
}

const GROUPABLE: ColumnDef<Row>[] = [
  { key: 'dept', label: 'Dept', groupable: true },
  { key: 'team', label: 'Team', groupable: true },
]
const ROWS: Row[] = [
  { id: 1, dept: 'Eng', team: 'A' },
  { id: 2, dept: 'HR', team: 'B' },
]

function stubRects(container: HTMLElement, selector: string): void {
  const rows = [...container.querySelectorAll<HTMLElement>(selector)]
  rows.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: i * 30, bottom: i * 30 + 30, left: 0, right: 100, height: 30, width: 100 }) as DOMRect
  })
}

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, GROUPABLE)
    const [isOpen, setIsOpen] = createSignal(true)
    render(
      () => (
        <GroupDropdown
          table={table}
          groupableCols={GROUPABLE}
          isOpen={isOpen()}
          onToggle={() => setIsOpen((o) => !o)}
          onClose={() => setIsOpen(false)}
        />
      ),
      container,
    )
    return d
  })
  return { container, table, dispose }
}

describe('GroupDropdown', () => {
  it('clicking an addable column adds it to groupBy', () => {
    const { container, table, dispose } = mount()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Dept')!
    btn.click()
    expect(table.groupBy()).toEqual(['dept'])
    dispose()
  })

  it('remove button removes just that group entry', () => {
    const { container, table, dispose } = mount()
    table.toggleGroup('dept')
    table.toggleGroup('team')
    container
      .querySelector<HTMLElement>('[data-group-key="dept"]')!
      .querySelector<HTMLButtonElement>('.dt-item-remove')!
      .click()
    expect(table.groupBy()).toEqual(['team'])
    dispose()
  })

  it('drag-and-drop reorders active group entries', () => {
    const { container, table, dispose } = mount()
    table.toggleGroup('dept')
    table.toggleGroup('team')
    stubRects(container, '[data-group-key]')

    const deptRow = container.querySelector<HTMLElement>('[data-group-key="dept"]')!
    deptRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    const teamRow = container.querySelector<HTMLElement>('[data-group-key="team"]')!
    teamRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 50 }))
    teamRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 50 }))

    expect(table.groupBy()).toEqual(['team', 'dept'])
    dispose()
  })

  it('the clear-groups × button appears only when groupBy is non-empty and clears it', () => {
    const { container, table, dispose } = mount()
    expect(container.querySelector('.dt-btn-clear')).toBeNull()
    table.toggleGroup('dept')
    const clearBtn = container.querySelector<HTMLButtonElement>('.dt-btn-clear')
    expect(clearBtn).not.toBeNull()
    clearBtn!.click()
    expect(table.groupBy()).toEqual([])
    dispose()
  })
})
