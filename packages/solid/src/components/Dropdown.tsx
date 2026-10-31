import { type JSX, Show, onCleanup, onMount } from 'solid-js'
import {
  ddNavFocusables,
  openDropdownPanel,
  rovingFocusTarget,
} from '@vates/data-table-core/internal'

interface DropdownProps {
  isOpen: boolean
  onClose: () => void
  trigger: JSX.Element
  /** Rendered as a sibling of `trigger`, inside the same outside-click boundary — see the
   * toolbar's per-dropdown × clear buttons (docs/toolbar.md's "Toolbar clear buttons"). */
  extraTrigger?: JSX.Element
  children: JSX.Element
  /**
   * Escape clears a search term first, closing on a second press; returns whether it cleared
   * something. Omitted for a panel with no search box.
   */
  onEscapeClearable?: () => boolean
}

// Dropdown shell shared by Columns/Sort/Group/Filter: open/close, outside click, Escape, focus on
// open, roving ↑/↓/Home/End over its `DD_NAV_SELECTOR` rows, viewport clamping (docs/toolbar.md)
export function Dropdown(props: DropdownProps) {
  let wrapRef: HTMLDivElement | undefined
  let panelRef: HTMLDivElement | undefined

  function handleDocClick(e: MouseEvent): void {
    // Every dropdown's listener is mounted at once: a closed one must not close the open one
    if (!props.isOpen) return
    if (wrapRef && !wrapRef.contains(e.target as Node)) props.onClose()
  }

  // Alt is left to row reordering; the Filter detail pane and range inputs keep their own keys
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
    if (!panelRef) return
    // An open CategorySubmenu runs its own nav
    const focusables = ddNavFocusables(panelRef).filter((el) => !el.closest('.dt-dd-submenu'))
    const rowFocusables = focusables.filter((el) => !el.matches('input[data-dd-search]'))
    const target = rovingFocusTarget(e.key, focusables, document.activeElement, rowFocusables)
    if (!target) return
    e.preventDefault()
    target.focus()
  }

  onMount(() => {
    document.addEventListener('click', handleDocClick, true)
    onCleanup(() => document.removeEventListener('click', handleDocClick, true))
  })

  return (
    <div class="dt-dd-wrap" ref={wrapRef} onKeyDown={handleKeyDown}>
      <span style={{ display: 'inline-flex' }}>
        {props.trigger}
        {props.extraTrigger}
      </span>
      <Show when={props.isOpen}>
        <div
          class="dt-dd"
          ref={(el) => {
            panelRef = el
            // Registered here: the microtask below runs outside this branch's owner
            let stopClamping: (() => void) | undefined
            let closed = false
            onCleanup(() => {
              closed = true
              stopClamping?.()
            })
            // A microtask: the ref fires before `props.children` is appended (docs/dropdown-keyboard-nav.md)
            queueMicrotask(() => {
              // Clamp before focusing (inside openDropdownPanel): focusing a field still past the
              // viewport's edge scrolls the whole page sideways (phones)
              if (panelRef && !closed) stopClamping = openDropdownPanel(panelRef)
            })
          }}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
