import type { ColumnDef } from '@vates/data-table-vanilla'

export interface HugeRow {
  id: number
  name: string
  category: string
  status: string
  region: string
  price: number
  joined: string
}

const CATEGORIES = Array.from({ length: 20 }, (_, i) => `Category ${i + 1}`)
const STATUSES = ['Active', 'Inactive', 'Pending', 'Archived', 'Draft']
const REGIONS = ['EMEA', 'AMER', 'APAC']

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
    rows.push({
      id: i + 1,
      name: `Item ${String(i + 1).padStart(6, '0')} ${rand().toString(36).slice(2, 8)}`,
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      status: STATUSES[Math.floor(rand() * STATUSES.length)],
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      price: Math.round(rand() * 100000) / 100,
      joined: new Date(start + rand() * (end - start)).toISOString().slice(0, 10),
    })
  }
  return rows
}

export const HUGE_DATA: HugeRow[] = makeHugeData(HUGE_ROW_COUNT)

export const HUGE_COLUMNS: ColumnDef<HugeRow>[] = [
  { key: 'id', label: 'ID', type: 'number' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category', filterable: true, groupable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'region', label: 'Region', filterable: true },
  { key: 'price', label: 'Price', type: 'number', aggregate: 'sum' },
  { key: 'joined', label: 'Joined', type: 'date' },
]
