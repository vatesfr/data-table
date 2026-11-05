import { CATEGORIES, COLORS, type Product } from './data'

// Cell and card pieces shared by the table, the cards and the detail panel

const DATE_FORMAT = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export const price = (v: unknown) => `${Number(v).toFixed(2)} €`
export const formatDate = (iso: unknown) => DATE_FORMAT.format(new Date(`${String(iso)}T00:00`))
export const marginOf = (p: Product) => Math.round(((p.price - p.cost) / p.price) * 100)

export function thumb(p: Product, size: 'sm' | 'lg' = 'sm') {
  const c = CATEGORIES[p.category]
  return (
    <span class={`thumb thumb--${size}`} style={{ background: c.tint }} aria-hidden="true">
      {c.emoji}
    </span>
  )
}

export function stockPill(stock: number) {
  const [level, text] =
    stock === 0
      ? ['out', 'Out of stock']
      : stock <= 10
        ? ['low', `Low · ${stock}`]
        : ['ok', `${stock} in stock`]
  return <span class={`pill pill--${level}`}>{text}</span>
}

export function stars(rating: number) {
  return (
    <span class="stars" title={`${rating} out of 5`}>
      <span class="stars-track" aria-hidden="true">
        ★★★★★
        <span class="stars-fill" style={{ width: `${(rating / 5) * 100}%` }}>
          ★★★★★
        </span>
      </span>
      <span class="stars-value">{rating.toFixed(1)}</span>
    </span>
  )
}

export function colorDot(name: string) {
  return <span class="dot" style={{ background: COLORS[name] }} title={name} />
}

export function colorLabel(name: string) {
  return (
    <span class="dot-label">
      {colorDot(name)} {name}
    </span>
  )
}
