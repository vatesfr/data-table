import { useState, type DragEvent } from 'react'
import { resolveDropRow } from '@vates/data-table-core/internal'

/**
 * Core's `resolveDropRow` over a dropdown panel's rows marked with `attr` (e.g. `data-sort-key`),
 * hit-tested by the event target first.
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
 * Drag state and handlers for one dropdown's reorderable list: `onDragOver`/`onDrop` go on the
 * panel (so a drop past the last row resolves), the row handlers on each draggable row; `move` is
 * the core reorder action.
 */
export function useDropdownReorder(
  attr: string,
  move: (from: string, to: string, after: boolean) => void,
) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [dragOverAfter, setDragOverAfter] = useState(false)

  return {
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
