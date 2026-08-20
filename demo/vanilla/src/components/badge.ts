export interface BadgeColorEntry {
  bg: string
  color: string
}

/**
 * Builds a small colored pill as a plain DOM node. `ColumnDef<TRow>.render` (this package's own
 * type, re-exported from `@vates/data-table-solid`) is typed `(value, row) => Node` — a real DOM
 * node, not a string — so this is written the same way `demo/solid`'s own `components/Badge.ts`
 * builds one, rather than returning HTML markup for `format` to escape.
 */
export function badge(value: string, colorMap?: Record<string, BadgeColorEntry>): Node {
  const c = colorMap?.[value]
  const span = document.createElement('span')
  span.textContent = value
  Object.assign(span.style, {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    background: c?.bg ?? '#F1EFE8',
    color: c?.color ?? '#444441',
  })
  return span
}

/** A muted "—"/placeholder span, built the same plain-DOM-node way as `badge()`. */
export function muted(text: string): Node {
  const span = document.createElement('span')
  span.textContent = text
  Object.assign(span.style, { fontSize: '12px', color: 'var(--color-text-tertiary)' })
  return span
}
