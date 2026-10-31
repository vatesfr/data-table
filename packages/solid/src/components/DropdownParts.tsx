import { For, Show, createSignal, type JSX } from 'solid-js'
import type { ColumnCategory } from '@vates/data-table-core/internal'
import { CategorySubmenu } from './CategorySubmenu'

// Presentational pieces shared by the Columns/Sort/Group/Filter dropdowns; callers pass every action

/**
 * An addable-column row (Sort/Group/Columns), carrying `data-col-key` for refocus lookups.
 * `showCategory` tags it with `col.category` where search flattened it out of its submenu.
 */
export function AddableColumnRow(props: {
  col: { key: string; label: string; category?: string }
  onClick: () => void
  showCategory?: boolean
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
      <Show when={props.showCategory && props.col.category}>
        <span class="dt-dd-item-category">{props.col.category}</span>
      </Show>
    </button>
  )
}

/**
 * A `groupColumnsByCategory` list: plain rows, then one `CategorySubmenu` per category, with the
 * shared open-category signal.
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

/** Stands in for a column list that a search narrowed to nothing (U26) */
export function NoMatchingColumns(props: { when: boolean; label: string }) {
  return (
    <Show when={props.when}>
      <div class="dt-dd-no-match" data-dd-no-match>
        {props.label}
      </div>
    </Show>
  )
}

/** A dropdown's search box, with a `×` clear button (`clearLabel`) once `value` is non-empty */
export function DropdownSearchRow(props: {
  value: string
  onInput: (value: string) => void
  placeholder: string
  clearLabel: string
}) {
  return (
    <div class="dt-dd-search-row">
      <span class="dt-dd-search-wrap">
        <input
          type="text"
          class="dt-dd-search"
          data-dd-search
          placeholder={props.placeholder}
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
        />
        <Show when={props.value}>
          <button
            type="button"
            class="dt-dd-search-clear"
            title={props.clearLabel}
            aria-label={props.clearLabel}
            onClick={() => props.onInput('')}
          >
            ×
          </button>
        </Show>
      </span>
    </div>
  )
}

/** Sort/Group/Filter's toolbar `×` clear button, a `Dropdown` `extraTrigger` (docs/toolbar.md) */
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

/** Sort/Group/Filter's toolbar trigger, squared off on the right to merge with the clear button while active */
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
