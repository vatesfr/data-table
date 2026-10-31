import { logRangeGroup, type ColumnDef } from '@vates/data-table-react'
import type { HugeRow } from '../../shared/hugeData'

export const HUGE_COLUMNS: ColumnDef<HugeRow>[] = [
  { key: 'id', label: 'Order ID', type: 'number' },
  { key: 'customer', label: 'Customer', filterable: true },
  { key: 'category', label: 'Category', filterable: true, groupable: true },
  { key: 'region', label: 'Region', filterable: true, groupable: true },
  { key: 'status', label: 'Status', filterable: true },
  {
    key: 'amount',
    label: 'Amount',
    type: 'number',
    aggregate: 'sum',
    format: (v) => `$${Number(v).toFixed(2)}`,
    // logRangeGroup: bucketing 100k rows on a log scale performs the same as bucketNumericRange
    // (both are O(1) per row) — a good spot to exercise it at scale (issue #18).
    groupable: true,
    // header shows only the log-scale bucket, not the exact amount — keep the column
    // visible when grouped so the real value stays visible on each row.
    keepVisibleWhenGrouped: true,
    ...logRangeGroup({ divisions: [1, 3] }, '$'),
  },
  { key: 'orderDate', label: 'Order Date', type: 'date' },
]
