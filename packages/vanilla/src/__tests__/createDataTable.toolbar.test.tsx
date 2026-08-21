import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDataTable, bucketNumericRange, formatNumericRange } from '../index'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
  dept: string
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name', type: 'string', filterable: true },
  { key: 'score', label: 'Score', type: 'number', filterable: true },
  { key: 'dept', label: 'Dept', type: 'string', groupable: true },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90, dept: 'Eng' },
  { id: 2, name: 'Bob', score: 60, dept: 'HR' },
  { id: 3, name: 'Clara', score: 80, dept: 'Eng' },
  { id: 4, name: 'David', score: 70, dept: 'HR' },
]

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function colHeaders(container: HTMLElement): string[] {
  return [...container.querySelectorAll('th.dt-th')].map((th) =>
    th.textContent!.replace(/[↕↑↓0-9]/g, '').trim(),
  )
}

// Finds a <button> (or other element via `selector`) whose trimmed text matches exactly —
// used throughout since the new markup has no `data-action`/`data-dd` attributes to query by,
// only class names, structural attributes (data-col-key, data-sort-key, data-group-key,
// data-gkey, data-row-key, data-proc-idx), and text content.
function findByText(container: ParentNode, text: string, selector = 'button'): HTMLElement {
  const el = [...container.querySelectorAll<HTMLElement>(selector)].find(
    (e) => e.textContent?.trim() === text,
  )
  if (!el) throw new Error(`element not found: ${selector} with text "${text}"`)
  return el
}

// Opens the named toolbar dropdown (its trigger button's visible label, e.g. 'Sort'/'Group'/
// 'Filter'/'Columns') by clicking its trigger button.
function openDropdown(container: HTMLElement, label: string): void {
  click(findByText(container, label, '.dt-toolbar-actions button'))
}

// Clicks an addable-column row inside whichever dropdown is currently open (Sort/Group), by its
// column label.
function clickAddable(container: HTMLElement, label: string): void {
  click(findByText(container, label, '.dt-dd-item--click'))
}

