import { type JSX, Show, createSignal, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import { computeSubmenuPosition, ddNavFocusables } from '@vates/data-table-core/internal'

// Hover-intent delays (see CLAUDE.md's "Column categories"): a native OS/app-menu-style flyout
// opens on hover once its parent menu is already open — a plain click-to-open (the first version
// of this component) felt wrong for exactly that reason, it isn't how this kind of menu behaves
// anywhere else. `OPEN_DELAY` avoids a flicker-open while the pointer merely sweeps across a
// category row on its way to something else; `CLOSE_DELAY` is longer, giving the pointer room to
// travel diagonally from the trigger into the submenu itself without the gap between them (however
// narrow) closing it prematurely. Click still opens/closes immediately (no delay) — the explicit,
// deliberate action a touch tap or an impatient click expects — as do ArrowRight/Enter/Escape.
const OPEN_DELAY = 100
const CLOSE_DELAY = 250

interface CategorySubmenuProps {
  name: string
  // Controlled, not self-managed: the parent (Sort/GroupDropdown) owns one shared "which category
  // is open" value across every CategorySubmenu in its list, so opening one always closes any
  // other that was open — see that parent's own `openCategory` signal. A self-managed `isOpen`
  // signal per instance (the first version of this component) let two sibling submenus stay open
  // at once, which reads as a bug the moment two categories are anywhere near each other.
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  children: JSX.Element
}

// A category row in the Columns/Sort/Group dropdowns' column lists (see CLAUDE.md's "Column
// categories"): collapses every column sharing `ColumnDefBase.category` into one row that opens a
// flyout submenu listing them, instead of a flat run of individual rows — worthwhile once a
// category has enough columns that this saves real scanning. Reuses whatever row markup its own
// list (Sort's/Group's addable-column buttons) already renders as `children`.
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
  const [left, setLeft] = createSignal(0)
  const [top, setTop] = createSignal(0)
  let triggerRef: HTMLButtonElement | undefined
  let submenuRef: HTMLDivElement | undefined
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  function cancelOpen(): void {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = undefined
    }
  }
  function cancelClose(): void {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = undefined
    }
  }
  onCleanup(() => {
    cancelOpen()
    cancelClose()
  })

  function focusFirstRow(): void {
    queueMicrotask(() => {
      if (submenuRef) ddNavFocusables(submenuRef)[0]?.focus()
    })
  }
  function openNow(focusFirst: boolean): void {
    cancelOpen()
    cancelClose()
    if (!props.isOpen) {
      if (triggerRef) {
        // Initial guess (right of the trigger, top-aligned) — corrected once the submenu's real
        // size is known, see the `ref` callback below. Avoids a 0,0-positioned flash before that
        // measurement lands.
        const rect = triggerRef.getBoundingClientRect()
        setLeft(rect.right)
        setTop(rect.top)
      }
      props.onOpen()
    }
    if (focusFirst) focusFirstRow()
  }
  function closeNow(focusTrigger: boolean): void {
    cancelOpen()
    cancelClose()
    if (props.isOpen) props.onClose()
    if (focusTrigger) triggerRef?.focus()
  }
  function scheduleOpen(): void {
    cancelClose()
    if (props.isOpen || openTimer) return
    openTimer = setTimeout(() => {
      openTimer = undefined
      openNow(false)
    }, OPEN_DELAY)
  }
  function scheduleClose(): void {
    cancelOpen()
    if (closeTimer) return
    closeTimer = setTimeout(() => {
      closeTimer = undefined
      closeNow(false)
    }, CLOSE_DELAY)
  }

  return (
    <div class="dt-dd-category">
      <button
        type="button"
        class="dt-dd-item dt-dd-item--click dt-dd-category-trigger"
        data-dd-row
        ref={triggerRef}
        aria-expanded={props.isOpen}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onClick={() => (props.isOpen ? closeNow(false) : openNow(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !props.isOpen) {
            e.preventDefault()
            openNow(true)
          }
        }}
      >
        <span class="dt-flex1">{props.name}</span>
        <span class="dt-dd-category-arrow">▸</span>
      </button>
      <Show when={props.isOpen}>
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
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                e.preventDefault()
                e.stopPropagation()
                closeNow(true)
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
