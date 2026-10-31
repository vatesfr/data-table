import { Show } from 'solid-js'
import type { TableState } from '../createTableState'

interface SearchBoxProps<TRow extends object> {
  table: TableState<TRow>
}

// Focus target after a clear button unmounts itself: the search box, else the first toolbar button.
// Takes the table root, looked up before clearing: Solid detaches the button synchronously.
export function focusSearch(root: Element | null): void {
  ;(root?.querySelector<HTMLElement>('.dt-search-input') ?? root?.querySelector('button'))?.focus()
}

export function SearchBox<TRow extends object>(props: SearchBoxProps<TRow>) {
  const { table } = props
  return (
    <span class="dt-search-wrap">
      <input
        type="text"
        class="dt-search-input"
        placeholder={table.labels().search}
        value={table.search.query()}
        onInput={(e) => table.search.setQuery(e.currentTarget.value)}
      />
      <Show when={table.search.query() !== ''}>
        <button
          type="button"
          class="dt-search-clear"
          title={table.labels().clearSearch}
          aria-label={table.labels().clearSearch}
          onClick={(e) => {
            const root = e.currentTarget.closest('.dt')
            table.search.setQuery('')
            focusSearch(root)
          }}
        >
          ×
        </button>
      </Show>
    </span>
  )
}