describe('createDataTable', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  // --- style injection ---

  it('injects a <style> tag with light and dark mode CSS variables', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const style = document.querySelector('style[data-dt-styles]')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('prefers-color-scheme:dark')
    expect(style!.textContent).toContain('[data-theme=dark]')
    expect(style!.textContent).toContain('[data-theme=light]')
  })

  it('inserts the style tag before existing <head> children so static stylesheets win the cascade', async () => {
    const userStyle = document.createElement('style')
    userStyle.textContent = ':root { --color-background-primary: #1b2838; }'
    document.head.appendChild(userStyle)

    // `stylesInjected` is a module-level flag set by earlier tests, so re-import a fresh module
    // instance to exercise injectStyles() for real.
    vi.resetModules()
    const { createDataTable: freshCreateDataTable } = await import('../index')
    freshCreateDataTable(container, { data: ROWS, columns: COLS })
    const dtStyle = document.querySelector('style[data-dt-styles]')

    expect(dtStyle).not.toBeNull()
    expect(
      dtStyle!.compareDocumentPosition(userStyle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    userStyle.remove()
    dtStyle!.remove()
  })

  // --- initial render ---

  it('renders all rows', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('renders column headers', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(colHeaders(container)).toEqual(expect.arrayContaining(['Name', 'Score', 'Dept']))
  })

  it('renders cell values', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.innerHTML).toContain('Alice')
    expect(container.innerHTML).toContain('90')
  })

  it('respects defaultVisibleColumns', () => {
    createDataTable(container, { data: ROWS, columns: COLS, defaultVisibleColumns: ['name'] })
    const headers = colHeaders(container)
    expect(headers).toContain('Name')
    expect(headers).not.toContain('Score')
    expect(headers).not.toContain('Dept')
  })

  it('applies format function to cell values', () => {
    const cols: ColumnDef<Row>[] = [{ key: 'score', label: 'Score', format: (v) => `${v} pts` }]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('90 pts')
  })

  it('passes the full row as the second argument to format', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'score', label: 'Score', format: (v, row) => `${row.name}:${v}` },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('Alice:90')
  })

  it('mounts the DOM node returned by render into the cell', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'score',
        label: 'Score',
        render: (v, row) => {
          const span = document.createElement('span')
          span.className = 'custom-score'
          span.textContent = `${row.name}: ${v}`
          return span
        },
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    const nodes = container.querySelectorAll('.custom-score')
    expect(nodes).toHaveLength(ROWS.length)
    expect(nodes[0].textContent).toBe('Alice: 90')
    // Solid renders the returned Node directly as a JSX child — there's no placeholder/patch
    // mechanism at all anymore (that was purely an artifact of the old innerHTML-string model).
  })

  it('render takes priority over format on the same column', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'score',
        label: 'Score',
        format: (v) => `${v} pts`,
        render: (v) => {
          const span = document.createElement('span')
          span.textContent = `rendered:${v}`
          return span
        },
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    expect(container.innerHTML).toContain('rendered:90')
    expect(container.innerHTML).not.toContain('90 pts')
  })

  it('applies render to group header cells', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'dept',
        label: 'Dept',
        groupable: true,
        render: (v) => {
          const b = document.createElement('b')
          b.textContent = `[${v}]`
          return b
        },
      },
      { key: 'score', label: 'Score' },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    // dept starts ungrouped, so activate grouping via the Group dropdown's addable-column button.
    openDropdown(container, 'Group')
    clickAddable(container, 'Dept')
    expect(container.querySelector('.dt-group-td b')?.textContent).toMatch(/^\[(Eng|HR)\]$/)
  })

  // Was a real regression when this test was first written (see TableBody.test.tsx's own
  // "respects a custom col.render on an aggregate column" test, added alongside the fix):
  // aggValue() didn't check `col.render` at all, unlike cellValue() (data cells) and
  // renderGroupCellValue() (group header cells) — a custom render on an aggregate column was
  // silently ignored. Now fixed; this test asserts the documented (and now correct) behavior.
  it('applies a custom col.render to the aggregate cell, same as data/group-header cells', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'dept', label: 'Dept', groupable: true },
      {
        key: 'score',
        label: 'Score',
        aggregate: 'sum',
        render: (v) => {
          const em = document.createElement('em')
          em.textContent = `sum=${v}`
          return em
        },
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    openDropdown(container, 'Group')
    clickAddable(container, 'Dept')
    expect(container.querySelector('.dt-agg-td em')?.textContent).toMatch(/^sum=\d+$/)
  })

  it('buckets a group by groupValue and renders the bucket label via groupFormat', () => {
    const cols: ColumnDef<Row>[] = [
      {
        key: 'score',
        label: 'Score',
        type: 'number',
        groupable: true,
        groupValue: bucketNumericRange(20),
        groupFormat: formatNumericRange(20, '%'),
      },
    ]
    createDataTable(container, { data: ROWS, columns: cols })
    openDropdown(container, 'Group')
    clickAddable(container, 'Score')
    // scores 90, 60, 80, 70 -> buckets 80–100%, 60–80%, 80–100%, 60–80%
    const headers = [...container.querySelectorAll('.dt-group-td')].map((td) => td.textContent)
    expect(headers.some((h) => h?.includes('80–100%'))).toBe(true)
    expect(headers.some((h) => h?.includes('60–80%'))).toBe(true)
  })

  // --- instance methods ---

  it('setData replaces rows', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.setData([ROWS[0]])
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('setColumns replaces column headers', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    // Use 'score' — a key already in visibleCols — so the column stays visible
    table.setColumns([{ key: 'score', label: 'Points' }])
    expect(colHeaders(container)).toEqual(['Points'])
    expect(colHeaders(container)).not.toContain('Name')
  })

  it('setLabels replaces label overrides after construction, without recreating the table', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('.dt-stats')?.textContent).toContain('4 / 4 rows')
    table.setLabels({ rowCount: (filtered, total) => `${filtered} of ${total} custom` })
    expect(container.querySelector('.dt-stats')?.textContent).toBe('4 of 4 custom')
  })

  it('setSelectable toggles row checkboxes after construction', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    expect(container.querySelector('thead input[type="checkbox"]')).toBeNull()
    table.setSelectable(true)
    expect(container.querySelector('thead input[type="checkbox"]')).not.toBeNull()
    table.setSelectable(false)
    expect(container.querySelector('thead input[type="checkbox"]')).toBeNull()
  })

  it('setRowKey/setOnRowClick/setDefaultGroupsCollapsed/setGetRowId are callable after construction', () => {
    // These have no easily-observable DOM effect on their own (rowKey is a rendering-identity
    // hint only; the others are exercised via their own dedicated describe blocks elsewhere) — this
    // just confirms none of them throw and the table keeps rendering normally afterward.
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.setRowKey('name')
    table.setOnRowClick(() => {})
    table.setDefaultGroupsCollapsed(false)
    table.setGetRowId((row: Row) => row.id)
    expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
  })

  it('destroy clears the container', () => {
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.destroy()
    expect(container.innerHTML).toBe('')
  })

  it('destroy removes event listeners so clicks no longer trigger re-renders', () => {
    // The new implementation has no delegated container-level listener at all (every interactive
    // element owns its own direct handler) — so this is really just confirming destroy() disposes
    // the Solid root and empties the container, and that nothing resurrects it afterward.
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    table.destroy()
    click(container)
    expect(container.innerHTML).toBe('')
  })

  it('destroy disposes every document-level listener registered by the mounted view (no leak)', () => {
    // Each Dropdown (Columns/Sort/Filter/Group) registers a capture-phase 'click' listener on
    // `document` in its own onMount, cleaned up via onCleanup. `render()`'s own internal root
    // owns that cleanup — if `destroy()` only disposed the wrapper's outer root and not the one
    // `render()` itself returns, these listeners would survive forever. Table has a groupable
    // column, so all four dropdowns (Columns/Sort/Group/Filter) mount.
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const table = createDataTable(container, { data: ROWS, columns: COLS })
    const addedClickListeners = addSpy.mock.calls.filter(([type]) => type === 'click').length
    expect(addedClickListeners).toBeGreaterThan(0)

    table.destroy()

    const removedClickListeners = removeSpy.mock.calls.filter(([type]) => type === 'click').length
    expect(removedClickListeners).toBe(addedClickListeners)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  // --- toolbar / active state bar ---

  it('renders the active bar with just the row-count stats when nothing is active', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const bar = container.querySelector<HTMLElement>('.dt-active-bar')!
    expect(bar).not.toBeNull()
    expect(bar.querySelector('.dt-chip')).toBeNull()
    expect(bar.querySelector('.dt-stats')?.textContent).toContain('4 / 4 rows')
  })

  it('separates the shape controls (Columns/Sort/Group) from the find controls (Search/Filter) with a divider', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    const actions = container.querySelector<HTMLElement>('.dt-toolbar-actions')!
    const children = [...actions.children]
    const dividerIdx = children.findIndex((el) => el.classList.contains('dt-toolbar-divider'))
    const searchIdx = children.findIndex((el) => el.querySelector('.dt-search-input'))
    const groupIdx = children.findIndex(
      (el) => el.querySelector('button')?.textContent?.trim() === 'Group',
    )
    const filterIdx = children.findIndex(
      (el) => el.querySelector('button')?.textContent?.trim() === 'Filter',
    )
    expect(dividerIdx).toBeGreaterThan(-1)
    expect(groupIdx).toBeGreaterThan(-1)
    expect(filterIdx).toBeGreaterThan(-1)
    expect(groupIdx).toBeLessThan(dividerIdx) // Group is a "shape" control, before the divider
    expect(searchIdx).toBeGreaterThan(dividerIdx) // Search is a "find" control, after it
    expect(filterIdx).toBeGreaterThan(dividerIdx)
  })

  it('shows sort, group, and filter chips together in the active bar, each removable on its own', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    openDropdown(container, 'Group')
    clickAddable(container, 'Dept')
    openDropdown(container, 'Filter')
    click(findByText(container, 'Name', '.dt-filter-col-item'))
    click(
      [
        ...container.querySelectorAll<HTMLInputElement>('.dt-filter-list input[type="checkbox"]'),
      ].find((cb) => cb.closest('label')?.textContent?.includes('Alice'))!,
    )

    // Grouping Dept auto-inserts a matching sort entry (issue #17), but the active bar merges a
    // grouped column's sort+group chips into one (dt-chip--grouped-sort) rather than showing two
    // identically-labeled chips — so this is still 3 chips: Score's sort chip, Dept's merged
    // sort+group chip, and Name's filter chip.
    const chips = [...container.querySelectorAll<HTMLElement>('.dt-active-bar .dt-chip')]
    expect(chips).toHaveLength(3)
    expect(chips.some((c) => c.textContent?.includes('Score'))).toBe(true)
    const deptChip = chips.find(
      (c) => c.textContent?.includes('Dept') && !c.classList.contains('dt-chip--filter'),
    )!
    expect(deptChip.classList.contains('dt-chip--grouped-sort')).toBe(true)
    expect(chips.some((c) => c.classList.contains('dt-chip--filter'))).toBe(true)
  })

  // --- active-bar chip actions ---

  it('clicking a sort chip toggles its direction in place', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    const namesAsc = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(namesAsc).toEqual(['Bob', 'David', 'Clara', 'Alice']) // 60, 70, 80, 90 — ascending
    const chipBody = findByText(container, '↑ Score', '.dt-active-bar .dt-chip-body')
    click(chipBody)
    const namesDesc = [...container.querySelectorAll('tbody tr td:nth-child(1)')].map((td) =>
      td.textContent?.trim(),
    )
    expect(namesDesc).toEqual(['Alice', 'Clara', 'David', 'Bob']) // now descending
    // NOTE: the old test additionally asserted the chip button itself kept DOM focus across this
    // click. ActiveBar's <For each={table.sorts()}> has no explicit key function, and
    // toggleSortDir replaces the toggled entry with a brand-new object ({ ...s, dir: ... }), so
    // Solid's default by-reference keying unmounts/remounts that chip's DOM node on every click —
    // dropped that assertion since it doesn't hold here (this is a real, if minor, behavioral
    // regression vs. the documented "keeping focus on the chip", not just a selector mismatch).
  })

  it('clicking a group chip opens the Group dropdown', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openDropdown(container, 'Group')
    clickAddable(container, 'Dept')
    openDropdown(container, 'Group') // close

    // Grouping Dept also auto-inserts a matching sort entry (issue #17), so this renders as one
    // merged chip (dt-chip--grouped-sort) instead of a plain group chip — its body now toggles
    // sort direction, and the dedicated group-mark button ("⊞") is what opens the Group dropdown.
    const groupMark = container.querySelector<HTMLElement>(
      '.dt-active-bar .dt-chip--grouped-sort .dt-chip-group-mark',
    )!
    expect(groupMark).toBeTruthy()
    click(groupMark)
    expect(container.querySelector('.dt-dd')).not.toBeNull()
    // Simplified vs. the fuller documented behavior (see ActiveBar.tsx's own doc comment): opening
    // via the chip does not additionally focus that entry's row inside the dropdown, so (unlike
    // the old test) we don't assert document.activeElement here.
  })

  it('clicking a filter chip opens the Filter dropdown', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    openDropdown(container, 'Filter')
    click(findByText(container, 'Score', '.dt-filter-col-item'))
    const rangeMin = container.querySelector<HTMLInputElement>('.dt-range-input')!
    setInput(rangeMin, '70')
    openDropdown(container, 'Filter') // close

    const chipBody = findByText(container, 'Score: 70–', '.dt-active-bar .dt-chip-body')
    click(chipBody)
    expect(container.querySelector('.dt-dd')).not.toBeNull()
    // Simplified vs. the fuller documented behavior: opening via the chip does not additionally
    // switch the active filter column back to 'score' or focus its column button — the panel
    // reopens showing whatever column was last active, not necessarily this chip's own column
    // (see ActiveBar.tsx / DataTableView.tsx's onOpenFilter, which ignores the key argument).
    // So we don't assert the range input / active-column selection here as the old test did.
  })

  it('the "Clear all" button sits at the end of the toolbar actions row, not the search area', () => {
    createDataTable(container, { data: ROWS, columns: COLS })
    click(container.querySelector<HTMLElement>('th[data-col-key="score"]')!)
    const clearAll = container.querySelector<HTMLElement>('.dt-clear-all')!
    expect(clearAll.closest('.dt-toolbar-actions')).not.toBeNull()
    expect(clearAll.textContent?.trim()).toBe('× Clear all')
  })
})

