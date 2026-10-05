import { test } from 'vitest'
import {
  processData,
  searchData,
  groupData,
  getVisibleRows,
  computeStringValues,
  computeStringValueCounts,
  computeDateTree,
  paginateVisibleGroups,
} from '../logic'
import { makeDataset, benchColumns, type BenchRow } from './bench-utils'

const SIZES = [10_000, 100_000, 500_000]

for (const n of SIZES) {
  const data = makeDataset(n)
  const opts = { iterations: n >= 500_000 ? 5 : 20 }

  // A checked-by-default, exclude-only checklist's own "select all" narrows by populating
  // `excludeFilters` with most/all of a high-cardinality column's distinct values in one action
  // (see docs/filter-dropdown.md's "Filter dropdown") — `name` is effectively unique per row here, so a
  // 2,000-value Set exercises the same shape a large real dataset's checklist would produce.
  // Guards against the O(rows × set size) regression found profiling the huge-dataset demo:
  // `processData`'s include/exclude passes used to spread the filter Set to an array and call
  // `.includes()` per row instead of an O(1) `Set.has`, so this used to scale with set size.
  const largeNameSet = new Set(data.slice(0, Math.min(2000, n)).map((r) => r.name))

  test(`processData @ ${n.toLocaleString()} rows`, async ({ bench }) => {
    await bench.compare(
      bench('no filters, no sort (copy only)', () => {
        processData(data, {}, {}, [], benchColumns)
      }),
      bench('sort by string column', () => {
        processData(data, {}, {}, [{ key: 'name', dir: 'asc' }], benchColumns)
      }),
      bench('sort by number column', () => {
        processData(data, {}, {}, [{ key: 'price', dir: 'asc' }], benchColumns)
      }),
      bench('sort by date column', () => {
        processData(data, {}, {}, [{ key: 'createdAt', dir: 'asc' }], benchColumns)
      }),
      bench('one active filter + sort', () => {
        processData(
          data,
          { status: new Set(['active']) },
          {},
          [{ key: 'price', dir: 'desc' }],
          benchColumns,
        )
      }),
      bench('range filter on price', () => {
        processData(data, {}, { price: { min: '100', max: '5000' } }, [], benchColumns)
      }),
      bench('large exclude set (2,000 values) on a high-cardinality column', () => {
        processData(data, {}, {}, [], benchColumns, undefined, { name: largeNameSet })
      }),
      bench('large include set (2,000 values) on a high-cardinality column', () => {
        processData(data, { name: largeNameSet }, {}, [], benchColumns)
      }),
      opts,
    )
  })

  test(`searchData @ ${n.toLocaleString()} rows`, async ({ bench }) => {
    await bench('global search across all columns', () => {
      searchData(data, 'category 7', benchColumns)
    }).run(opts)
  })

  const grouped = groupData(data, ['category'], benchColumns)
  const visibleItems = getVisibleRows(grouped, new Set(), false)

  test(`grouping @ ${n.toLocaleString()} rows`, async ({ bench }) => {
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
  })

  test(`filter facets @ ${n.toLocaleString()} rows`, async ({ bench }) => {
    await bench.compare(
      bench('computeStringValues (all filterable columns)', () => {
        computeStringValues(data, benchColumns)
      }),
      bench('computeStringValueCounts, no active filters (all filterable columns)', () => {
        computeStringValueCounts(data, {}, {}, benchColumns)
      }),
      bench('computeStringValueCounts, 2 active filters (all filterable columns)', () => {
        computeStringValueCounts(
          data,
          { status: new Set(['active']), region: new Set(['EMEA']) },
          {},
          benchColumns,
        )
      }),
      bench('computeStringValueCounts, single column only (proposed target shape)', () => {
        computeStringValueCounts(data, {}, {}, [
          benchColumns.find((c) => c.key === 'category')!,
        ] as typeof benchColumns)
      }),
      opts,
    )
  })

  const dateValues = [...new Set(data.map((r) => r.createdAt))]
  test(`date tree @ ${n.toLocaleString()} rows (${dateValues.length.toLocaleString()} unique dates)`, async ({
    bench,
  }) => {
    await bench('computeDateTree', () => {
      computeDateTree(dateValues)
    }).run(opts)
  })
}

// keep TS happy about the unused type import when isolatedModules elides it
export type { BenchRow }
