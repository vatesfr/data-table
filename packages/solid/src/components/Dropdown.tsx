import { type JSX, Show, createSignal, onCleanup, onMount } from 'solid-js'
import { computeDropdownClampOffset, ddNavFocusables } from '@vates/data-table-core/internal'

interface DropdownProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  trigger: JSX.Element
  /** Rendered as a sibling of `trigger`, inside the same outside-click boundary — see the
   * toolbar's per-dropdown × clear buttons (CLAUDE.md's "Toolbar clear buttons"). */
  extraTrigger?: JSX.Element
  children: JSX.Element
  /**
   * Escape clears a non-empty search term first (focus stays put), only closing the dropdown on
   * a second press or when there was nothing to clear — each dropdown wires its own search-clear
   * action here (it may own more than one search box, e.g. the Filter dropdown's column search
   * and its per-column value search; the callback itself decides which one Escape's own moment
   * actually applies to, checking `document.activeElement`). Returns whether it actually cleared
   * something. Omitted for a panel with no search box at all.
   */
  onEscapeClearable?: () => boolean
}

// `data-dd-search` marks a dropdown's own column-search `<input>` (Columns/Sort/Group's addable
// list, Filter's left pane); `data-dd-row` marks every other row this nav should reach (a column
// checkbox row, a Sort/Group active or addable entry, a Filter column-selector button). Handled by
// core's `ddNavFocusables` (`@vates/data-table-core/dropdownDomUtils`, using its default
// `DD_NAV_SELECTOR`), shared with react/components/Dropdown.tsx's identical usage — deliberately
// generic, since Dropdown has no idea which concrete dropdown it's rendering, only that its
// children may carry these two markers. The Filter dropdown's own right-pane value search/checklist
// get separate `data-dd-value-search`/`data-dd-value-row` markers instead (see FilterDropdown.tsx)
// — a distinct focusable-set with its own nav, not covered by this one.

// Generic dropdown shell shared by Columns/Sort/Group/Filter — mirrors react/components/Dropdown.tsx
// and vue/components/Dropdown.vue's role. Handles: open/close, outside-click-to-close,
// Escape-clears-search-then-closes, focus-follows-open, roving Up/Down/Home/End nav across the
// panel's own search box + rows, and viewport clamping (translateX so a wide panel opened near
// the right edge doesn't render off-screen — see CLAUDE.md's "Dropdown viewport clamping").
export function Dropdown(props: DropdownProps) {
  let wrapRef: HTMLDivElement | undefined
  let panelRef: HTMLDivElement | undefined
  const [flipUp, setFlipUp] = createSignal(false)
  const [translateX, setTranslateX] = createSignal(0)

  function handleDocClick(e: MouseEvent): void {
    // Every Columns/Sort/Group/Filter dropdown mounts its own Dropdown instance simultaneously,
    // each with its own document-level capture listener. Without this `props.isOpen` guard, a
    // click anywhere inside the *currently open* dropdown's own panel would still be treated as
    // "outside" by every *other*, currently-closed dropdown's listener — and since all four share
    // one `openDropdown` signal, any of their `onClose()` calls closes whichever one actually is
    // open, immediately after the click reaches its real target. (Found via the full
    // createDataTable integration tests: it never surfaced in a single-component test, since
    // there's no sibling dropdown there to falsely fire.)
    if (!props.isOpen) return
    // A click inside an open category submenu (see CategorySubmenu.tsx) must not count as
    // "outside" — it's portaled straight to `document.body`, not a DOM descendant of `wrapRef`,
    // for reasons explained in that file's own top comment (escaping `.dt-dd`'s scrollable
    // overflow), so `wrapRef.contains()` alone can't see it.
    const target = e.target as Element
    if (target.closest?.('.dt-dd-submenu')) return
    if (wrapRef && !wrapRef.contains(e.target as Node)) props.onClose()
  }

  // Roving Up/Down/Home/End nav across the panel's own search box + rows (see DD_NAV_SELECTOR
  // above), plus Escape. A distinct concern from any Alt+↑/↓ reorder or Enter/Space toggle a row
  // itself implements — those don't stopPropagation, so this still runs after them via bubbling,
  // but its own `e.altKey` guard keeps it from ever acting on their modifier combo. Scoped to
  // elements this panel actually recognizes (`focusables.indexOf(active) !== -1`) so it never
  // interferes with unrelated controls elsewhere in the panel (e.g. the Filter dropdown's
  // right-hand detail pane, which implements its own nav — see FilterDropdown.tsx — including
  // native Left/Right/Up/Down/Home/End on its own range inputs/slider that must keep working
  // unmolested).
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (props.onEscapeClearable?.()) return
      props.onClose()
      // The trigger is always the first <button> in DOM order (trigger renders before
      // extraTrigger, which renders before the panel) — same technique react's own Dropdown uses.
      wrapRef?.querySelector<HTMLElement>('button')?.focus()
      return
    }
    if (e.altKey) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    if (!panelRef) return
    const focusables = ddNavFocusables(panelRef)
    const rowFocusables = focusables.filter((el) => !el.matches('input[data-dd-search]'))
    const active = document.activeElement as HTMLElement | null
    if (!active || focusables.indexOf(active) === -1) return
    if (e.key === 'Home' || e.key === 'End') {
      if (rowFocusables.length === 0) return
      e.preventDefault()
      ;(e.key === 'Home' ? rowFocusables[0] : rowFocusables[rowFocusables.length - 1]).focus()
      return
    }
    const idx = focusables.indexOf(active)
    const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= focusables.length) return
    e.preventDefault()
    focusables[nextIdx].focus()
  }

  onMount(() => {
    document.addEventListener('click', handleDocClick, true)
    onCleanup(() => document.removeEventListener('click', handleDocClick, true))
  })

  function clampToViewport(el: HTMLDivElement): void {
    const rect = el.getBoundingClientRect()
    const { dx, flipUp } = computeDropdownClampOffset(rect, window.innerWidth, window.innerHeight)
    setTranslateX(dx)
    setFlipUp(flipUp)
  }

  return (
    <div class="dt-dd-wrap" ref={wrapRef} onKeyDown={handleKeyDown}>
      <span style={{ display: 'inline-flex' }}>
        {props.trigger}
        {props.extraTrigger}
      </span>
      <Show when={props.isOpen}>
        <div
          class={`dt-dd${flipUp() ? ' dt-dd--up' : ''}`}
          ref={(el) => {
            panelRef = el
            // A ref callback fires at this element's own insertion time — before `props.children`
            // (passed down from Columns/Sort/Group/Filter, several component boundaries away) has
            // actually been resolved and appended underneath it. Querying for a search box/row
            // synchronously here found nothing every time (confirmed by a failing test) — same
            // underlying reason the viewport-clamp measurement below already needs to wait a
            // microtask, just for DOM presence instead of layout.
            queueMicrotask(() => {
              if (!panelRef) return
              // Opening a dropdown should hand it focus immediately — its own search box if it
              // has one (preferred regardless of where it sits in the DOM, e.g. Sort/Group's
              // search box renders *after* the active-entries section but is still the preferred
              // landing spot), else the first row (e.g. Sort with every column already sorted has
              // no addable section and therefore no search box).
              const search = panelRef.querySelector<HTMLElement>('input[data-dd-search]')
              if (search) search.focus()
              else ddNavFocusables(panelRef)[0]?.focus()
              // Measure after the panel's real content is laid out — same microtask, since both
              // now depend on the same "children actually exist" precondition.
              clampToViewport(panelRef)
            })
          }}
          style={{ transform: translateX() ? `translateX(${translateX()}px)` : undefined }}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
