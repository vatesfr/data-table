import { test } from 'vitest'
import {
  filterData,
  sortData,
  searchData,
  buildSearchIndex,
  groupData,
  getVisibleRows,
  computeStringValues,
  computeStringValueCounts,
  computeDateTree,
  paginateVisibleGroups,
} from '../logic'
import { makeDataset, benchColumns, type BenchRow } from './bench-utils'

const SIZES = [10_000, 100_000, 500_000]
// A whole `bench.compare` group runs inside one test: at 500k rows it outlasts Vitest's default timeout.
const TIMEOUT = 300_000

for (const n of SIZES) {
  const data = makeDataset(n)
  const opts = { iterations: n >= 500_000 ? 5 : 20 }

  // A checked-by-default, exclude-only checklist's own "select all" narrows by populating
  // `excludeFilters` with most/all of a high-cardinality column's distinct values in one action
  // (see docs/filter-dropdown.md's "Filter dropdown") — `name` is effectively unique per row here, so a
  // 2,000-value Set exercises the same shape a large real dataset's checklist would produce.
  // Guards against the O(rows × set size) regression found profiling the huge-dataset demo:
  // `filterData`'s include/exclude passes used to spread the filter Set to an array and call
  // `.includes()` per row instead of an O(1) `Set.has`, so this used to scale with set size.
  const largeNameSet = new Set(data.slice(0, Math.min(2000, n)).map((r) => r.name))

  test(
    `filterData / sortData @ ${n.toLocaleString()} rows`,
    async ({ bench }) => {
      await bench.compare(
        bench('no filters, no sort (copy only)', () => {
          filterData(data, {}, {}, benchColumns)
        }),
        bench('sort by string column', () => {
          sortData(data, [{ key: 'name', dir: 'asc' }], benchColumns)
        }),
        bench('sort by number column', () => {
          sortData(data, [{ key: 'price', dir: 'asc' }], benchColumns)
        }),
        bench('sort by date column', () => {
          sortData(data, [{ key: 'createdAt', dir: 'asc' }], benchColumns)
        }),
        bench('one active filter + sort', () => {
          sortData(
            filterData(data, { status: new Set(['active']) }, {}, benchColumns),
            [{ key: 'price', dir: 'desc' }],
            benchColumns,
          )
        }),
        bench('range filter on price', () => {
          filterData(data, {}, { price: { min: '100', max: '5000' } }, benchColumns)
        }),
        bench('large exclude set (2,000 values) on a high-cardinality column', () => {
          filterData(data, {}, {}, benchColumns, undefined, { name: largeNameSet })
        }),
        bench('large include set (2,000 values) on a high-cardinality column', () => {
          filterData(data, { name: largeNameSet }, {}, benchColumns)
        }),
        opts,
      )
    },
    TIMEOUT,
  )

  const searchIndex = buildSearchIndex(data, benchColumns)

  test(
    `search @ ${n.toLocaleString()} rows`,
    async ({ bench }) => {
      await bench.compare(
        bench('buildSearchIndex (first keystroke)', () => {
          buildSearchIndex(data, benchColumns)
        }),
        bench('searchData across all columns (each keystroke)', () => {
          searchData(data, 'category 7', searchIndex)
        }),
        opts,
      )
    },
    TIMEOUT,
  )

  const grouped = groupData(data, ['category'], benchColumns)
  const visibleItems = getVisibleRows(grouped, new Set(), false)

  test(
    `grouping @ ${n.toLocaleString()} rows`,
    async ({ bench }) => {
      await bench.compare(
        bench('groupData by category', () => {
          groupData(data, ['category'], benchColumns)
        }),
        bench('getVisibleRows (all expanded)', () => {
          getVisibleRows(grouped, new Set(), false)
        }),
        bench('paginateVisibleGroups (page 1, size 100)', () => {
          paginateVisibleGroups(grouped, visibleItems, new Set(), false, 1, 100)
        }),
        opts,
      )
    },
    TIMEOUT,
  )

  const category = benchColumns.find((c) => c.key === 'category')!
  test(
    `filter facets @ ${n.toLocaleString()} rows`,
    async ({ bench }) => {
      await bench.compare(
        bench('computeStringValues (all filterable columns)', () => {
          for (const col of benchColumns)
            if (col.type !== 'number' && col.filterable !== false) computeStringValues(data, col)
        }),
        bench('computeStringValueCounts, no active filters', () => {
          computeStringValueCounts(data, category, {}, {}, benchColumns)
        }),
        bench('computeStringValueCounts, 2 active filters', () => {
          computeStringValueCounts(
            data,
            category,
            { status: new Set(['active']), region: new Set(['EMEA']) },
            {},
            benchColumns,
          )
        }),
        opts,
      )
    },
    TIMEOUT,
  )

  const dateValues = [...new Set(data.map((r) => r.createdAt))]
  test(
    `date tree @ ${n.toLocaleString()} rows (${dateValues.length.toLocaleString()} unique dates)`,
    async ({ bench }) => {
      await bench('computeDateTree', () => {
        computeDateTree(dateValues)
      }).run(opts)
    },
    TIMEOUT,
  )
}

// keep TS happy about the unused type import when isolatedModules elides it
export type { BenchRow }
