import { createSignal } from 'solid-js'
import { resolveDropRow } from '@vates/data-table-core/internal'

// Shared drag-and-drop row resolution for the Sort/Group/Columns dropdown lists (see CLAUDE.md's
// "Drag-and-drop reordering inside the Sort/Group/Columns dropdown lists") lives in core's
// `resolveDropRow` (`@vates/data-table-core/dropdownDomUtils`) now — see its own doc comment for
// the hit-test behavior, including the dead-zone rejection (a row not directly under the cursor,
// and outside the first/last row's own edge, rejects the drop instead of guessing).

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

  function rowRects(): { key: string; rect: DOMRect }[] {
    if (!rowsContainer) return []
    return [...rowsContainer.querySelectorAll<HTMLElement>(`[${attr}]`)].map((el) => ({
      key: el.getAttribute(attr)!,
      rect: el.getBoundingClientRect(),
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
      const from = dragKey()
      if (!from) return
      // Skip highlighting/preventDefault when the resolved target is the dragged row itself —
      // matches React/Vue's own onDragOver guard.
      const hit = resolveDropRow(e.clientY, rowRects())
      if (!hit || hit.key === from) return
      e.preventDefault()
      setDragOverKey(hit.key)
      setDragOverAfter(hit.after)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const from = dragKey()
      const hit = resolveDropRow(e.clientY, rowRects())
      if (from && hit && hit.key !== from) move(from, hit.key, hit.after)
      setDragKey(null)
      setDragOverKey(null)
    },
  }
}
