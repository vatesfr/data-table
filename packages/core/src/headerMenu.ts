/// <reference lib="dom" />
// DOM-typed like dropdownDomUtils.ts (see its top comment)
import { computeMenuPosition } from './dropdownDomUtils'

// The header ▾ menu's shared logic (see docs/columns.md's "Header menu"); adapters only render it.

export type HeaderMenuItem = 'filter' | 'group' | 'hide'

/** Each item's 16×16 outline icon path, stroked in the text color, and its label key */
export const HEADER_MENU_ITEMS: Record<
  HeaderMenuItem,
  { icon: string; label: 'filter' | 'groupByColumn' | 'hideColumn' }
> = {
  filter: { icon: 'M2 3h12l-4.5 5.5V13l-3-1.5V8.5z', label: 'filter' },
  group: {
    icon: 'M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z',
    label: 'groupByColumn',
  },
  hide: {
    icon: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM2.5 2.5l11 11',
    label: 'hideColumn',
  },
}

/** The items `col`'s menu offers, in order; empty means the header gets no ▾ button */
export function getHeaderMenuItems(
  col: { key: string; filterable?: boolean; groupable?: boolean },
  groupBy: string[],
  visibleColumnCount: number,
): HeaderMenuItem[] {
  const items: HeaderMenuItem[] = []
  if (col.filterable !== false) items.push('filter')
  if (col.groupable === true && !groupBy.includes(col.key)) items.push('group')
  if (visibleColumnCount > 1) items.push('hide')
  return items
}

/** Index ↑/↓ (wrapping), Home or End moves to in a list of `length` items; null for other keys */
export function moveMenuIndex(key: string, index: number, length: number): number | null {
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  if (key === 'ArrowDown') return (index + 1) % length
  if (key === 'ArrowUp') return (index - 1 + length) % length
  return null
}

/**
 * Remembers `trigger`'s position among its header row's ▾ buttons; the returned function, called
 * after an action (Hide, Group by) removed that header, focuses the button now at that position.
 */
export function keepHeaderMenuFocus(trigger: HTMLElement): () => void {
  const row = trigger.closest('tr')
  const buttons = () => Array.from(row?.querySelectorAll<HTMLElement>('[data-col-menu]') ?? [])
  const index = buttons().indexOf(trigger)
  return () => {
    if (trigger.isConnected) return
    const next = buttons()
    next[Math.min(index, next.length - 1)]?.focus()
  }
}

/**
 * Calls `close` on a mousedown outside the `inside` elements or on any scroll outside them (a
 * fixed menu doesn't follow its header); returns the function removing those listeners.
 */
export function onMenuDismiss(
  inside: () => (Element | null | undefined)[],
  close: () => void,
): () => void {
  const outside = (e: Event) => {
    if (!inside().some((el) => el?.contains(e.target as Node))) close()
  }
  document.addEventListener('mousedown', outside)
  window.addEventListener('scroll', outside, true)
  return () => {
    document.removeEventListener('mousedown', outside)
    window.removeEventListener('scroll', outside, true)
  }
}

/** `menu`'s fixed `left`/`top` under `trigger`, kept inside the viewport */
export function placeMenu(trigger: Element, menu: Element): { left: number; top: number } {
  const rect = menu.getBoundingClientRect()
  return computeMenuPosition(
    trigger.getBoundingClientRect(),
    { width: rect.width, height: rect.height },
    window.innerWidth,
    window.innerHeight,
  )
}
