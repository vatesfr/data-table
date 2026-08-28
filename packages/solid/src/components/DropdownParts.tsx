import { For, Show, createSignal, type JSX } from 'solid-js'
import type { ColumnCategory } from '@vates/data-table-core/internal'
import { CategorySubmenu } from './CategorySubmenu'

// Small, purely presentational building blocks shared by the Columns/Sort/Group/Filter dropdowns
// (see CLAUDE.md's per-dropdown sections) — extracted after a cross-dropdown consistency review
// found the same markup duplicated near-verbatim across three or four of them. None of these carry
// any dropdown-specific behavior of their own; every action (what a click actually does, which
// data-key attribute a row carries) is passed in by the caller, so this file has no dependency on
// `TableState` or any one dropdown's own shape.

/**
 * One addable-column row — a plain "click to activate" button, used by Sort's/Group's/Columns'
 * own addable/available-column lists (both the flat uncategorized run and inside a
 * `CategorySubmenu`). `dataKeyAttr`/`dataKeyValue` become the row's own `data-*` attribute (e.g.
 * `data-col-key`) — kept as separate name/value rather than a single pre-built string so JSX's own
 * attribute-spreading stays simple; every current caller happens to use `data-col-key`, but the
 * attribute name is a prop rather than hardcoded in case a future caller needs its own.
 */
export function AddableColumnRow(props: {
  col: { key: string; label: string }
  onClick: () => void
}) {
  return (
    <button
      type="button"
      class="dt-dd-item dt-dd-item--click"
      data-dd-row
      data-col-key={props.col.key}
      onClick={props.onClick}
    >
      <span class="dt-flex1">{props.col.label}</span>
    </button>
  )
}

/**
 * Renders a `groupColumnsByCategory`-shaped `{ uncategorized, categories }` list: uncategorized
 * columns as plain rows, each category collapsed into a `CategorySubmenu` trigger — the exact
 * rendering shape Columns/Sort/Group's own column lists all need identically, differing only in
 * which row component/action `row` renders. Owns the `openCategory` exclusivity signal itself
 * (see `CategorySubmenu.tsx`'s own doc for why it must be one shared value, not one per instance)
 * so callers don't each need their own copy of it.
 */
export function CategorizedColumnList<T extends { key: string }>(props: {
  uncategorized: T[]
  categories: ColumnCategory<T>[]
  row: (col: T) => JSX.Element
}) {
  const [openCategory, setOpenCategory] = createSignal<string | null>(null)
  return (
    <>
      <For each={props.uncategorized}>{(col) => props.row(col)}</For>
      <For each={props.categories}>
        {(category) => (
          <CategorySubmenu
            name={category.name}
            isOpen={openCategory() === category.name}
            onOpen={() => setOpenCategory(category.name)}
            onClose={() => setOpenCategory((c) => (c === category.name ? null : c))}
          >
            <For each={category.columns}>{(col) => props.row(col)}</For>
          </CategorySubmenu>
        )}
      </For>
    </>
  )
}

/** The `.dt-dd-search-row`/`.dt-dd-search` box every dropdown with an addable/available list has. */
export function DropdownSearchRow(props: {
  value: string
  onInput: (value: string) => void
  placeholder: string
}) {
  return (
    <div class="dt-dd-search-row">
      <input
        type="text"
        class="dt-dd-search"
        data-dd-search
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </div>
  )
}

/** Sort/Group/Filter's shared toolbar-button "×" clear affordance (see CLAUDE.md's "Toolbar clear
 * buttons") — rendered as a `Dropdown` `extraTrigger`, so it stays a sibling of the trigger button
 * rather than nested inside it. Columns has no equivalent (never had a "clear everything" concept
 * for its own dropdown), so it isn't a caller of this. */
export function DropdownClearButton(props: { show: boolean; label: string; onClear: () => void }) {
  return (
    <Show when={props.show}>
      <button
        type="button"
        class="dt-btn-clear"
        title={props.label}
        aria-label={props.label}
        onClick={props.onClear}
      >
        ×
      </button>
    </Show>
  )
}

/** Sort/Group/Filter's shared toolbar trigger button — plain when inactive, `dt-btn--active
 * dt-btn--grouped` (squared-off right corner, to visually merge with `DropdownClearButton`'s own
 * left corner) once that dropdown has anything active. Columns' own trigger never has an "active"
 * indicator, so it renders its own plain `<button>` instead of using this. */
export function DropdownTriggerButton(props: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      class={`dt-btn${props.active ? ' dt-btn--active dt-btn--grouped' : ''}`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}
