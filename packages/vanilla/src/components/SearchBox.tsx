import type { TableState } from '../createTableState'

interface SearchBoxProps<TRow extends object> {
  table: TableState<TRow>
}

// First real Solid component of the migration (see CLAUDE.md's "Solid + TSX migration" note) —
// deliberately the smallest self-contained toolbar slice, to validate createTableState.ts through
// an actual component before building the larger dropdown/table-body pieces.
//
// Markup/classes match the existing string-built toolbar exactly (dt-search-wrap/dt-search-input/
// dt-search-clear) so styles.ts's CSS applies unchanged. Unlike the old render(), there is no
// data-focus-key/selection-range restore here at all — Solid reuses this same <input> DOM node
// across every re-render (it's the direct fix for the numeric-range caret bug from earlier: the
// same class of issue can no longer occur here, by construction).
export function SearchBox<TRow extends object>(props: SearchBoxProps<TRow>) {
  const { table } = props
  return (
    <span class="dt-search-wrap">
      <input
        type="text"
        class="dt-search-input"
        placeholder={table.L.search}
        value={table.searchQuery()}
        onInput={(e) => table.setSearchQuery(e.currentTarget.value)}
      />
      {table.searchQuery() !== '' && (
        <button
          type="button"
          class="dt-search-clear"
          title={table.L.clearSearch}
          aria-label={table.L.clearSearch}
          onClick={() => table.setSearchQuery('')}
        >
          ×
        </button>
      )}
    </span>
  )
}
