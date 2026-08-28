import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { SortDropdown } from '../components/SortDropdown'
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
const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90 },
  { id: 2, name: 'Bob', score: 60 },
]

// Gives every row in `container` a deterministic, non-zero-height rect in document order, since
// jsdom doesn't compute real layout — resolveDropRow's cursor-position math needs real rects.
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
    table = createTableState(ROWS, COLS)
    const [isOpen, setIsOpen] = createSignal(true)
    render(
      () => (
        <SortDropdown
          table={table}
          columns={COLS}
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

const CATEGORIZED_COLS: ColumnDef<Row>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', category: 'Info' },
  { key: 'score', label: 'Score', type: 'number', category: 'Numbers' },
]

function mountCategorized() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  // A CategorySubmenu's flyout is rendered through a <Portal> straight to document.body (see
  // CategorySubmenu.tsx) — render()'s own internal root isn't a child of the outer createRoot
  // (same gotcha packages/vanilla/src/index.tsx's own `disposeView`/`dispose` pair documents), so
  // its returned disposer must be captured and called too, or a submenu left open at the end of a
  // test leaks its portaled DOM node into every test that runs after it (confirmed empirically:
  // a bare `dispose()` alone left `.dt-dd-submenu` in the DOM, polluting document-level queries in
  // later tests — regular, non-portaled content never surfaced this, since it's scoped under
  // `container`, itself just as undisposed but harmlessly so).
  let disposeView!: () => void
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, CATEGORIZED_COLS)
    const [isOpen] = createSignal(true)
    disposeView = render(
      () => (
        <SortDropdown
          table={table}
          columns={CATEGORIZED_COLS}
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

function triggerFor(container: HTMLElement, name: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('.dt-dd-category-trigger')].find((b) =>
    b.textContent?.includes(name),
  )!
}

describe('SortDropdown — column categories', () => {
  it('renders uncategorized addable columns as plain rows and categorized ones under a submenu trigger', () => {
    const { container, dispose } = mountCategorized()
    expect(
      [...container.querySelectorAll('button[data-col-key]')].map((b) => b.textContent),
    ).toEqual(['ID']) // Name/Score are categorized, not addable rows themselves
    expect(
      [...container.querySelectorAll('.dt-dd-category-trigger')].map((b) => b.textContent),
    ).toEqual(['Info▸', 'Numbers▸']) // alphabetized, same as this list's other ordering
    dispose()
  })

  it('opens the submenu on click and adds a sort from a row inside it', () => {
    const { container, table, dispose } = mountCategorized()
    const trigger = triggerFor(container, 'Numbers')
    expect(document.querySelector('.dt-dd-submenu')).toBeNull()

    trigger.click()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const submenu = document.querySelector('.dt-dd-submenu')!
    expect(submenu).not.toBeNull()
    const scoreBtn = [...submenu.querySelectorAll('button[data-col-key]')].find(
      (b) => b.textContent === 'Score',
    ) as HTMLButtonElement
    scoreBtn.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    dispose()
  })

  it('opening one category submenu closes the previously open sibling (only one open at a time)', () => {
    const { container, dispose } = mountCategorized()
    const infoTrigger = triggerFor(container, 'Info')
    const numbersTrigger = triggerFor(container, 'Numbers')

    infoTrigger.click()
    expect(infoTrigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelectorAll('.dt-dd-submenu').length).toBe(1)

    numbersTrigger.click()
    expect(infoTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(numbersTrigger.getAttribute('aria-expanded')).toBe('true')
    // Still just one submenu in the DOM — Info's closed, not left open alongside Numbers'.
    expect(document.querySelectorAll('.dt-dd-submenu').length).toBe(1)
    dispose()
  })

  it('Escape closes the submenu and refocuses the trigger, without closing the whole dropdown', () => {
    const { container, dispose } = mountCategorized()
    const trigger = triggerFor(container, 'Info')
    trigger.click()
    const submenu = document.querySelector<HTMLElement>('.dt-dd-submenu')!
    const firstRow = submenu.querySelector<HTMLElement>('[data-dd-row]')!
    firstRow.focus()
    firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.dt-dd-submenu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    dispose()
  })

  // Regression: the submenu's rows are portaled to document.body (see CategorySubmenu.tsx), so
  // they're no longer DOM descendants of the panel Dropdown.tsx's own generic roving nav scopes
  // itself to — ArrowDown silently did nothing here until CategorySubmenu grew its own local nav.
  it("ArrowUp/ArrowDown/Home/End rove between the submenu's own rows once open", async () => {
    const oneCategoryCols: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', category: 'Info' },
      { key: 'score', label: 'Score', type: 'number', category: 'Info' },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    let disposeView!: () => void
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, oneCategoryCols)
      const [isOpen] = createSignal(true)
      disposeView = render(
        () => (
          <SortDropdown
            table={table}
            columns={oneCategoryCols}
            isOpen={isOpen()}
            onToggle={() => {}}
            onClose={() => {}}
          />
        ),
        container,
      )
      return d
    })
    const trigger = triggerFor(container, 'Info')
    trigger.click()
    // The initial focus-first-row is a queueMicrotask (see CategorySubmenu.tsx's focusFirstRow) —
    // let it resolve before asserting on document.activeElement.
    await Promise.resolve()
    await Promise.resolve()
    const submenu = document.querySelector<HTMLElement>('.dt-dd-submenu')!
    const rows = [...submenu.querySelectorAll<HTMLElement>('[data-dd-row]')]
    expect(rows.map((r) => r.textContent)).toEqual(['Name', 'Score'])
    expect(document.activeElement).toBe(rows[0])

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(rows[1])

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(rows[0])

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(rows[1])

    // Clamped at the last row — no wrap-around, matching Dropdown.tsx's own top-level nav.
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(rows[1])

    disposeView()
    dispose()
  })
})

