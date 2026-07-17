import type { ColumnDef } from '@vates/data-table-react'

export interface HugeRow {
  id: number
  customer: string
  category: string
  region: string
  status: string
  amount: number
  orderDate: string
}

const FIRST_NAMES = [
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'Lucas',
  'Mia',
  'Oliver',
  'Amelia',
  'Elijah',
  'Charlotte',
  'James',
  'Harper',
  'Benjamin',
  'Evelyn',
  'Henry',
  'Abigail',
  'Alexander',
  'Emily',
  'Sebastian',
  'Elizabeth',
  'Jack',
  'Sofia',
  'Owen',
  'Avery',
  'Daniel',
  'Ella',
  'Matthew',
  'Scarlett',
  'Aiden',
  'Grace',
  'Samuel',
  'Chloe',
  'David',
  'Victoria',
  'Joseph',
]
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
]
const CATEGORIES = [
  'Electronics',
  'Clothing & Accessories',
  'Home & Kitchen',
  'Books',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty & Personal Care',
  'Grocery',
  'Automotive',
  'Office Supplies',
  'Pet Supplies',
  'Health & Wellness',
]
const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East & Africa']
const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned']

/** Deterministic PRNG so the generated dataset is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const HUGE_ROW_COUNT = 200_000

function makeHugeData(n: number): HugeRow[] {
  const rand = mulberry32(42)
  const start = new Date('2015-01-01').getTime()
  const end = new Date('2025-01-01').getTime()
  const rows: HugeRow[] = []
  for (let i = 0; i < n; i++) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]
    rows.push({
      id: 100000 + i,
      customer: `${first} ${last}`,
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      status: STATUSES[Math.floor(rand() * STATUSES.length)],
      amount: Math.round(rand() * 100000) / 100,
      orderDate: new Date(start + rand() * (end - start)).toISOString().slice(0, 10),
    })
  }
  return rows
}

export const HUGE_DATA: HugeRow[] = makeHugeData(HUGE_ROW_COUNT)

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
  },
  { key: 'orderDate', label: 'Order Date', type: 'date' },
]
