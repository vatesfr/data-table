import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DataTable } from '../DataTable'
import { createTableState } from '../createTableState'
import { GroupDropdown } from '../components/GroupDropdown'
import type { ColumnDef } from '../types'

// Mirrors packages/react/src/__tests__/dropdownSearchNav.test.tsx's own fixture/coverage, scoped
// to what's implemented in Solid so far (see CLAUDE.md's "Filter dropdown"/keyboard-nav docs for
// what's still deferred there vs. this file's own coverage).
interface Row {
  id: number
  name: string
  dept: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name', filterable: true },
  { key: 'dept', label: 'Dept', filterable: true, groupable: true },
  { key: 'score', label: 'Score', type: 'number', filterable: true },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', score: 90 },
  { id: 2, name: 'Bob', dept: 'HR', score: 60 },
]

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const dispose = createRoot((d) => {
    render(() => <DataTable data={ROWS} columns={COLS} rowKey="id" />, container)
    return d
  })
  return { container, dispose }
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === text)!
  btn.click()
}

// Dropdown.tsx's focus-on-open runs in a queueMicrotask, not synchronously in its panel's own ref
// callback — a ref callback fires at this element's own insertion time, before `props.children`
// (passed down through several component boundaries: Columns/Sort/Group/Filter -> Dropdown) has
// actually been resolved and appended underneath it, so focusing synchronously there found
// nothing every time. Same reasoning the pre-existing viewport-clamp measurement already needed a
// microtask for (there, for layout; here, for DOM presence).
function tick(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

describe('DataTable — dropdown focus-on-open', () => {
  it('opening the Sort dropdown focuses its search box', async () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Sort')
    await tick()
    expect(document.activeElement).toBe(container.querySelector('.dt-dd-search'))
    dispose()
  })

  it('opening the Columns dropdown focuses its search box', async () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Columns')
    await tick()
    expect(document.activeElement).toBe(container.querySelector('.dt-dd-search'))
    dispose()
  })

  it('opening a dropdown with no search box (nothing to add) focuses the first active row', async () => {
    const cols: ColumnDef<Row>[] = [{ key: 'name', label: 'Name', groupable: true }]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, cols)
      table.group.toggle('name')
      const [isOpen, setIsOpen] = createSignal(true)
      render(
        () => (
          <GroupDropdown
            table={table}
            groupableCols={cols}
            isOpen={isOpen()}
            onToggle={() => setIsOpen((o) => !o)}
            onClose={() => setIsOpen(false)}
          />
        ),
        container,
      )
      return d
    })
    await tick()
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="name"]'))
    dispose()
  })
})

describe('DataTable — dropdown keyboard navigation order and Escape', () => {
  it('ArrowDown moves from the Columns search box into its row list', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Columns')
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    // Roving nav only acts on a key when document.activeElement is one of its own recognized
    // focusables — simulate the user already being focused in the search box (independent of
    // whether the real focus-on-open microtask has fired yet).
    search.focus()
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).not.toBe(search)
    expect(document.activeElement?.matches('input[type="checkbox"]')).toBe(true)
    dispose()
  })

  it('Home/End jump to the first/last row of the Columns dropdown, skipping the search box', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Columns')
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.focus()
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    const rows = [...container.querySelectorAll<HTMLInputElement>('[data-dd-row] input')]
    expect(document.activeElement).toBe(rows[rows.length - 1])
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(rows[0])
    dispose()
  })

  it('ArrowDown/ArrowUp move between rows, clamped at the edges (no wrap)', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Columns')
    const rows = [...container.querySelectorAll<HTMLInputElement>('[data-dd-row] input')]
    rows[0].focus()
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    // No row above the first one, and the search box isn't part of the row list itself for
    // ArrowUp purposes from a row — it's still reachable, one step up.
    expect(document.activeElement).toBe(container.querySelector('.dt-dd-search'))
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(rows[0])
    dispose()
  })

  it('Escape clears a non-empty dropdown search term before closing the dropdown', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Columns')
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'nam'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(container.querySelector('.dt-dd')).not.toBeNull() // still open
    expect(search.value).toBe('')
    dispose()
  })

  it('Escape closes the dropdown immediately when its search term is already empty, refocusing the toggle button', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Columns')
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(container.querySelector('.dt-dd')).toBeNull() // closed
    const toggleBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Columns',
    )!
    expect(document.activeElement).toBe(toggleBtn)
    dispose()
  })
})

describe('DataTable — Sort/Group activate/remove focus retention', () => {
  it('activating an addable column in the Sort dropdown keeps focus on its new active row', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Sort')
    clickButtonByText(container, 'Score')
    expect(document.activeElement).toBe(container.querySelector('[data-sort-key="score"]'))
    dispose()
  })

  it('removing an active Sort column returns focus to its addable button', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Sort')
    clickButtonByText(container, 'Score')
    container
      .querySelector<HTMLElement>('[data-sort-key="score"]')!
      .querySelector<HTMLButtonElement>('.dt-item-remove')!
      .click()
    expect(document.activeElement).toBe(container.querySelector('[data-col-key="score"]'))
    dispose()
  })

  it('activating/removing an active Group column keeps focus, same as Sort', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Group')
    clickButtonByText(container, 'Dept')
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="dept"]'))
    container
      .querySelector<HTMLElement>('[data-group-key="dept"]')!
      .querySelector<HTMLButtonElement>('.dt-item-remove')!
      .click()
    expect(document.activeElement).toBe(container.querySelector('[data-col-key="dept"]'))
    dispose()
  })
})

