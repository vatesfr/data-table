import { ref } from 'vue'
import { resolveDropRow } from '@vates/data-table-core/internal'

/**
 * Core's `resolveDropRow` over the rows marked with `attr` in the panel handling `e`, hit-tested by
 * the event target first.
 */
export function resolveDropdownDragRow(
  e: DragEvent,
  attr: string,
): { key: string; after: boolean } | null {
  const root = e.currentTarget as HTMLElement
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
  const dragKey = ref<string | null>(null)
  const dragOverKey = ref<string | null>(null)
  const dragOverAfter = ref(false)

  function onRowDragStart(key: string): void {
    dragKey.value = key
  }
  function onRowDragEnd(): void {
    dragKey.value = null
    dragOverKey.value = null
  }
  function onDragOver(e: DragEvent): void {
    if (!dragKey.value) return
    const target = resolveDropdownDragRow(e, attr)
    if (!target || target.key === dragKey.value) return
    e.preventDefault()
    dragOverKey.value = target.key
    dragOverAfter.value = target.after
  }
  function onDrop(e: DragEvent): void {
    if (!dragKey.value) return
    const target = resolveDropdownDragRow(e, attr)
    if (!target) return
    e.preventDefault()
    if (target.key !== dragKey.value) move(dragKey.value, target.key, target.after)
    dragKey.value = null
    dragOverKey.value = null
  }

  return { dragOverKey, dragOverAfter, onRowDragStart, onRowDragEnd, onDragOver, onDrop }
}
