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
