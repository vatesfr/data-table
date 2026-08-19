export interface BadgeColorEntry {
  bg: string
  color: string
}

/**
 * Builds a small colored pill as a plain DOM node. `ColumnDef<TRow>.render` (this package's own
 * type, unlike React's render prop) is typed `(value, row) => Node` — a real DOM node, not JSX —
 * so this is written the same way `packages/solid`'s own tests build one (see
 * `TableBody.test.tsx`'s "respects a custom col.render" case) rather than as a JSX component.
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
