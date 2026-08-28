import { type JSX, Show, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { computeSubmenuPosition, ddNavFocusables } from '@vates/data-table-core/internal'

interface CategorySubmenuProps {
  name: string
  children: JSX.Element
}

// A category row in the Columns/Sort/Group dropdowns' column lists (see CLAUDE.md's "Column
// categories"): collapses every column sharing `ColumnDefBase.category` into one row that opens a
// flyout submenu listing them, instead of a flat run of individual rows — worthwhile once a
// category has enough columns that this saves real scanning. Click-only (no hover-intent), same as
// every other dropdown in this library. Each submenu manages its own open/closed state
// independently — more than one can be open at once, a rare and harmless overlap for two
// vertically-close category rows — and reuses whatever row markup its own list (Sort's/Group's
// addable-column buttons) already renders as `children`.
//
// Rendered through a `<Portal>` straight to `document.body`, positioned with `position: fixed` at
// viewport coordinates computed from the trigger's own rect (`computeSubmenuPosition`, core) —
// NOT nested inside the trigger's own scrollable `.dt-dd` panel with a plain CSS
// `position: absolute` anchor. That was the first approach here, and it doesn't work: `.dt-dd` has
// `overflow-y: auto`, and a positioned descendant that overflows a scrollable ancestor
// horizontally still counts toward that ancestor's own scrollable content region even though it's
// taken out of normal flow — so the flyout grew `.dt-dd`'s scrollable area sideways instead of
// visually escaping it, both clipping the submenu and adding a spurious horizontal scrollbar to
// the whole panel (confirmed empirically against the demo). A portal sidesteps this entirely: the
// submenu is a sibling of the panel in the real DOM, not a descendant of it, so it never
// contributes to `.dt-dd`'s own overflow.
//
// Deliberately does NOT implement its own Up/Down/Home/End nav: submenu rows carry the same
// `data-dd-row` marker as every other row, so they'd normally be picked up for free by
// `Dropdown.tsx`'s own generic panel-wide roving nav (which walks `[data-dd-row]` in DOM order) —
// except a portaled submenu's rows are no longer DOM descendants of the panel that nav scopes
// itself to, so the two are wired together explicitly instead: `ArrowRight`/`Enter` on the trigger
// opens the submenu and focuses its first row; `ArrowLeft`/`Escape` inside the submenu closes it
// and refocuses the trigger, both handled locally below — Escape/ArrowLeft stop propagation so
// they close just this submenu, not the whole dropdown panel (`Dropdown.tsx`'s own Escape handler
// would otherwise close/clear the entire panel instead, and since the submenu is no longer a DOM
// descendant of the panel, that stopPropagation on the submenu itself is what actually matters —
// the panel-level listener would never have received a portaled event to begin with once it
// crossed back out, but stopping it here keeps the intent explicit either way).
export function CategorySubmenu(props: CategorySubmenuProps) {
  const [isOpen, setIsOpen] = createSignal(false)
  const [left, setLeft] = createSignal(0)
  const [top, setTop] = createSignal(0)
  let triggerRef: HTMLButtonElement | undefined
  let submenuRef: HTMLDivElement | undefined

  function focusFirstRow(): void {
    queueMicrotask(() => {
      if (submenuRef) ddNavFocusables(submenuRef)[0]?.focus()
    })
  }
  function openSubmenu(): void {
    if (triggerRef) {
      // Initial guess (right of the trigger, top-aligned) — corrected once the submenu's real
      // size is known, see the `ref` callback below. Avoids a 0,0-positioned flash before that
      // measurement lands.
      const rect = triggerRef.getBoundingClientRect()
      setLeft(rect.right)
      setTop(rect.top)
    }
    setIsOpen(true)
    focusFirstRow()
  }
  function closeSubmenu(focusTrigger: boolean): void {
    setIsOpen(false)
    if (focusTrigger) triggerRef?.focus()
  }

  return (
    <div class="dt-dd-category">
      <button
        type="button"
        class="dt-dd-item dt-dd-item--click dt-dd-category-trigger"
        data-dd-row
        ref={triggerRef}
        aria-expanded={isOpen()}
        onClick={() => (isOpen() ? closeSubmenu(false) : openSubmenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !isOpen()) {
            e.preventDefault()
            openSubmenu()
          }
        }}
      >
        <span class="dt-flex1">{props.name}</span>
        <span class="dt-dd-category-arrow">▸</span>
      </button>
      <Show when={isOpen()}>
        <Portal>
          <div
            class="dt-dd-submenu"
            ref={(el) => {
              submenuRef = el
              // Same "measure after the real children exist" reasoning as Dropdown.tsx's own
              // clampToViewport — a ref callback fires before this div's own children are appended.
              queueMicrotask(() => {
                if (!submenuRef || !triggerRef) return
                const triggerRect = triggerRef.getBoundingClientRect()
                const rect = submenuRef.getBoundingClientRect()
                const pos = computeSubmenuPosition(
                  triggerRect,
                  { width: rect.width, height: rect.height },
                  window.innerWidth,
                  window.innerHeight,
                )
                setLeft(pos.left)
                setTop(pos.top)
              })
            }}
            style={{ position: 'fixed', left: `${left()}px`, top: `${top()}px` }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                e.preventDefault()
                e.stopPropagation()
                closeSubmenu(true)
              }
            }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  )
}
