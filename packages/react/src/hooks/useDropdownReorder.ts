import { useState, type DragEvent } from 'react'
import { resolveDropRow } from '@vates/data-table-core/internal'

/**
 * Resolves a drag-and-drop reorder gesture inside a dropdown panel's list (Columns/Sort/Group) to
 * a specific row under the cursor, and whether the dragged item should land before or after it —
 * a thin adapter over core's `resolveDropRow` (see its own doc comment for the actual hit-test
 * behavior, including the dead-zone rejection). `root` is the dropdown panel (`e.currentTarget`
 * from a handler bound there, not per-row) so it can see every row via `attr`, a `data-*` attribute
 * unique to that list's rows (e.g. `data-sort-key`).
 */
export function resolveDropdownDragRow(
  root: HTMLElement,
  e: DragEvent<HTMLElement>,
  attr: string,
): { key: string; after: boolean } | null {
  const selector = `[${attr}]`
  const rows = Array.from(root.querySelectorAll<HTMLElement>(selector)).map((el) => ({
    key: el.getAttribute(attr)!,
    rect: el.getBoundingClientRect(),
  }))
  const hit = (e.target as HTMLElement).closest<HTMLElement>(selector)
  return resolveDropRow(e.clientY, rows, hit?.getAttribute(attr))
}

/**
 * Drag state + handlers for one dropdown panel's reorderable list (Columns/Sort/Group active
 * rows) — the same trio of state (`dragKey`/`dragOverKey`/`dragOverAfter`) and near-identical
 * `onDragOver`/`onDrop` pair built on `resolveDropdownDragRow` used to be hand-copied once per
 * dropdown. `attr` is the `data-*` attribute unique to that list's rows (e.g. `data-sort-key`);
 * `move` is the core reorder action to call on drop (`moveColumn`/`moveSort`/`moveGroup`).
 *
 * `onDragOver`/`onDrop` are meant for the dropdown panel itself (`Dropdown`'s own `onDragOver`/
 * `onDrop` props) so a drop past the last row still resolves to a valid target; `onRowDragStart`/
 * `onRowDragEnd` go on each individual row's own `draggable` element.
 */
export function useDropdownReorder(
  attr: string,
  move: (from: string, to: string, after: boolean) => void,
) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [dragOverAfter, setDragOverAfter] = useState(false)

  return {
    dragKey,
    dragOverKey,
    dragOverAfter,
    onRowDragStart: (key: string) => setDragKey(key),
    onRowDragEnd: () => {
      setDragKey(null)
      setDragOverKey(null)
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragKey) return
      const target = resolveDropdownDragRow(e.currentTarget, e, attr)
      if (!target || target.key === dragKey) return
      e.preventDefault()
      setDragOverKey(target.key)
      setDragOverAfter(target.after)
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!dragKey) return
      const target = resolveDropdownDragRow(e.currentTarget, e, attr)
      if (!target) return
      e.preventDefault()
      if (target.key !== dragKey) move(dragKey, target.key, target.after)
      setDragKey(null)
      setDragOverKey(null)
    },
  }
}
