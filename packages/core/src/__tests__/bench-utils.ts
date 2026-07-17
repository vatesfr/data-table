import type { ColumnDefBase } from '../types'

export interface BenchRow {
  id: number
  name: string
  category: string
  status: string
  region: string
  price: number
  createdAt: string
}

const CATEGORIES = Array.from({ length: 20 }, (_, i) => `Category ${i}`)
const STATUSES = ['active', 'inactive', 'pending', 'archived', 'draft']
const REGIONS = ['EMEA', 'AMER', 'APAC']

/** Deterministic pseudo-random generator so bench datasets are stable across runs. */
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

export function makeDataset(n: number): BenchRow[] {
  const rand = mulberry32(42)
  const rows: BenchRow[] = []
  const start = new Date('2015-01-01').getTime()
  const end = new Date('2025-01-01').getTime()
  for (let i = 0; i < n; i++) {
    rows.push({
      id: i,
      name: `Item ${i} ${rand().toString(36).slice(2, 8)}`,
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      status: STATUSES[Math.floor(rand() * STATUSES.length)],
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      price: Math.round(rand() * 100000) / 100,
      createdAt: new Date(start + rand() * (end - start)).toISOString().slice(0, 10),
    })
  }
  return rows
}

export const benchColumns: ColumnDefBase<BenchRow>[] = [
  { key: 'id', label: 'ID', type: 'number' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'region', label: 'Region' },
  { key: 'price', label: 'Price', type: 'number', aggregate: 'sum' },
  { key: 'createdAt', label: 'Created', type: 'date' },
]