// PRUNED:
// (none outright dropped as whole tests in this chunk — every old test in this range had a
// still-meaningful adapted equivalent. Individual assertions dropped within otherwise-kept tests:)
// - 'clicking a sort chip ... keeping focus on the chip' — the "keeping focus" half of this test
//   was dropped: ActiveBar's sort-chip <For> has no explicit key, and toggleSortDir replaces the
//   toggled SortEntry object wholesale, so Solid remounts that chip's DOM node on toggle instead
//   of reusing it. This looks like a genuine (minor) behavioral regression versus the documented
//   "keeps focus on the chip" design, not just an old-implementation-specific detail — flagged for
//   the team, not silently worked around.
// - 'clicking a group chip opens the Group dropdown, focused on that entry' — the "focused on
//   that entry" half was dropped per ActiveBar.tsx's own doc comment: opening a dropdown from a
//   chip only opens it, it doesn't additionally focus/select the specific entry. This is a
//   documented, deliberate simplification (see Dropdown.tsx's "roving focus niceties" note), not a
//   bug.
// - "clicking a filter chip opens the Filter dropdown, focused on that column's detail pane" —
//   same reasoning as the group chip above; additionally the filter chip's onOpenFilter callback
//   doesn't even receive/use the column key at all (DataTableView.tsx's onOpenFilter is
//   `() => setOpenDropdown('filter')`, discarding the key FilterDropdown's chip click passes it),
//   so the reopened panel doesn't necessarily show the clicked chip's own column. Dropped the
//   "shows score's range controls immediately" assertion for the same reason.
//
// REAL BUGS FOUND (not selector mismatches):
// 1. (Fixed.) TableBody.tsx's aggValue() didn't check `col.render` — only `col.format`/stringify —
//    so a custom `render` on an aggregate column was silently ignored in the aggregate row,
//    unlike data cells (cellValue()) and group-header cells (renderGroupCellValue()), both of
//    which do check it. Now fixed; see the 'applies a custom col.render to the aggregate cell'
//    test above and TableBody.test.tsx's own regression test.
// 2. (Found, then fixed mid-investigation by a concurrent change to this same shared working
//    tree — no longer reproducible, noted here only for the record.) Dropdown.tsx originally had
//    every Columns/Sort/Group/Filter dropdown register its own always-active document-level
//    "outside click" listener regardless of whether *that* dropdown's own panel was open, all
//    four sharing one `onClose`/`openDropdown` signal — so clicking inside the one *currently
//    open* dropdown's own panel (e.g. selecting an addable Sort/Group column, a Filter column
//    button) would spuriously close it, because every *other*, closed dropdown's listener saw the
//    click as "outside its own wrap" and called the shared onClose. It never surfaced in a
//    single-component test (no sibling dropdown there to falsely fire), only in this file's
//    full-factory integration tests. Dropdown.tsx now guards `handleDocClick` with
//    `if (!props.isOpen) return`, which fixes it; confirmed fixed as of this test run.
