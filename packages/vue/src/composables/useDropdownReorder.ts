import { ref } from 'vue'
import { resolveDropRow } from '@vates/data-table-core/internal'

/**
 * Resolves the drop target for the Sort/Group/Columns dropdown drag-and-drop lists: the specific
 * row under the cursor, and whether the dragged item should land before or after it — a thin
 * adapter over core's `resolveDropRow` (see its own doc comment for the actual hit-test behavior,
 * including the dead-zone rejection). `e` is expected to be handled at the Dropdown panel level
 * (`e.currentTarget` is the panel, not a row), so it can see every row via `attr`, a `data-*`
 * attribute unique to that list's rows.
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
 * Drag state + handlers for one dropdown panel's reorderable list (Columns/Sort/Group active
 * rows) — the same trio of refs (`dragKey`/`dragOverKey`/`dragOverAfter`) and near-identical
 * `onDragOver`/`onDrop` pair built on `resolveDropdownDragRow` used to be hand-copied once per
 * dropdown. `attr` is the `data-*` attribute unique to that list's rows (e.g. `data-sort-key`);
 * `move` is the core reorder action to call on drop (`moveColumn`/`moveSort`/`moveGroup`).
 *
 * `onDragOver`/`onDrop` are meant for the dropdown panel itself (bound via the Dropdown's
 * forwarded `$attrs`) so a drop past the last row still resolves to a valid target;
 * `onRowDragStart`/`onRowDragEnd` go on each individual row's own `draggable` element.
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

  return { dragKey, dragOverKey, dragOverAfter, onRowDragStart, onRowDragEnd, onDragOver, onDrop }
}
