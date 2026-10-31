import { type JSX, Show, createSignal, onCleanup } from 'solid-js'
import {
  computeSubmenuPosition,
  ddNavFocusables,
  rovingFocusTarget,
  viewportWidth,
} from '@vates/data-table-core/internal'

// Hover-intent delays: no flicker-open on a passing pointer, room to travel diagonally into the flyout (docs/columns.md's "Column categories")
const OPEN_DELAY = 100
const CLOSE_DELAY = 250

interface CategorySubmenuProps {
  name: string
  // Controlled: the parent's single open-category value keeps two siblings from staying open
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  children: JSX.Element
  /** Shown before `name` (the header menu's Filter item) */
  icon?: JSX.Element
  /** Names the flyout as a group (the header menu's filter controls) */
  groupLabel?: string
  /** Extra class on the flyout */
  class?: string
}

// A category row opening a fixed, non-portaled flyout (docs/columns.md's "Column categories"). Its own
// nav, all stopping propagation: →/Enter open it on its first row, ↑/↓/Home/End rove its rows,
// ←/Escape close it and refocus the trigger.
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
      if (!submenuRef) return
      // A flyout without rows (the header menu's filter pane) starts on its first text field
      ;(
        ddNavFocusables(submenuRef)[0] ??
        submenuRef.querySelector<HTMLElement>('input[type=text]') ??
        submenuRef.querySelector<HTMLElement>('input, button')
      )?.focus()
    })
  }
  function openNow(focusFirst: boolean): void {
    cancelOpen()
    cancelClose()
    if (!props.isOpen) {
      if (triggerRef) {
        // Initial guess, corrected once the submenu is measured (the `ref` callback below)
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
        // Refocus target for a hidden column landing in this closed submenu (ColumnsDropdown)
        data-category-name={props.name}
        ref={triggerRef}
        aria-expanded={props.isOpen}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onClick={() => openNow(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !props.isOpen) {
            e.preventDefault()
            openNow(true)
          }
        }}
      >
        {props.icon}
        <span class="dt-flex1">{props.name}</span>
        <span class="dt-dd-category-arrow">▸</span>
      </button>
      <Show when={props.isOpen}>
        <div
          class={`dt-dd-submenu${props.class ? ` ${props.class}` : ''}`}
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
                viewportWidth(),
                window.innerHeight,
              )
              setLeft(pos.left)
              setTop(pos.top)
            })
          }}
          role={props.groupLabel ? 'group' : undefined}
          aria-label={props.groupLabel}
          style={{ position: 'fixed', left: `${left()}px`, top: `${top()}px` }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onKeyDown={(e) => {
            // ← in a text field moves its caret instead
            const inText = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox'
            if (e.key === 'Escape' || (e.key === 'ArrowLeft' && !inText)) {
              e.preventDefault()
              e.stopPropagation()
              closeNow(true)
              return
            }
            if (!submenuRef) return
            const target = rovingFocusTarget(
              e.key,
              ddNavFocusables(submenuRef),
              document.activeElement,
            )
            if (!target) return
            e.preventDefault()
            e.stopPropagation()
            target.focus()
          }}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
