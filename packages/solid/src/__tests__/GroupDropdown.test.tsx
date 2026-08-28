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

const CATEGORIZED_GROUPABLE: ColumnDef<Row>[] = [
  { key: 'dept', label: 'Dept', groupable: true },
  { key: 'team', label: 'Team', groupable: true, category: 'Org' },
]

function mountCategorized() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  // See SortDropdown.test.tsx's identical comment on its own mountCategorized — a CategorySubmenu
  // portals to document.body, so render()'s own disposer must be captured and called too.
  let disposeView!: () => void
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, CATEGORIZED_GROUPABLE)
    const [isOpen] = createSignal(true)
    disposeView = render(
      () => (
        <GroupDropdown
          table={table}
          groupableCols={CATEGORIZED_GROUPABLE}
          isOpen={isOpen()}
          onToggle={() => {}}
          onClose={() => {}}
        />
      ),
      container,
    )
    return d
  })
  return {
    container,
    table,
    dispose: () => {
      disposeView()
      dispose()
    },
  }
}

describe('GroupDropdown — column categories', () => {
  it('renders uncategorized addable columns as plain rows and categorized ones under a submenu trigger', () => {
    const { container, dispose } = mountCategorized()
    expect(
      [...container.querySelectorAll('button[data-col-key]')].map((b) => b.textContent),
    ).toEqual(['Dept'])
    expect(container.querySelector('.dt-dd-category-trigger')?.textContent).toContain('Org')
    dispose()
  })

  it('opens the submenu on click and adds a group from a row inside it', () => {
    const { container, table, dispose } = mountCategorized()
    const trigger = container.querySelector<HTMLButtonElement>('.dt-dd-category-trigger')!
    trigger.click()
    const submenu = document.querySelector('.dt-dd-submenu')!
    const teamBtn = [...submenu.querySelectorAll('button[data-col-key]')].find(
      (b) => b.textContent === 'Team',
    ) as HTMLButtonElement
    teamBtn.click()
    expect(table.group.by()).toEqual(['team'])
    dispose()
  })
})

describe('GroupDropdown', () => {
  it('clicking an addable column adds it to groupBy', () => {
    const { container, table, dispose } = mount()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Dept')!
    btn.click()
    expect(table.group.by()).toEqual(['dept'])
    dispose()
  })

  it('activating an addable column keeps focus on its new active row, synchronously', () => {
    const { container, dispose } = mount()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Dept')!
    btn.click()
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="dept"]'))
    dispose()
  })

  it('remove button removes just that group entry', () => {
    const { container, table, dispose } = mount()
    table.group.toggle('dept')
    table.group.toggle('team')
    container
      .querySelector<HTMLElement>('[data-group-key="dept"]')!
      .querySelector<HTMLButtonElement>('.dt-item-remove')!
      .click()
    expect(table.group.by()).toEqual(['team'])
    dispose()
  })

  it('removing an active column returns focus to its addable button, synchronously', () => {
    const { container, table, dispose } = mount()
    table.group.toggle('dept')
    container
      .querySelector<HTMLElement>('[data-group-key="dept"]')!
      .querySelector<HTMLButtonElement>('.dt-item-remove')!
      .click()
    expect(document.activeElement).toBe(container.querySelector('[data-col-key="dept"]'))
    dispose()
  })

  it('Alt+ArrowUp/Down reorders active group entries and keeps focus on the moved row', () => {
    const { container, table, dispose } = mount()
    table.group.toggle('dept')
    table.group.toggle('team')
    const teamRow = container.querySelector<HTMLElement>('[data-group-key="team"]')!
    teamRow.focus()
    teamRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(table.group.by()).toEqual(['team', 'dept'])
    // Regression: focus used to drop to <body> after this reorder.
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="team"]'))
    dispose()
  })

  it('drag-and-drop reorders active group entries', () => {
    const { container, table, dispose } = mount()
    table.group.toggle('dept')
    table.group.toggle('team')
    stubRects(container, '[data-group-key]')

    const deptRow = container.querySelector<HTMLElement>('[data-group-key="dept"]')!
    deptRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    const teamRow = container.querySelector<HTMLElement>('[data-group-key="team"]')!
    teamRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 50 }))
    teamRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 50 }))

    expect(table.group.by()).toEqual(['team', 'dept'])
    dispose()
  })

  it('the clear-groups × button appears only when groupBy is non-empty and clears it', () => {
    const { container, table, dispose } = mount()
    expect(container.querySelector('.dt-btn-clear')).toBeNull()
    table.group.toggle('dept')
    const clearBtn = container.querySelector<HTMLButtonElement>('.dt-btn-clear')
    expect(clearBtn).not.toBeNull()
    clearBtn!.click()
    expect(table.group.by()).toEqual([])
    dispose()
  })
})