describe('SortDropdown', () => {
  it('clicking an addable column adds it as an ascending sort', () => {
    const { container, table, dispose } = mount()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Score')!
    btn.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    dispose()
  })

  it('activating an addable column keeps focus on its new active row (Solid updates synchronously, no pending-ref indirection needed)', () => {
    const { container, dispose } = mount()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Score')!
    btn.click()
    // Assert synchronously, right after .click() returns — no await/tick — to actually prove the
    // DOM update and focus both landed within the same call stack.
    expect(document.activeElement).toBe(container.querySelector('[data-sort-key="score"]'))
    dispose()
  })

  it('clicking an active row toggles its direction', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('score')
    const row = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    row.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'desc' }])
    dispose()
  })

  it('the remove button removes just that entry without toggling its direction', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    const row = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    row.querySelector<HTMLButtonElement>('.dt-item-remove')!.click()
    expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    dispose()
  })

  it('removing an active column returns focus to its addable button, synchronously', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('name')
      const [isOpen, setIsOpen] = createSignal(true)
      render(
        () => (
          <SortDropdown
            table={table}
            columns={COLS}
            isOpen={isOpen()}
            onToggle={() => setIsOpen((o) => !o)}
            onClose={() => setIsOpen(false)}
          />
        ),
        container,
      )
      return d
    })
    const row = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    row.querySelector<HTMLButtonElement>('.dt-item-remove')!.click()
    expect(document.activeElement).toBe(container.querySelector('[data-col-key="name"]'))
    dispose()
  })

  it('Alt+ArrowUp/Down reorders active entries and keeps focus on the moved row', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.focus()
    scoreRow.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(table.sort.entries().map((s) => s.key)).toEqual(['score', 'name'])
    // Regression: focus used to drop to <body> after this reorder.
    expect(document.activeElement).toBe(container.querySelector('[data-sort-key="score"]'))
    dispose()
  })

  it('drag-and-drop reorders active entries', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    stubRects(container, '[data-sort-key]')

    // jsdom has no DragEvent — a plain MouseEvent works identically here since dispatch only
    // cares about the `type` string matching what onDragStart/onDragOver/onDrop bind to, and
    // resolveDropRow only reads `clientY`.
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    nameRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    // score row is the second row (index 1), rect top=30/bottom=60 per stubRects — drop past its
    // vertical midpoint (clientY=50) resolves to "insert after".
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    scoreRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 50 }))
    scoreRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 50 }))

    expect(table.sort.entries().map((s) => s.key)).toEqual(['score', 'name'])
    dispose()
  })

  // D12 regression: a cursor position that isn't over any row's own rect (a dead-zone gap between
  // non-adjacent rows) must reject the drop rather than snapping to the nearest row — matching
  // React/Vue's own resolveDropdownDragRow behavior (fixed here via the shared, extracted
  // resolveDropRow, which Solid previously didn't use).
  it('drag-and-drop rejects a drop in a dead-zone gap between non-adjacent rows', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    const scoreRow = container.querySelector<HTMLElement>('[data-sort-key="score"]')!
    // A real gap between the two rows' rects (30–50), unlike stubRects' contiguous layout.
    nameRow.getBoundingClientRect = () =>
      ({ top: 0, bottom: 30, left: 0, right: 100, height: 30, width: 100 }) as DOMRect
    scoreRow.getBoundingClientRect = () =>
      ({ top: 50, bottom: 80, left: 0, right: 100, height: 30, width: 100 }) as DOMRect

    nameRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    scoreRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 40 }))
    expect(scoreRow.classList.contains('dt-dd-item--drag-over')).toBe(false)
    expect(scoreRow.classList.contains('dt-dd-item--drag-over-after')).toBe(false)
    scoreRow.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 40 }))

    // No reorder happened — the drop was rejected.
    expect(table.sort.entries().map((s) => s.key)).toEqual(['name', 'score'])
    dispose()
  })

  // D13 regression: hovering the dragged row itself must not highlight/act on it — matching
  // React's own onDragOver guard, which Solid previously lacked.
  it('drag-and-drop does not highlight the dragged row when hovering itself', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('name')
    table.sort.appendOrToggle('score')
    stubRects(container, '[data-sort-key]')

    const nameRow = container.querySelector<HTMLElement>('[data-sort-key="name"]')!
    nameRow.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }))
    // name row is the first row (index 0), rect top=0/bottom=30 per stubRects.
    nameRow.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 10 }))
    expect(nameRow.classList.contains('dt-dd-item--drag-over')).toBe(false)
    expect(nameRow.classList.contains('dt-dd-item--drag-over-after')).toBe(false)

    expect(table.sort.entries().map((s) => s.key)).toEqual(['name', 'score'])
    dispose()
  })

  it('search narrows the addable list only, not the active section', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('id')
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.value = 'sco'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const addableLabels = [...container.querySelectorAll('.dt-dd-item--click .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(addableLabels).toEqual(['Score'])
    expect(container.querySelector('[data-sort-key="id"]')).not.toBeNull()
    dispose()
  })

  it('excludes a sortable: false column from the addable list', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'id', label: 'ID', sortable: false },
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', type: 'number' },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      const table = createTableState(ROWS, cols)
      const [isOpen, setIsOpen] = createSignal(true)
      render(
        () => (
          <SortDropdown
            table={table}
            columns={cols}
            isOpen={isOpen()}
            onToggle={() => setIsOpen((o) => !o)}
            onClose={() => setIsOpen(false)}
          />
        ),
        container,
      )
      return d
    })
    const addableLabels = [...container.querySelectorAll('.dt-dd-item--click .dt-flex1')].map(
      (el) => el.textContent,
    )
    expect(addableLabels).not.toContain('ID')
    expect(addableLabels).toEqual(['Name', 'Score'])
    dispose()
  })
})
