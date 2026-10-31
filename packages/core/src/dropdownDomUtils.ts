// Browser-only; the file-scoped DOM lib keeps "dom" out of the package's `lib` (see docs/pitfalls.md).
/// <reference lib="dom" preserve="true" />

// Non-reactive dropdown geometry and focus helpers shared by every adapter's dropdowns.

/**
 * Resolves a dropdown list drag to the row under the cursor and whether to drop after it (lower
 * half). Snaps to the first/last row past the list's ends; `null` in a gap between rows. `hitKey`,
 * the row containing the event target, wins over the `clientY` scan (see docs/column-reordering.md).
 * `RectLike` rather than `DOMRect`: an ambient DOM type in the exported signature crashed API
 * Extractor ("Unable to follow symbol for DOMRect").
 */
export interface RectLike {
  top: number
  bottom: number
  height: number
}

export function resolveDropRow(
  clientY: number,
  rows: { key: string; rect: RectLike }[],
  hitKey?: string | null,
): { key: string; after: boolean } | null {
  if (rows.length === 0) return null
  const hit =
    hitKey != null
      ? rows.find((r) => r.key === hitKey)
      : rows.find((r) => clientY >= r.rect.top && clientY <= r.rect.bottom)
  if (hit) return { key: hit.key, after: clientY > hit.rect.top + hit.rect.height / 2 }
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (clientY <= first.rect.top) return { key: first.key, after: false }
  if (clientY >= last.rect.bottom) return { key: last.key, after: true }
  return null
}

/**
 * Computes how far a dropdown panel needs to shift horizontally (`dx`, for a `translateX`) to
 * stay within `[margin, viewportWidth - margin]`. A horizontal `translateX` offset is used instead
 * of flipping the anchor side (`left:0` -> `right:0`) since the overflow is relative to the
 * *viewport*, not the trigger — flipping the anchor on a trigger near one edge would just push a
 * wide panel off the opposite side instead.
 */
export function computeDropdownClampOffset(
  rect: { right: number; left: number },
  viewportWidth: number,
  margin = 8,
): number {
  let dx = 0
  if (rect.right > viewportWidth - margin) dx = viewportWidth - margin - rect.right
  if (rect.left + dx < margin) dx = margin - rect.left
  return dx
}

/**
 * Where a panel just opened below its trigger fits: above it (`flipUp`) when it overflows the
 * viewport bottom and there's more room above, and capped to that side's room (`maxHeight`) when
 * neither side fits it whole (U37).
 */
export function computeDropdownFlip(
  rect: { top: number; bottom: number },
  trigger: { top: number; bottom: number },
  viewportHeight: number,
  margin = 8,
): { flipUp: boolean; maxHeight?: number } {
  const below = viewportHeight - margin - rect.top
  // Opened up, the panel keeps its gap to the trigger
  const above = trigger.top - (rect.top - trigger.bottom) - margin
  const flipUp = rect.bottom - rect.top > below && above > below
  const room = flipUp ? above : below
  return { flipUp, maxHeight: rect.bottom - rect.top > room ? room : undefined }
}

/**
 * Sets up a dropdown panel just opened: flips it up (`dt-dd--up`) when it would overflow the
 * viewport bottom, clamps it horizontally now, after every DOM change and whenever it resizes (its
 * trigger can move while it's open: a filter count badge widens the Filter button, the toolbar
 * rewraps), then focuses `ddOpenFocusTarget`. Returns the function stopping the clamp.
 */
