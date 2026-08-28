// This file's functions only ever run in a browser — they operate directly on `DOMRect`/`clientY`/
// `window` values — unlike the rest of `packages/core`, which targets a DOM-free `lib` so it can
// also run in Node/SSR (see `view.ts`'s hand-rolled base64url, `viewPersistence.ts`'s own note). A
// file-scoped `lib="dom"` reference pulls in just the ambient types this file needs (`DOMRect`,
// `HTMLElement`) without adding "dom" to the whole package's `tsconfig.json` `lib` array.
/// <reference lib="dom" />

// Framework-agnostic (DOM-touching, but non-reactive) geometry helpers shared by every adapter's
// own dropdown drag-and-drop / viewport-clamping / roving-nav code (React's `useDropdownReorder.ts`
// + `components/Dropdown.tsx`, Vue's `composables/useDropdownReorder.ts` + `components/Dropdown.vue`,
// Solid's `components/dragReorder.ts` + `components/Dropdown.tsx`). Each adapter keeps its own way
// of gathering DOM state (querying the DOM vs. tracked refs/signals) and its own reactive state
// machine — only the pure math moves here. Not part of the main `index.ts` barrel (DOM-dependent,
// not table logic) — reachable via its own `@vates/data-table-core/dropdownDomUtils` sub-path
// export, the same pattern as `/locales` and `/theme`.

/**
 * Resolves a drag-and-drop reorder gesture inside a dropdown panel's list (Columns/Sort/Group) to
 * a specific row under the cursor, and whether the dragged item should land before or after it.
 * Cursor position within the hovered row's own bounds decides before/after (top half vs bottom
 * half) so a row can be a valid "insert after" target too — including the *last* row, which
 * "insert before" alone could never reach. When the cursor is above the first row or below the
 * last row, it snaps to that edge row instead of rejecting the drop; anywhere else that isn't
 * directly over a row's own bounds (a dead-zone gap between non-adjacent rows) returns `null`,
 * rejecting the drop rather than guessing.
 *
 * `hitKey` is an optional pre-resolved "which row is the real DOM event target actually inside"
 * hint — React/Vue compute this themselves via `(e.target as HTMLElement).closest(selector)`,
 * since a DOM-ancestry hit test is more precise than a rect containment check (e.g. it still
 * finds the right row when the row's content overflows its own layout box). When given and it
 * matches one of `rows`, it's used directly instead of scanning by `clientY`; the row's own rect
 * is still used to compute `after`, and the edge-snap/dead-zone logic below is unchanged. Solid's
 * usage doesn't have (or need) an event target to check, so it omits this and relies purely on the
 * `clientY`-vs-`rect` scan.
 *
 * `rect` is typed as this module's own minimal `RectLike` (just the `top`/`bottom`/`height` fields
 * actually read) rather than the ambient DOM `DOMRect` type — a real `getBoundingClientRect()`
 * result satisfies it structurally, but keeping the *exported* signature free of an ambient DOM
 * type sidesteps an internal `vite-plugin-dts`/API Extractor crash ("Unable to follow symbol for
 * DOMRect") when rolling up this package's declaration files, since `packages/core`'s own
 * `tsconfig.json` doesn't include `"DOM"` in `lib` (see this file's own top-of-file comment).
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
 * stay within `[margin, viewportWidth - margin]`, and whether it should flip to render above its
 * trigger instead of below (`flipUp`) when it would otherwise overflow the bottom of the viewport.
 * A horizontal `translateX` offset is used instead of flipping the anchor side (`left:0` ->
 * `right:0`) since the overflow is relative to the *viewport*, not the trigger — flipping the
 * anchor on a trigger near one edge would just push a wide panel off the opposite side instead.
 *
 * `rect` only needs `top`/`right`/`bottom`/`left` here — typed as an inline shape rather than
 * `DOMRect` for the same declaration-rollup reason as `RectLike` above.
 */
