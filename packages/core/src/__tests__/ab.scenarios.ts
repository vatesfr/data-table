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
  // A keystroke reuses the index built on the first one
  const searchIndex = L.buildSearchIndex?.(data, columns)
  // A select-all on a high-cardinality checklist: guards filterData's O(1) `Set.has` per row value
  const largeNameSet = new Set(data.slice(0, 2000).map((r) => r.name))
  const grouped = L.groupData?.(data, ['category'], columns)
  const visibleItems = grouped && L.getVisibleRows?.(grouped, new Set(), false)
  const category = columns.find((c) => c.key === 'category')!
  return [
    { name: 'sort string column', run: () => L.sortData(data, sortBy('name'), columns) },
    { name: 'sort number column', run: () => L.sortData(data, sortBy('price'), columns) },
    { name: 'sort date column', run: () => L.sortData(data, sortBy('createdAt'), columns) },
    {
      name: 'range filter',
      run: () => L.filterData(data, {}, { price: { min: '100', max: '5000' } }, columns),
    },
    {
      name: 'include filter, 2,000 values',
      run: () => L.filterData(data, { name: largeNameSet }, {}, columns),
    },
    {
      name: 'exclude filter, 2,000 values',
      run: () => L.filterData(data, {}, {}, columns, undefined, { name: largeNameSet }),
    },
    { name: 'search', run: () => L.searchData(data, 'category 7', searchIndex) },
    // A query typed further: matches a few dozen rows, the common case while narrowing down
    { name: 'search, narrow query', run: () => L.searchData(data, 'zz9', searchIndex) },
    {
      name: 'grouped search keystroke',
      run: () =>
        L.sortWithinGroups(
          L.groupData(L.searchData(sortedForGroups, 'a', searchIndex), ['category'], columns),
          groupSorts,
          ['category'],
          columns,
        ),
    },
    { name: 'search index (first keystroke)', run: () => L.buildSearchIndex(data, columns) },
    {
      name: 'paginate groups (page 1, size 100)',
      run: () => L.paginateVisibleGroups(grouped, visibleItems, new Set(), false, 1, 100),
    },
    // Filter value lists: one column's, computed as its filter pane opens
    { name: 'filter values, one column', run: () => L.computeStringValues(data, category) },
    {
      name: 'value counts, 2 active filters',
      run: () =>
        L.computeStringValueCounts(
          data,
          category,
          { status: new Set(['active']), region: new Set(['EMEA']) },
          {},
          columns,
        ),
    },
  ]
}