export function openDropdownPanel(panel: HTMLElement): () => void {
  const { flipUp, maxHeight } = computeDropdownFlip(
    panel.getBoundingClientRect(),
    panel.parentElement!.getBoundingClientRect(),
    window.innerHeight,
  )
  if (flipUp) panel.classList.add('dt-dd--up')
  if (maxHeight !== undefined) panel.style.maxHeight = `${maxHeight}px`
  let current = 0
  const clamp = () => {
    const rect = panel.getBoundingClientRect()
    // Not laid out (jsdom, hidden): the rect ignores the translateX, so each write would grow it
    if (!rect.width) return
    // The rect shows the rendered offset, which lags the requested one while a transition runs
    const rendered = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m41
    const dx = computeDropdownClampOffset(
      { left: rect.left - rendered, right: rect.right - rendered },
      viewportWidth(),
    )
    // Sub-pixel noise would otherwise re-trigger this observer through the style write
    if (Math.abs(dx - current) < 0.5) return
    current = dx
    panel.style.transform = dx ? `translateX(${dx}px)` : ''
  }
  clamp()
  const observer = new MutationObserver(clamp)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })
  // A stylesheet or a transition can resize the panel with no DOM change (U29)
  const resized = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(clamp)
  resized?.observe(panel)
  ddOpenFocusTarget(panel)?.focus()
  return () => {
    observer.disconnect()
    resized?.disconnect()
  }
}

/**
 * A category submenu's fixed-viewport `left`/`top`, flying out of `triggerRow`: to its right, or
 * flipped to its left when the right lacks room (sliding back would cover the trigger); `top`
 * clamped into the viewport. Fixed because the submenu is portaled (see `CategorySubmenu`), and
 * `submenuSize` is measured after mount.
 */
export function computeSubmenuPosition(
  triggerRect: { top: number; right: number; bottom: number; left: number },
  submenuSize: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): { left: number; top: number } {
  const openRight = triggerRect.right + submenuSize.width <= viewportWidth - margin
  // Fits neither side (a narrow screen): stay on screen, overlapping the trigger
  const left = Math.max(
    margin,
    openRight ? triggerRect.right : triggerRect.left - submenuSize.width,
  )
  let top = triggerRect.top
  if (top + submenuSize.height > viewportHeight - margin)
    top = viewportHeight - margin - submenuSize.height
  if (top < margin) top = margin
  return { left, top }
}

/**
 * The viewport width a fixed or clamped panel must fit in: `innerWidth` minus a classic vertical
 * scrollbar, which `innerWidth` (and `100vw`) include. Falls back to `innerWidth` where layout is
 * absent (jsdom reports 0).
 */
export function viewportWidth(): number {
  return document.documentElement.clientWidth || window.innerWidth
}

/** Below this width the Filter dropdown (460 px plus margins) shows one pane at a time */
export const FILTER_NARROW_QUERY = '(max-width: 479px)'

/**
 * Calls `onChange` with whether `query` matches, now and on every change; returns the function
 * removing the listener. Reports `false` where `matchMedia` is missing (jsdom).
 */
export function watchMedia(query: string, onChange: (matches: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    onChange(false)
    return () => {}
  }
  const list = window.matchMedia(query)
  const listener = () => onChange(list.matches)
  listener()
  list.addEventListener('change', listener)
  return () => list.removeEventListener('change', listener)
}

/**
 * A header menu's fixed-viewport `left`/`top`: below `anchorRect`, left-aligned with it, slid back
 * inside the viewport horizontally, and flipped above the anchor when it doesn't fit below.
 */
export function computeMenuPosition(
  anchorRect: { top: number; right: number; bottom: number; left: number },
  menuSize: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): { left: number; top: number } {
  const left = Math.max(margin, Math.min(anchorRect.left, viewportWidth - margin - menuSize.width))
  const fitsBelow = anchorRect.bottom + menuSize.height <= viewportHeight - margin
  const top = fitsBelow ? anchorRect.bottom : Math.max(margin, anchorRect.top - menuSize.height)
  return { left, top }
}

/** The rows and search box a dropdown panel's roving ↑/↓/Home/End nav reaches, by their `data-*` markers */
export const DD_NAV_SELECTOR = 'input[data-dd-search], [data-dd-row]'

/**
 * An element matched by a nav selector is either itself focusable (an `<input>`/`<button>`/
 * `[tabindex]`) or wraps its actual focusable target as a descendant (e.g. a column checkbox row,
 * whose own checkbox — not the row `<div>` — is the real Tab stop).
 */
function ddFocusableFor(el: HTMLElement): HTMLElement | null {
  return el.matches('input, button, [tabindex]')
    ? el
    : el.querySelector<HTMLElement>('input, button, [tabindex]')
}

