/**
 * Narrows `cols` by label substring (case-insensitive), then alphabetizes — the shared tail of
 * SortDropdown's and GroupDropdown's own `addableCols` (each additionally filters out columns
 * already active in the sort/group before this runs, which is why that part stays separate).
 */
export function alphabetizedByLabel<T extends { label: string }>(cols: T[], term: string): T[] {
  const t = term.trim().toLowerCase()
  const list = t ? cols.filter((c) => c.label.toLowerCase().includes(t)) : cols
  return list.slice().sort((a, b) => a.label.localeCompare(b.label))
}
