import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
import { render } from 'solid-js/web'
import { createTableState } from '../createTableState'
import { ActiveBar } from '../components/ActiveBar'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  dept: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name', filterable: true },
  { key: 'dept', label: 'Dept', filterable: true, groupable: true },
  { key: 'score', label: 'Score', filterable: true, type: 'number' },
]
const ROWS: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', score: 90 },
  { id: 2, name: 'Bob', dept: 'HR', score: 60 },
]

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let table!: ReturnType<typeof createTableState<Row>>
  const dispose = createRoot((d) => {
    table = createTableState(ROWS, COLS)
    render(
      () => (
        <ActiveBar
          table={table}
          columns={COLS}
          groupableCols={COLS.filter((c) => c.groupable)}
          totalRows={ROWS.length}
          onOpenGroup={() => {}}
          onOpenFilter={() => {}}
        />
      ),
      container,
    )
    return d
  })
  return { container, table, dispose }
}

// Every ".dt-chip-x" removes something, and (until now) none of them had an accessible name
// beyond the literal "×" glyph — see CLAUDE.md's dropdown-alignment notes. These tests cover each
// chip kind's own remove button, plus the merged grouped-sort chip's "⊞" open-Group-dropdown mark.
describe('ActiveBar — chip button labels', () => {
  it('a plain sort chip’s remove button uses removeSort', () => {
    const { container, table, dispose } = mount()
    table.sort.toggle('score')
    const btn = container.querySelector<HTMLButtonElement>('.dt-chip .dt-chip-x')!
    expect(btn.title).toBe(table.labels().removeSort)
    expect(btn.getAttribute('aria-label')).toBe(table.labels().removeSort)
    dispose()
  })

  it('a plain group chip’s remove button uses removeGroup', () => {
    const { container, table, dispose } = mount()
    // group.toggle auto-inserts a matching sort entry (insertGroupSort) — remove it so this
    // renders the plain (non-merged) group chip, not the merged grouped-sort one.
    table.group.toggle('dept')
    table.sort.remove('dept')
    const btn = container.querySelector<HTMLButtonElement>('.dt-chip .dt-chip-x')!
    expect(btn.title).toBe(table.labels().removeGroup)
    expect(btn.getAttribute('aria-label')).toBe(table.labels().removeGroup)
    dispose()
  })

  it('the merged grouped-sort chip labels its sort ×, its ⊕ open-Group mark, and its group × distinctly', () => {
    const { container, table, dispose } = mount()
    table.group.toggle('dept') // auto-inserts a matching sort entry (see insertGroupSort)
    const chip = container.querySelector('.dt-chip--grouped-sort')!
    const [removeSortBtn, groupMark, removeGroupBtn] = [
      ...chip.querySelectorAll<HTMLButtonElement>('.dt-chip-x, .dt-chip-group-mark'),
    ]
    expect(removeSortBtn.title).toBe(table.labels().removeSort)
    expect(groupMark.title).toBe(table.labels().openGroupDropdown)
    expect(groupMark.getAttribute('aria-label')).toBe(table.labels().openGroupDropdown)
    expect(removeGroupBtn.title).toBe(table.labels().removeGroup)
    dispose()
  })

  it('include/exclude/range filter chips all reuse clearColumnFilter for their remove button', () => {
    const { container, table, dispose } = mount()
    table.filter.cycleValue('dept', 'Eng') // include
    table.filter.cycleValue('name', 'Bob') // include then exclude below
    table.filter.cycleValue('name', 'Bob')
    table.filter.setRange('score', 'min', '10')
    table.filter.setRange('score', 'max', '100')
    const buttons = [
      ...container.querySelectorAll<HTMLButtonElement>('.dt-chip--filter .dt-chip-x'),
    ]
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    for (const btn of buttons) {
      expect(btn.title).toBe(table.labels().clearColumnFilter)
      expect(btn.getAttribute('aria-label')).toBe(table.labels().clearColumnFilter)
    }
    dispose()
  })
})