/**
 * Queries `panel` for every element matched by `DD_NAV_SELECTOR`, in DOM order, resolved down to
 * each one's actual focusable target via `ddFocusableFor`.
 */
export function ddNavFocusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(DD_NAV_SELECTOR))
    .map(ddFocusableFor)
    .filter((el): el is HTMLElement => el !== null)
}

/**
 * Where ↑/↓/Home/End moves focus in a roving list: `active`'s neighbor in `all` (no wrap), or the
 * first/last of `homeEnd`. Null for other keys, when `active` isn't in `all`, or when focus stays.
 */
export function rovingFocusTarget<T extends Element>(
  key: string,
  all: T[],
  active: Element | null,
  homeEnd: T[] = all,
): T | null {
  const i = all.indexOf(active as T)
  if (i === -1) return null
  const next =
    key === 'Home'
      ? homeEnd[0]
      : key === 'End'
        ? homeEnd[homeEnd.length - 1]
        : key === 'ArrowDown'
          ? all[i + 1]
          : key === 'ArrowUp'
            ? all[i - 1]
            : undefined
  return next && next !== active ? next : null
}

/**
 * Keyboard for the Columns/Sort/Group active rows: Alt+↑/↓ calls `move` (absent on a row that
 * can't move), Delete/Backspace matches the row's × button, Enter/Space activates. Handled keys
 * are preventDefault'ed (Space would scroll the panel out from under the focused row), except a
 * move returning false (no neighbor).
 */
export function activeRowKeyDown(
  e: { key: string; altKey: boolean; preventDefault(): void },
  move: ((delta: number) => boolean | void) | undefined,
  remove: () => void,
  activate?: () => void,
): void {
  const { key } = e
  if (e.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
    if (move && move(key === 'ArrowUp' ? -1 : 1) !== false) e.preventDefault()
  } else if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault()
    remove()
  } else if (key === 'Enter' || key === ' ') {
    e.preventDefault()
    activate?.()
  }
}

/**
 * Where focus lands when a dropdown opens: its search box (`input[data-dd-search]`), else its
 * current row (`aria-current`, e.g. the column the Filter pane shows), else its first row. On a
 * touch screen (`pointer: coarse`) a row even when there's a search box: focusing a text field
 * there raises the on-screen keyboard before the user asked to type.
 */
export function ddOpenFocusTarget(panel: HTMLElement): HTMLElement | undefined {
  const touch = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const search = panel.querySelector<HTMLElement>('input[data-dd-search]')
  if (search && !touch) return search
  const rows = ddNavFocusables(panel).filter((el) => !el.matches('input[data-dd-search]'))
  return rows.find((el) => el.matches('[aria-current]')) ?? rows[0]
}

/**
 * Where focus goes when a chip's × removes its chip (U30): the next chip's ×, else the previous
 * one's, else the table's search box, else its first button. Look it up and focus it before the
 * removal: the target outlives it, so no framework's render timing matters.
 */
export function chipRemovalFocusTarget(x: HTMLElement): HTMLElement | null {
  const xs = [...(x.closest('.dt-active-bar')?.querySelectorAll<HTMLElement>('.dt-chip-x') ?? [])]
  const i = xs.indexOf(x)
  const root = x.closest('.dt')
  return (
    xs[i + 1] ??
    xs[i - 1] ??
    root?.querySelector<HTMLElement>('.dt-search-input') ??
    root?.querySelector<HTMLElement>('button') ??
    null
  )
}

/** The Filter pane's arrow-key stops: value search, value rows, date-tree boxes — not "Select all", which sits beside the list. */
export const FILTER_DETAIL_NAV_SELECTOR =
  'input[data-dd-value-search], input[data-dd-value-row], .dt-date-tree-wrap input[type="checkbox"]'

/** Where → from a Filter column lands (U32): the pane's first arrow-key stop, else its first input (a number column's range). */
export function filterDetailFocusTarget(detail: Element | null | undefined): HTMLElement | null {
  return (
    detail?.querySelector<HTMLElement>(FILTER_DETAIL_NAV_SELECTOR) ??
    detail?.querySelector<HTMLElement>('input') ??
    null
  )
}
