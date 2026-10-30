// Scenarios for `scripts/bench-ab.mjs`, which runs each one against two copies of `logic.ts`
// (a git ref and the working tree) in one process. Both sides run the same closures, so keep
// each timed `run` a single pass through `L` to penalize both sides' shared JIT feedback equally.
// No runtime imports: Node's type stripping doesn't resolve extensionless relative imports.
import type * as Logic from '../logic'
import type { ColumnDefBase, SortEntry } from '../types'
import type { BenchRow } from './bench-utils'

export interface Scenario {
  name: string
  run: () => unknown
}

export function scenarios(
  L: typeof Logic,
  data: BenchRow[],
  columns: ColumnDefBase<BenchRow>[],
): Scenario[] {
  const sortBy = (key: string): SortEntry[] => [{ key, dir: 'asc' }]
  const groupSorts: SortEntry[] = [
    { key: 'category', dir: 'asc' },
    { key: 'price', dir: 'asc' },
  ]
  // Grouped search keystroke, as adapters run it: rows were sorted once, before the keystroke
  const sortedForGroups = L.sortData?.(data, groupSorts, columns)
  return [
    { name: 'sort string column', run: () => L.sortData(data, sortBy('name'), columns) },
    { name: 'sort number column', run: () => L.sortData(data, sortBy('price'), columns) },
    { name: 'sort date column', run: () => L.sortData(data, sortBy('createdAt'), columns) },
    { name: 'search', run: () => L.searchData(data, 'category 7', columns) },
    {
      name: 'grouped search keystroke',
      run: () =>
        L.sortWithinGroups(
          L.groupData(L.searchData(sortedForGroups, 'a', columns), ['category'], columns),
          groupSorts,
          ['category'],
          columns,
        ),
    },
    // Filter value lists: built at mount, then read one column at a time as filter panes open
    { name: 'filter values at mount', run: () => L.computeStringValues(data, columns) },
    {
      name: 'filter values, every column read',
      run: () => {
        const map = L.computeStringValues(data, columns)
        for (const key in map) void map[key].length
        return map
      },
    },
  ]
}
