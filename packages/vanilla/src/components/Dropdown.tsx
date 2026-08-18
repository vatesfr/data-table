import { type JSX, Show, createSignal, onCleanup, onMount } from 'solid-js'

interface DropdownProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  trigger: JSX.Element
  /** Rendered as a sibling of `trigger`, inside the same outside-click boundary — see the
   * toolbar's per-dropdown × clear buttons (CLAUDE.md's "Toolbar clear buttons"). */
  extraTrigger?: JSX.Element
  children: JSX.Element
}

// Generic dropdown shell shared by Columns/Sort/Group/Filter — mirrors react/components/Dropdown.tsx
// and vue/components/Dropdown.vue's role. Handles: open/close, outside-click-to-close, Escape-to-close,
// and viewport clamping (translateX so a wide panel opened near the right edge doesn't render
// off-screen — see CLAUDE.md's "Dropdown viewport clamping").
//
// Simplification vs. the fuller documented behavior (noted here rather than silently dropped):
// the generic column-search roving Up/Down/Home/End keyboard nav described in "Dropdown column
// search and keyboard navigation" is not implemented in this first pass — panel contents are
// still fully reachable via native Tab order (every row is a real <button>/focusable element),
// just not via dedicated arrow-key roving yet. Flagged as a follow-up once the full view is
// assembled and there's a concrete set of panels to validate it against.
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
    if (wrapRef && !wrapRef.contains(e.target as Node)) props.onClose()
  }
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      props.onClose()
    }
  }
  onMount(() => {
    document.addEventListener('click', handleDocClick, true)
    onCleanup(() => document.removeEventListener('click', handleDocClick, true))
  })

  function clampToViewport(el: HTMLDivElement): void {
    const rect = el.getBoundingClientRect()
    const margin = 8
    let dx = 0
    if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right
    if (rect.left + dx < margin) dx = margin - rect.left
    setTranslateX(dx)
    setFlipUp(rect.bottom > window.innerHeight - margin)
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
            // Measure after the panel's real content is laid out — a ref callback fires at
            // insertion time, before the browser has computed layout for this frame.
            queueMicrotask(() => panelRef && clampToViewport(panelRef))
          }}
          style={{ transform: translateX() ? `translateX(${translateX()}px)` : undefined }}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
