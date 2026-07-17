import { bench, describe } from 'vitest'
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

  describe(`processData @ ${n.toLocaleString()} rows`, () => {
    bench(
      'no filters, no sort (copy only)',
      () => {
        processData(data, {}, {}, [], benchColumns)
      },
      opts,
    )

    bench(
      'sort by string column',
      () => {
        processData(data, {}, {}, [{ key: 'name', dir: 'asc' }], benchColumns)
      },
      opts,
    )

    bench(
      'sort by number column',
      () => {
        processData(data, {}, {}, [{ key: 'price', dir: 'asc' }], benchColumns)
      },
      opts,
    )

    bench(
      'sort by date column',
      () => {
        processData(data, {}, {}, [{ key: 'createdAt', dir: 'asc' }], benchColumns)
      },
      opts,
    )

    bench(
      'one active filter + sort',
      () => {
        processData(
          data,
          { status: new Set(['active']) },
          {},
          [{ key: 'price', dir: 'desc' }],
          benchColumns,
        )
      },
      opts,
    )

    bench(
      'range filter on price',
      () => {
        processData(data, {}, { price: { min: '100', max: '5000' } }, [], benchColumns)
      },
      opts,
    )
  })

  describe(`searchData @ ${n.toLocaleString()} rows`, () => {
    bench(
      'global search across all columns',
      () => {
        searchData(data, 'category 7', benchColumns)
      },
      opts,
    )
  })

  describe(`grouping @ ${n.toLocaleString()} rows`, () => {
    bench(
      'groupData by category',
      () => {
        groupData(data, ['category'], benchColumns)
      },
      opts,
    )

    const grouped = groupData(data, ['category'], benchColumns)
    bench(
      'getVisibleRows (all expanded)',
      () => {
        getVisibleRows(grouped, new Set(), false)
      },
      opts,
    )

    const visibleItems = getVisibleRows(grouped, new Set(), false)
    bench(
      'paginateVisibleGroups (page 1, size 100)',
      () => {
        paginateVisibleGroups(grouped, visibleItems, new Set(), false, 1, 100)
      },
      opts,
    )
  })

  describe(`filter facets @ ${n.toLocaleString()} rows`, () => {
    bench(
      'computeStringValues (all filterable columns)',
      () => {
        computeStringValues(data, benchColumns)
      },
      opts,
    )

    bench(
      'computeStringValueCounts, no active filters (all filterable columns)',
      () => {
        computeStringValueCounts(data, {}, {}, benchColumns)
      },
      opts,
    )

    bench(
      'computeStringValueCounts, 2 active filters (all filterable columns)',
      () => {
        computeStringValueCounts(
          data,
          { status: new Set(['active']), region: new Set(['EMEA']) },
          {},
          benchColumns,
        )
      },
      opts,
    )

    bench(
      'computeStringValueCounts, single column only (proposed target shape)',
      () => {
        computeStringValueCounts(data, {}, {}, [
          benchColumns.find((c) => c.key === 'category')!,
        ] as typeof benchColumns)
      },
      opts,
    )
  })

  const dateValues = [...new Set(data.map((r) => r.createdAt))]
  describe(`date tree @ ${n.toLocaleString()} rows (${dateValues.length.toLocaleString()} unique dates)`, () => {
    bench(
      'computeDateTree',
      () => {
        computeDateTree(dateValues)
      },
      opts,
    )
  })
}

// keep TS happy about the unused type import when isolatedModules elides it
export type { BenchRow }
