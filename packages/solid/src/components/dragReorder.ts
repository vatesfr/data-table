import { createSignal } from 'solid-js'
import { resolveDropRow } from '@vates/data-table-core/internal'

/**
 * Drag state and handlers for one dropdown's reorderable list: `onDragOver`/`onDrop` go on the
 * list's wrapper (so a drop past the last row resolves), the row handlers on each draggable row;
 * `move` is the reorder action.
 */
export function createDragReorder(
  attr: string,
  move: (from: string, to: string, after: boolean) => void,
) {
  const [dragKey, setDragKey] = createSignal<string | null>(null)
  const [dragOverKey, setDragOverKey] = createSignal<string | null>(null)
  const [dragOverAfter, setDragOverAfter] = createSignal(false)
  function rowRects(e: DragEvent): { key: string; rect: DOMRect }[] {
    return [...(e.currentTarget as Element).querySelectorAll<HTMLElement>(`[${attr}]`)].map(
      (el) => ({
        key: el.getAttribute(attr)!,
        rect: el.getBoundingClientRect(),
      }),
    )
  }

  return {
    dragKey,
    dragOverKey,
    dragOverAfter,
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
      const hit = resolveDropRow(e.clientY, rowRects(e))
      if (!hit || hit.key === from) return
      e.preventDefault()
      setDragOverKey(hit.key)
      setDragOverAfter(hit.after)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const from = dragKey()
      const hit = resolveDropRow(e.clientY, rowRects(e))
      if (from && hit && hit.key !== from) move(from, hit.key, hit.after)
      setDragKey(null)
      setDragOverKey(null)
    },
  }
}
