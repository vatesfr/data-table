import { mulberry32 } from '../../../shared/hugeData'

export interface Product {
  sku: string
  name: string
  brand: string
  category: string
  price: number
  cost: number
  stock: number
  rating: number
  reviews: number
  colors: string[]
  added: string
}

// Thumbnail per category: no external images, an emoji on a tinted tile
export const CATEGORIES: Record<string, { emoji: string; tint: string; nouns: string[] }> = {
  Kitchen: {
    emoji: '🍳',
    tint: '#fde4cf',
    nouns: ['Skillet', 'Kettle', 'Knife set', 'Cutting board', 'Teapot', 'Mixing bowls'],
  },
  Audio: {
    emoji: '🎧',
    tint: '#dbe4ff',
    nouns: ['Headphones', 'Earbuds', 'Speaker', 'Turntable', 'Soundbar', 'Radio'],
  },
  Outdoor: {
    emoji: '⛺',
    tint: '#d3f0dc',
    nouns: ['Tent', 'Backpack', 'Sleeping bag', 'Headlamp', 'Camp stove', 'Hammock'],
  },
  Home: {
    emoji: '🛋️',
    tint: '#f3e1f5',
    nouns: ['Throw blanket', 'Floor lamp', 'Cushion', 'Vase', 'Rug', 'Wall clock'],
  },
  Fitness: {
    emoji: '🏋️',
    tint: '#ffe0e0',
    nouns: ['Yoga mat', 'Kettlebell', 'Jump rope', 'Foam roller', 'Dumbbells', 'Water bottle'],
  },
  Office: {
    emoji: '📎',
    tint: '#e6eef3',
    nouns: ['Desk lamp', 'Notebook', 'Monitor stand', 'Pen set', 'Desk mat', 'Organizer'],
  },
  Garden: {
    emoji: '🌱',
    tint: '#e5f5c8',
    nouns: ['Planter', 'Watering can', 'Pruners', 'Seed kit', 'Hose reel', 'Bird feeder'],
  },
}

const ADJECTIVES = [
  'Classic',
  'Nordic',
  'Compact',
  'Pro',
  'Everyday',
  'Studio',
  'Trail',
  'Soft',
  'Urban',
  'Coastal',
  'Alpine',
  'Heritage',
]
const BRANDS = ['Lumo', 'Fernwood', 'Kestrel', 'Oaken', 'Pebble & Co', 'Vela', 'Brightside']
export const COLORS: Record<string, string> = {
  Black: '#1f1f1f',
  White: '#f5f5f4',
  Sand: '#d6c3a1',
  Sage: '#9caf88',
  Terracotta: '#c8693f',
  Navy: '#24365c',
  Blush: '#f2b8b5',
}

export const PRODUCT_COUNT = 300

export function makeProducts(): Product[] {
  const rand = mulberry32(11)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const base = new Date('2026-10-30T12:00:00').getTime()
  const categories = Object.keys(CATEGORIES)
  const colorNames = Object.keys(COLORS)
  const used = new Set<string>()
  return Array.from({ length: PRODUCT_COUNT }, (_, i) => {
    const category = pick(categories)
    // Right-skewed: most items are cheap, a few are premium
    const price = Math.round(Math.exp(2 + rand() * 3.4)) - 0.01
    const r = rand()
    const colors = colorNames.filter(() => rand() < 0.25)
    // Every adjective + noun pair of the category; a taken one moves on to the next free pair
    const { nouns } = CATEGORIES[category]
    const pairs = ADJECTIVES.length * nouns.length
    let pair = Math.floor(rand() * pairs)
    const nameAt = (k: number) =>
      `${ADJECTIVES[Math.floor(k / nouns.length)]} ${nouns[k % nouns.length].toLowerCase()}`
    while (used.has(nameAt(pair))) pair = (pair + 1) % pairs
    const name = nameAt(pair)
    used.add(name)
    return {
      sku: `${category.slice(0, 3).toUpperCase()}-${String(1000 + i * 7).padStart(5, '0')}`,
      name,
      brand: pick(BRANDS),
      category,
      price,
      cost: Math.round(price * (0.35 + rand() * 0.45) * 100) / 100,
      stock: r < 0.08 ? 0 : r < 0.22 ? 1 + Math.floor(rand() * 10) : 11 + Math.floor(rand() * 240),
      rating: Math.round((2.5 + rand() * 2.5) * 10) / 10,
      reviews: Math.floor(rand() * 900),
      colors: colors.length ? colors : [pick(colorNames)],
      added: new Date(base - rand() * 540 * 86_400_000).toISOString().slice(0, 10),
    }
  })
}