describe('DataTable — active-bar chip click actions', () => {
  it("clicking a group chip's body opens the Group dropdown, focused on that entry's row", async () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Group')
    clickButtonByText(container, 'Dept')
    // Close the dropdown (click the toggle again) so the chip click has to reopen it.
    clickButtonByText(container, 'Group')
    expect(container.querySelector('.dt-dd')).toBeNull()

    // Grouping a column auto-inserts a matching sort entry (see "Auto-syncing group order with
    // sort"), so the chip is the merged grouped-sort pill: its body toggles sort direction, and
    // the separate ⊞ group-mark button is what opens the Group dropdown.
    const groupMark = container.querySelector<HTMLButtonElement>('.dt-chip-group-mark')!
    groupMark.click()
    expect(container.querySelector('.dt-dd')).not.toBeNull()
    // The chip's own focus override is queued in a microtask *after* Dropdown's own already-
    // scheduled focus-on-open, specifically so it runs last and wins the race — see
    // DataTableView.tsx's onOpenGroup. One awaited tick drains both.
    await tick()
    expect(document.activeElement).toBe(container.querySelector('[data-group-key="dept"]'))
    dispose()
  })

  it("clicking a filter chip's body opens the Filter dropdown, focused on that column's detail pane", async () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    container.querySelector<HTMLElement>('[data-filter-col-key="score"]')!.click()
    container.querySelector<HTMLInputElement>('input.dt-range-input')!.value = '70'
    container
      .querySelector<HTMLInputElement>('input.dt-range-input')!
      .dispatchEvent(new Event('input', { bubbles: true }))
    // Close the dropdown so the chip click has to reopen it, landing back on "Score" specifically
    // rather than whatever column the panel last happened to show.
    clickButtonByText(container, 'Filter')
    expect(container.querySelector('.dt-dd')).toBeNull()

    const chip = [...container.querySelectorAll('.dt-chip-body')].find((el) =>
      el.textContent?.includes('Score'),
    )!
    ;(chip as HTMLButtonElement).click()
    await tick()
    expect(document.activeElement).toBe(container.querySelector('[data-filter-col-key="score"]'))
    // The column selection itself follows focus (no separate "which column" state to push) —
    // confirmed by the right pane now showing Score's own range controls.
    expect(container.querySelector('input.dt-range-input')).not.toBeNull()
    dispose()
  })
})

describe('DataTable — filter dropdown left/right pane navigation', () => {
  it('ArrowRight on the left column list enters the right detail pane', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    const nameCol = container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!
    nameCol.focus()
    nameCol.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    // The select-all checkbox renders before the search box in DOM order but isn't part of the
    // right pane's own nav focusable-set (same "sits beside the list, not part of it" reasoning
    // as the generic dropdowns' own search-adjacent controls) — the value-search box is first.
    expect(document.activeElement).toBe(
      container.querySelector('.dt-filter-detail input[data-dd-value-search]'),
    )
    dispose()
  })

  it('ArrowLeft from a checklist row returns focus to the active column button', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!.click()
    const row = container.querySelector<HTMLInputElement>('input[data-dd-value-row]')!
    row.focus()
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(container.querySelector('[data-filter-col-key="name"]'))
    dispose()
  })

  it('ArrowLeft does not hijack cursor movement in the value-search text box', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!.click()
    const search = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    search.focus()
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    // Still focused in the search box — the event was left alone for native cursor movement.
    expect(document.activeElement).toBe(search)
    dispose()
  })

  it('ArrowDown/ArrowUp move between checklist rows in the filter detail pane', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!.click()
    const rows = [...container.querySelectorAll<HTMLInputElement>('input[data-dd-value-row]')]
    rows[0].focus()
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(rows[1])
    rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement).toBe(rows[0])
    dispose()
  })

  it('Home/End jump to the first/last checklist row, skipping the value-search box', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!.click()
    const search = container.querySelector<HTMLInputElement>('input[data-dd-value-search]')!
    const rows = [...container.querySelectorAll<HTMLInputElement>('input[data-dd-value-row]')]
    search.focus()
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(rows[rows.length - 1])
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(rows[0])
    dispose()
  })
})

describe('DataTable — filter dropdown "focus follows selection"', () => {
  it('focusing a different column in the left pane updates the right pane immediately, with no Enter/Space needed', () => {
    const { container, dispose } = mount()
    clickButtonByText(container, 'Filter')
    container.querySelector<HTMLElement>('[data-filter-col-key="score"]')!.focus()
    expect(container.querySelector('input.dt-range-input')).not.toBeNull()
    container.querySelector<HTMLElement>('[data-filter-col-key="name"]')!.focus()
    expect(container.querySelector('input.dt-range-input')).toBeNull()
    expect(container.querySelector('.dt-filter-list')).not.toBeNull()
    dispose()
  })
})
