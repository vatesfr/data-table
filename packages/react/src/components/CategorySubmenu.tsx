import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  computeSubmenuPosition,
  ddNavFocusables,
  rovingFocusTarget,
  viewportWidth,
} from '@vates/data-table-core/internal'

// Hover-intent delays: no flicker-open on a passing pointer, room to travel diagonally into the flyout (docs/columns.md's "Column categories")
const OPEN_DELAY = 100
const CLOSE_DELAY = 250

export interface CategorySubmenuProps {
  name: string
  // Controlled: the parent's single open-category value closes any sibling
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  children: ReactNode
  /** Shown before `name` (the header menu's Filter item) */
  icon?: ReactNode
  /** Names the flyout as a group (the header menu's filter controls) */
  groupLabel?: string
  /** Extra class on the flyout */
  className?: string
}

// A category row opening a fixed, non-portaled flyout with its own ↑/↓ nav (docs/columns.md's "Column categories")
export function CategorySubmenu(props: CategorySubmenuProps) {
  const [left, setLeft] = useState(0)
  const [top, setTop] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function cancelOpen(): void {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
  }
  function cancelClose(): void {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }

  function focusFirstRow(): void {
    queueMicrotask(() => {
      const submenu = submenuRef.current
      if (!submenu) return
      // A flyout without rows (the header menu's filter pane) starts on its first text field
      ;(
        ddNavFocusables(submenu)[0] ??
        submenu.querySelector<HTMLElement>('input[type=text]') ??
        submenu.querySelector<HTMLElement>('input, button')
      )?.focus()
    })
  }
  function openNow(focusFirst: boolean): void {
    cancelOpen()
    cancelClose()
    if (!props.isOpen) {
      if (triggerRef.current) {
        // Initial guess, corrected by the layout effect once the submenu is measured
        const rect = triggerRef.current.getBoundingClientRect()
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
    if (focusTrigger) triggerRef.current?.focus()
  }
  function scheduleOpen(): void {
    cancelClose()
    if (props.isOpen || openTimerRef.current) return
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = undefined
      openNow(false)
    }, OPEN_DELAY)
  }
  function scheduleClose(): void {
    cancelOpen()
    if (closeTimerRef.current) return
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined
      closeNow(false)
    }, CLOSE_DELAY)
  }

  // Corrects the initial guess with the submenu's real size, before paint
  useLayoutEffect(() => {
    if (!props.isOpen) return
    const trigger = triggerRef.current
    const submenu = submenuRef.current
    if (!trigger || !submenu) return
    const triggerRect = trigger.getBoundingClientRect()
    const rect = submenu.getBoundingClientRect()
    const pos = computeSubmenuPosition(
      triggerRect,
      { width: rect.width, height: rect.height },
      viewportWidth(),
      window.innerHeight,
    )
    setLeft(pos.left)
    setTop(pos.top)
  }, [props.isOpen])

  function handleSubmenuKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    // ← in a text field moves its caret instead
    const inText = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox'
    if (e.key === 'Escape' || (e.key === 'ArrowLeft' && !inText)) {
      e.preventDefault()
      e.stopPropagation()
      closeNow(true)
      return
    }
    const submenu = submenuRef.current
    if (!submenu) return
    const target = rovingFocusTarget(e.key, ddNavFocusables(submenu), document.activeElement)
    if (!target) return
    e.preventDefault()
    e.stopPropagation()
    target.focus()
  }

  return (
    <div className="dt-dd-category">
      <button
        type="button"
        className="dt-dd-item dt-dd-item--click dt-dd-category-trigger"
        data-dd-row
        data-category-header={props.name}
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
        <span className="dt-flex1">{props.name}</span>
        <span className="dt-dd-category-arrow">▸</span>
      </button>
      {props.isOpen && (
        <div
          ref={submenuRef}
          className={`dt-dd-submenu${props.className ? ` ${props.className}` : ''}`}
          data-category-submenu
          role={props.groupLabel ? 'group' : undefined}
          aria-label={props.groupLabel}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onKeyDown={handleSubmenuKeyDown}
          style={{ position: 'fixed', left, top }}
        >
          {props.children}
        </div>
      )}
    </div>
  )
}
