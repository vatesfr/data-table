import { createSignal } from 'solid-js'

// Shared drag-and-drop row resolution for the Sort/Group/Columns dropdown lists (see CLAUDE.md's
// "Drag-and-drop reordering inside the Sort/Group/Columns dropdown lists"). Given a dragover/drop
// event and the list of candidate rows, returns which row is targeted and whether the drop should
// land before or after it (resolved from the cursor's position within the row's own bounds, so
// the *last* row in a list can become an "insert after" target too — a plain closest-row-only
// design could only ever mean "insert before"). When the cursor isn't over any row at all (dead
// space below the last row), it snaps to the nearest edge row instead of returning null — the
// caller must still call preventDefault() in that case, or the browser treats an uncommitted
// dragover as an invalid drop target and silently swallows the eventual drop.
export function resolveDropRow(
  clientY: number,
  rows: { key: string; el: HTMLElement }[],
): { key: string; after: boolean } | null {
  if (rows.length === 0) return null
  for (const { key, el } of rows) {
    const rect = el.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return { key, after: clientY > rect.top + rect.height / 2 }
    }
  }
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (clientY < first.el.getBoundingClientRect().top) return { key: first.key, after: false }
  return { key: last.key, after: true }
}

/**
 * Drag state + handlers for one dropdown panel's reorderable list (Columns/Sort/Group rows) —
 * the same `rowsContainer` ref + `rowEls()` query + drag signals + `handleDragOver`/`handleDrop`
 * scaffolding built on `resolveDropRow` used to be hand-copied once per dropdown component.
 * `attr` is the `data-*` attribute unique to that list's rows (e.g. `data-sort-key`); `move` is
 * the core reorder action to call on drop (`table.sort.move`/`table.group.move`/
 * `table.columns.move`).
 *
 * `setContainer` is meant for the list's own wrapping element's `ref` (`onDragOver`/`onDrop` go
 * there too, so a drop past the last row still resolves to a valid target); `onRowDragStart`/
 * `onRowDragEnd` go on each individual row's own `draggable` element.
 */
export function createDragReorder(
  attr: string,
  move: (from: string, to: string, after: boolean) => void,
) {
  const [dragKey, setDragKey] = createSignal<string | null>(null)
  const [dragOverKey, setDragOverKey] = createSignal<string | null>(null)
  const [dragOverAfter, setDragOverAfter] = createSignal(false)
  let rowsContainer: HTMLDivElement | undefined

  function rowEls(): { key: string; el: HTMLElement }[] {
    if (!rowsContainer) return []
    return [...rowsContainer.querySelectorAll<HTMLElement>(`[${attr}]`)].map((el) => ({
      key: el.getAttribute(attr)!,
      el,
    }))
  }

  return {
    dragKey,
    dragOverKey,
    dragOverAfter,
    setContainer: (el: HTMLDivElement) => {
      rowsContainer = el
    },
    onRowDragStart: (key: string) => setDragKey(key),
    onRowDragEnd: () => {
      setDragKey(null)
      setDragOverKey(null)
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      const hit = resolveDropRow(e.clientY, rowEls())
      if (hit) {
        setDragOverKey(hit.key)
        setDragOverAfter(hit.after)
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const from = dragKey()
      const hit = resolveDropRow(e.clientY, rowEls())
      if (from && hit && hit.key !== from) move(from, hit.key, hit.after)
      setDragKey(null)
      setDragOverKey(null)
    },
  }
}