export function computeDropdownClampOffset(
  rect: { top: number; right: number; bottom: number; left: number },
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): { dx: number; flipUp: boolean } {
  let dx = 0
  if (rect.right > viewportWidth - margin) dx = viewportWidth - margin - rect.right
  if (rect.left + dx < margin) dx = margin - rect.left
  const flipUp = rect.bottom > viewportHeight - margin
  return { dx, flipUp }
}

/**
 * Computes a category submenu's (see `ColumnDefBase.category`) fixed-viewport `left`/`top`,
 * flying out from `triggerRow`'s own rect. Rendered via a portal (straight to `document.body`,
 * not nested under the trigger's own scrollable dropdown panel — see `CategorySubmenu.tsx`'s own
 * top comment for why: an absolutely-positioned descendant that overflows its scrollable ancestor
 * horizontally otherwise grows that ancestor's own scrollable region instead of visually escaping
 * it, clipping the flyout and adding a spurious horizontal scrollbar to the panel), so this
 * computes real `position: fixed` viewport coordinates rather than a relative offset the way
 * `computeDropdownClampOffset`'s `dx`/`flipUp` do for the (non-portaled) top-level panel.
 *
 * Opens to the right of the trigger by default; flips to its left when the trigger's own right
 * edge already leaves less than `submenuSize.width` of room before the viewport's right edge — a
 * side flip, not a slide-back translate, since sliding a flyout backward far enough to fit would
 * visually overlap the very trigger row it's anchored to (unlike `computeDropdownClampOffset`'s
 * top-level panel, which has no "opposite side" to flip to and so slides via `dx` instead). `top`
 * is clamped to `[margin, viewportHeight - margin - height]`, top-aligned with the trigger by
 * default.
 *
 * `submenuSize` is the *already-rendered* submenu's own `width`/`height` — not knowable before it
 * exists in the DOM (see `CategorySubmenu.tsx`'s "measure after mount" comment, same reasoning as
 * `computeDropdownClampOffset`'s own caller).
 */
export function computeSubmenuPosition(
  triggerRect: { top: number; right: number; bottom: number; left: number },
  submenuSize: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): { left: number; top: number } {
  const openRight = triggerRect.right + submenuSize.width <= viewportWidth - margin
  const left = openRight ? triggerRect.right : triggerRect.left - submenuSize.width
  let top = triggerRect.top
  if (top + submenuSize.height > viewportHeight - margin)
    top = viewportHeight - margin - submenuSize.height
  if (top < margin) top = margin
  return { left, top }
}

/**
 * The roving Up/Down/Home/End nav shared by every Columns/Sort/Group dropdown panel (and the
 * Filter dropdown's left column pane) needs an ordered list of that panel's own focusable
 * row/search elements. `DD_NAV_SELECTOR` is the default selector for the `data-*`-attribute-based
 * markup React/Solid render (`data-dd-search` on a dropdown's own column-search input,
 * `data-dd-row` on every other row this nav should reach) — deliberately generic, since neither
 * knows which concrete dropdown it's rendering, only that its children may carry these two
 * markers. Vue's own dropdown markup uses class-based row selectors instead (`.dt__dd-item--*`),
 * so it passes its own selector string through rather than using the default.
 */
export const DD_NAV_SELECTOR = 'input[data-dd-search], [data-dd-row]'

/**
 * An element matched by a nav selector is either itself focusable (an `<input>`/`<button>`/
 * `[tabindex]`) or wraps its actual focusable target as a descendant (e.g. a column checkbox row,
 * whose own checkbox — not the row `<div>` — is the real Tab stop).
 */
export function ddFocusableFor(el: HTMLElement): HTMLElement | null {
  return el.matches('input, button, [tabindex]')
    ? el
    : el.querySelector<HTMLElement>('input, button, [tabindex]')
}

/**
 * Queries `panel` for every element matched by `selector` (default `DD_NAV_SELECTOR`), in DOM
 * order, resolved down to each one's actual focusable target via `ddFocusableFor`.
 */
export function ddNavFocusables(
  panel: HTMLElement,
  selector: string = DD_NAV_SELECTOR,
): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(selector))
    .map(ddFocusableFor)
    .filter((el): el is HTMLElement => el !== null)
}
