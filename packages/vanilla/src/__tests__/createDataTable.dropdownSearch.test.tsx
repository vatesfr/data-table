import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDataTable } from '../index'
import type { ColumnDef, DataTableInstance } from '../types'

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

function findButton(container: HTMLElement, text: string): HTMLElement {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`button "${text}" not found`)
  return btn
}

let container: HTMLElement
let instance: DataTableInstance<Row> | undefined

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  instance?.destroy()
  instance = undefined
  container.remove()
})

function mount(): void {
  instance = createDataTable(container, { data: ROWS, columns: COLS })
}

// The Columns dropdown's own search box/Available section only render when at least one column
// is hidden (see packages/solid/src/components/ColumnsDropdown.tsx) — every column is visible in
// `mount()`'s own fixture, so tests exercising that search box need one hidden from the start.
function mountWithHiddenColumn(): void {
  instance = createDataTable(container, {
    data: ROWS,
    columns: COLS,
    initialViewState: { visibleCols: ['name', 'dept'] },
  })
}

describe('createDataTable — dropdown column search', () => {
  it('the columns dropdown search box narrows the Available section by label', () => {
    mountWithHiddenColumn()
    click(findButton(container, 'Columns'))
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    setInput(search, 'sc')
    const rows = [...container.querySelectorAll('button[data-col-key]')].map((el) => el.textContent)
    expect(rows).toEqual(['Score'])
  })

  it('the sort dropdown search box narrows only the addable list, alphabetized, leaving active sorts untouched', () => {
    mount()
    click(findButton(container, 'Sort'))
    click(findButton(container, 'Dept'))
    const addable = [...container.querySelectorAll('.dt-dd-item--click .dt-flex1')].map(
      (el) => el.textContent,
    )
    // Name/Score, alphabetized — dept is already active and excluded from this list.
    expect(addable).toEqual(['Name', 'Score'])
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    setInput(search, 'sco')
    expect(
      [...container.querySelectorAll('.dt-dd-item--click .dt-flex1')].map((el) => el.textContent),
    ).toEqual(['Score'])
    // The active-sorts section (dept) stays visible regardless of the search term.
    expect(container.querySelector('.dt-dd-item--sortrow')).not.toBeNull()
  })

  it('the group dropdown search box narrows the addable list', () => {
    mount()
    click(findButton(container, 'Group'))
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    setInput(search, 'xyz')
    expect(container.querySelectorAll('.dt-dd-item--click').length).toBe(0)
  })

  it('the filter dropdown lists every filterable column in the left pane, alphabetized', () => {
    // NOTE: FilterDropdown.tsx has since gained its own left-pane search box + alphabetical
    // ordering (matching Sort/Group's addable lists, per CLAUDE.md's documented behavior) — this
    // was a real gap when this test was first written; both are now covered directly in
    // FilterDropdown.test.tsx ("FilterDropdown — left pane search"). This test now just confirms
    // the column list itself (order included).
    mount()
    click(findButton(container, 'Filter'))
    const labels = [...container.querySelectorAll('.dt-filter-col-item span:first-child')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Dept', 'Name', 'Score'])
  })
})

describe('createDataTable — dropdown escape/close', () => {
  it('Escape closes an open dropdown', () => {
    mountWithHiddenColumn()
    click(findButton(container, 'Columns'))
    expect(container.querySelector('.dt-dd')).not.toBeNull()
    const search = container.querySelector<HTMLInputElement>('.dt-dd-search')!
    search.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(container.querySelector('.dt-dd')).toBeNull()
  })
})

describe('createDataTable — filter dropdown: selecting a column in the left pane', () => {
  it('clicking a different column in the left pane switches the right pane', () => {
    mount()
    click(findButton(container, 'Filter'))
    expect(container.querySelector('.dt-range-input')).toBeNull() // 'name' (string) starts active
    const scoreBtn = [...container.querySelectorAll<HTMLElement>('.dt-filter-col-item')].find((b) =>
      b.textContent?.includes('Score'),
    )!
    click(scoreBtn)
    expect(container.querySelector('.dt-range-input')).not.toBeNull() // score (number) now active
    expect(scoreBtn.classList.contains('dt-filter-col-item--active')).toBe(true)
  })
})

// PRUNED:
// - 'ArrowDown moves through Sort dropdown rows in visible order: active row, then search box,
//   then addable rows' — dropdown roving keyboard nav (Up/Down between rows inside an open
//   dropdown) is deferred; Dropdown.tsx's own doc comment confirms only native Tab order works.
// - 'activating an addable column in the Sort dropdown keeps focus on its new active row' — focus
//   retention across the addable/active section swap isn't implemented; Solid doesn't preserve
//   focus across two structurally different JSX branches, and there's no code doing this manually.
// - 'removing an active Sort column returns focus to its addable button' — same as above, reverse
//   direction.
// - 'activating/removing an active Group column keeps focus, same as Sort' — same focus-retention
//   mechanism, not implemented for Group either.
// - 'ArrowDown/ArrowUp move focus between rows in an open dropdown' — roving keyboard nav,
//   deferred (see Dropdown.tsx doc comment).
// - 'ArrowUp on the first row is a no-op (stays put, no wrap)' — part of the same deferred roving
//   nav mechanism; nothing to assert once the mechanism doesn't exist (no arrow-key handler at
//   all on these rows, so this is really just "nothing happens", which isn't meaningful to test).
// - 'Home/End jump to the first/last row, skipping the search box' — roving nav, deferred.
// - 'Escape clears a non-empty dropdown search term before closing the dropdown' — the new
//   Dropdown.tsx's Escape handler unconditionally closes the dropdown; there's no
//   clear-search-first step. Kept a simplified 'Escape closes an open dropdown' test instead.
// - 'Escape closes the dropdown immediately when its search term is already empty, refocusing the
//   toggle button' — the toggle-button refocus part isn't implemented (onClose just flips a
//   signal, no explicit refocus call); folded the "closes" half into the simplified test above.
// - 'opening a dropdown focuses its search box' — focus-on-open is not implemented (Dropdown.tsx
//   doc comment: "not implemented" for this).
// - 'opening a dropdown with no search box (nothing left to add) focuses the first active row' —
//   same focus-on-open mechanism, not implemented.
// - 'ArrowRight on the left column list enters the right detail pane' — Filter dropdown's
//   Left/Right pane-crossing keyboard nav is deferred (FilterDropdown.tsx doc comment).
// - 'ArrowLeft from a checklist row returns focus to the active column button' — same
//   pane-crossing mechanism, not implemented.
// - 'ArrowLeft does not hijack cursor movement in the value-search text box' — this test only
//   made sense as a regression guard against the (now nonexistent) pane-crossing ArrowLeft
//   handler; native input behavior needs no test since nothing overrides it anymore.
// - 'focusing a different column in the left pane updates the right pane immediately, with no
//   Enter/Space needed' — FilterDropdown.tsx's column buttons only wire onClick (no onFocus), so
//   focus alone does not switch panes anymore; adapted to a click-based test instead ('clicking a
//   different column in the left pane switches the right pane'), which is the real remaining
//   behavior.
// - 'ArrowDown/ArrowUp move between checklist rows in the filter detail pane' — roving nav,
//   deferred.

// BEHAVIORAL SURPRISES (not pruning — real findings):
// - A real bug was found and reproduced while writing these tests: clicking an addable-column
//   button inside an OPEN dropdown (e.g. Sort's "Dept" addable row) immediately closed the
//   dropdown, because every Columns/Sort/Group/Filter dropdown mounts its own document-level
//   capture-phase "click outside" listener, and all 4 share one `openDropdown` signal — a click
//   inside the *open* dropdown's own panel was still "outside" from every *other*, closed
//   dropdown's point of view, so one of those closed dropdowns' `onClose()` fired and reset the
//   shared signal. This was already fixed (by other concurrent work on this branch) by gating
//   `handleDocClick` on `props.isOpen` in Dropdown.tsx — confirmed fixed as of this file's final
//   test run, so no test-side workaround was needed.
// - FilterDropdown.tsx's left column pane has NO search box at all, and is NOT alphabetized by
//   label — both contradict CLAUDE.md's "Dropdown column search and keyboard navigation" section,
//   which documents the Filter dropdown's left pane as gaining the same search-narrows-the-list
//   and alphabetical-by-label treatment as Sort/Group's addable lists. In the actual component,
//   the only `.dt-dd-search` input anywhere in FilterDropdown.tsx is the per-column *value*
//   checklist search in the right-hand detail pane (an unrelated, pre-existing feature); there is
//   no signal/memo filtering `filterableCols` by a search term, and `filterableCols` is left in
//   plain column-definition order. The original 'the filter dropdown search box narrows the left
//   column pane, alphabetized' test was therefore replaced with a plain "lists every filterable
//   column" test instead of being adapted, since the search-narrowing behavior it exercised does
//   not exist in the new implementation at all. Flagged as a likely real gap versus the
//   documented design, not silently normalized away.
