import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { ColumnsDropdown } from '../components/ColumnsDropdown'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score', type: 'number' },
]
const ROWS: Row[] = [{ id: 1, name: 'Alice', score: 90 }]

function stubRects(container: HTMLElement, selector: string): void {
  const rows = [...container.querySelectorAll<HTMLElement>(selector)]
  rows.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: i * 30, bottom: i * 30 + 30, left: 0, right: 100, height: 30, width: 100 }) as DOMRect
  })
}

function mount(cols: ColumnDef<Row>[] = COLS) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  // A CategorySubmenu's flyout portals to document.body (see CategorySubmenu.tsx) — render()'s
  // own disposer must be captured and called too, or a submenu left open leaks its portaled DOM
  // node into every test that runs after it (see SortDropdown.test.tsx's identical comment).
  let disposeView!: () => void
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, cols)
    const [isOpen] = createSignal(true)
    disposeView = render(
      () => (
        <ColumnsDropdown
          table={table}
          columns={cols}
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

function visibleLabels(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll('.dt-dd-item--colrow .dt-flex1')].map((el) =>
    el.textContent?.trim(),
  )
}

// Like mount(), but with a real onClose spy — mount()'s own isOpen is a fixed `true` with no
// wiring back from onToggle/onClose, which can't observe whether Escape actually asked to close.
function mountWithCloseSpy() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  let closed = false
  // render()'s own disposer must be captured and called too (see mount()'s identical comment
  // above on why) — a test here ends by leaving a row focused, and without this the container
  // (and its still-focused node) never actually unmounts, leaking a stale document.activeElement
  // into whichever test runs next.
  let disposeView!: () => void
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS)
    const [isOpen] = createSignal(true)
    disposeView = render(
      () => (
        <ColumnsDropdown
          table={table}
          columns={COLS}
          isOpen={isOpen()}
          onToggle={() => {}}
          onClose={() => {
            closed = true
          }}
        />
      ),
      container,
    )
    return d
  })
  return {
    container,
    table,
    wasClosed: () => closed,
    dispose: () => {
      disposeView()
      dispose()
    },
  }
}

describe('ColumnsDropdown — Visible section', () => {
  it('lists every visible column in table order, not alphabetized', () => {
    const { container, dispose } = mount()
    expect(visibleLabels(container)).toEqual(['ID', 'Name', 'Score'])
    dispose()
  })

  it('the × button hides a column, moving it into Available', () => {
    const { container, table, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score'])
    expect(visibleLabels(container)).toEqual(['Name', 'Score'])
    expect(container.querySelector('[data-col-key="id"]')?.textContent).toContain('ID')
    dispose()
  })

  it('Delete/Backspace on a focused visible row hides it, same as its × button', () => {
    const { container, table, dispose } = mount()
    const row = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
    )
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score'])
    dispose()
  })

  it('hiding the last visible column is a no-op (stays >= 1 visible)', () => {
    const { container, table, dispose } = mount()
    // Hide two of the three, leaving one.
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['score'])
    container
      .querySelector<HTMLButtonElement>('[data-col-row-key="score"] .dt-item-remove')!
      .click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['score']) // unchanged
    dispose()
  })

  it('drag-and-drop reorders visible columns (reflected in activeColumns order)', () => {
    const { container, table, dispose } = mount()
    stubRects(container, '[data-col-row-key]')
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    // score row is at index 2 (top=60/bottom=90) — drop past its midpoint (clientY=80) inserts
    // "id" after "score".
    const scoreRow = container.querySelector<HTMLElement>('[data-col-row-key="score"]')!
    scoreRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 80 }))
    scoreRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 80 }))
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'score', 'id'])
    dispose()
  })

  it('Alt+ArrowDown on a row moves it down one visible position', () => {
    const { container, table, dispose } = mount()
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(table.columns.active().map((c) => c.key)).toEqual(['name', 'id', 'score'])
    dispose()
  })

  it('Alt+ArrowDown/ArrowUp keeps focus on the moved row instead of dropping to <body>', () => {
    const { container, dispose } = mount()
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.focus()
    idRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    // "id" is now the row at its new position — same node, moved.
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="id"]'))
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="id"]'))
    dispose()
  })

  it('Alt+ArrowDown skips a hidden column, reordering against the next visible one', () => {
    const { container, table, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click() // hide the one in between id/score
    expect(visibleLabels(container)).toEqual(['ID', 'Score'])
    const idRow = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    idRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(visibleLabels(container)).toEqual(['Score', 'ID']) // not a no-op
    expect(table.columns.active().map((c) => c.key)).toEqual(['score', 'id'])
    dispose()
  })

  it('Enter/Space on a row preventDefault (no click action of its own, but stops the native Space-scroll)', () => {
    const { container, dispose } = mount()
    const row = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    row.dispatchEvent(enterEvent)
    expect(enterEvent.defaultPrevented).toBe(true)
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    row.dispatchEvent(spaceEvent)
    expect(spaceEvent.defaultPrevented).toBe(true)
    dispose()
  })

  it('Escape closes the dropdown on the first press when focus is on a row, even with a non-empty search term', () => {
    const { container, wasClosed, dispose } = mountWithCloseSpy()
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'e'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const row = container.querySelector<HTMLElement>('[data-col-row-key]')!
    row.focus()
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(wasClosed()).toBe(true)
    expect(search.value).toBe('e') // untouched — Escape closed instead of clearing
    dispose()
  })
})

describe('ColumnsDropdown — Available section', () => {
  it('lists hidden columns as plain addable rows, in table order', () => {
    const { container, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    container
      .querySelector<HTMLButtonElement>('[data-col-row-key="score"] .dt-item-remove')!
      .click()
    expect(
      [...container.querySelectorAll('button[data-col-key]')].map((b) => b.textContent),
    ).toEqual(['ID', 'Score'])
    dispose()
  })

  it('clicking an addable row shows the column again and refocuses its new visible row', () => {
    const { container, table, dispose } = mount()
    container.querySelector<HTMLButtonElement>('[data-col-row-key="id"] .dt-item-remove')!.click()
    container.querySelector<HTMLButtonElement>('[data-col-key="id"]')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="id"]'))
    dispose()
  })

  it('a re-shown column reappears at its original table-order position, not appended at the end', () => {
    const { container, table, dispose } = mount()
    // Hide the middle column, then show it again with no drag in between.
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    container.querySelector<HTMLButtonElement>('[data-col-key="name"]')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    dispose()
  })

  it('the search box stays mounted once every column is visible (no Available section, though)', () => {
    const { container, table, dispose } = mount()
    expect(container.querySelector('.dt-dd-search')).not.toBeNull()
    const sectionLabels = [...container.querySelectorAll('.dt-dd-section')].map((el) =>
      el.textContent?.trim(),
    )
    expect(sectionLabels).not.toContain(table.labels().availableColumnsSection)
    dispose()
  })

  it('the search box has a labeled clear button, shown only once it has a value', () => {
    const { container, table, dispose } = mount()
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    expect(container.querySelector('.dt-dd-search-clear')).toBeNull()

    search.value = 'sco'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const clearBtn = container.querySelector<HTMLButtonElement>('.dt-dd-search-clear')!
    expect(clearBtn).not.toBeNull()
    expect(clearBtn.title).toBe(table.labels().clearSearch)
    expect(clearBtn.getAttribute('aria-label')).toBe(table.labels().clearSearch)

    clearBtn.click()
    expect(container.querySelector<HTMLInputElement>('.dt-dd-search')!.value).toBe('')
    expect(container.querySelector('.dt-dd-search-clear')).toBeNull()
    dispose()
  })

  it('categorized hidden columns collapse into a submenu trigger instead of plain rows', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    container
      .querySelector<HTMLButtonElement>('[data-col-row-key="score"] .dt-item-remove')!
      .click()
    expect(container.querySelector('button[data-col-key]')).toBeNull() // no flat addable rows
    expect(container.querySelector('.dt-dd-category-trigger')?.textContent).toContain('Info')
    dispose()
  })

  it('adding a categorized column from inside its submenu refocuses the new visible row', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, table, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    const trigger = container.querySelector<HTMLButtonElement>('.dt-dd-category-trigger')!
    trigger.click()
    const submenu = document.querySelector('.dt-dd-submenu')!
    submenu.querySelector<HTMLButtonElement>('[data-col-key="name"]')!.click()
    expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    expect(document.activeElement).toBe(container.querySelector('[data-col-row-key="name"]'))
    dispose()
  })

  it('hiding a categorized column refocuses its category submenu trigger, not a nonexistent addable row', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    expect(document.activeElement).toBe(
      container.querySelector('.dt-dd-category-trigger[data-category-name="Info"]'),
    )
    dispose()
  })

  it('search narrows both Visible and Available, matching label or category', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()
    expect(visibleLabels(container)).toEqual(['ID', 'Score'])

    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'Score'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(visibleLabels(container)).toEqual(['Score']) // Visible is narrowed too now
    dispose()
  })

  it('a category match is flattened into a plain, category-tagged row while searching', () => {
    const categorized: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const { container, dispose } = mount(categorized)
    container.querySelector<HTMLButtonElement>('[data-col-row-key="name"] .dt-item-remove')!.click()

    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'Name'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.dt-dd-category-trigger')).toBeNull() // no submenu while searching
    const row = container.querySelector<HTMLButtonElement>('[data-col-key="name"]')!
    expect(row.textContent).toContain('Name')
    expect(row.textContent).toContain('Info') // category shown as a tag instead

    // Clearing the search restores the collapsed submenu.
    search.value = ''
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.dt-dd-category-trigger')?.textContent).toContain('Info')
    dispose()
  })

  it('the search box never unmounts, even when the query matches nothing at all', () => {
    const { container, dispose } = mount()
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'zzzz-no-match'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.dt-dd-search')).toBe(search)
    expect(visibleLabels(container)).toEqual([])
    dispose()
  })
})

describe('ColumnsDropdown — reordering while searching', () => {
  it("Alt+ArrowDown only swaps with the next search-matching row, leaving a filtered-out column's own position untouched", () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'id', label: 'Foo1' },
      { key: 'name', label: 'Bar' },
      { key: 'score', label: 'Foo2', type: 'number' },
    ]
    const { container, table, dispose } = mount(cols)
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'Foo' // matches Foo1/Foo2, not Bar
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(visibleLabels(container)).toEqual(['Foo1', 'Foo2'])

    const foo1Row = container.querySelector<HTMLElement>('[data-col-row-key="id"]')!
    foo1Row.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    // Foo1 swaps with Foo2 (the next search-matching row) — Bar, hidden by the filter, keeps its
    // exact position in between rather than being swapped with either.
    expect(table.columns.active().map((c) => c.key)).toEqual(['score', 'name', 'id'])
    expect(visibleLabels(container)).toEqual(['Foo2', 'Foo1'])
    dispose()
  })
})
