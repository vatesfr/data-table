import { For, Show } from 'solid-js'
import { mergePageSizeOptions } from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'

interface PaginationProps<TRow extends object> {
  table: TableState<TRow>
}

export function Pagination<TRow extends object>(props: PaginationProps<TRow>) {
  const { table } = props

  return (
    <Show when={table.pagination.pageSize() > 0}>
      <div class="dt-pagination">
        <button
          type="button"
          class="dt-page-btn"
          disabled={table.pagination.page() === 1}
          onClick={() => table.pagination.setPage(1)}
        >
          «
        </button>
        <button
          type="button"
          class="dt-page-btn"
          disabled={table.pagination.page() === 1}
          onClick={() => table.pagination.setPage(table.pagination.page() - 1)}
        >
          ‹
        </button>
        <span class="dt-page-info">
          {table.labels().pageOf(table.pagination.page(), table.pagination.numPages())}
        </span>
        <button
          type="button"
          class="dt-page-btn"
          disabled={table.pagination.page() >= table.pagination.numPages()}
          onClick={() => table.pagination.setPage(table.pagination.page() + 1)}
        >
          ›
        </button>
        <button
          type="button"
          class="dt-page-btn"
          disabled={table.pagination.page() >= table.pagination.numPages()}
          onClick={() => table.pagination.setPage(table.pagination.numPages())}
        >
          »
        </button>
        <span class="dt-rows-per-page-group">
          <span class="dt-rows-per-page">{table.labels().rowsPerPage}:</span>
          <select
            class="dt-page-select"
            value={table.pagination.pageSize()}
            onChange={(e) => table.pagination.setPageSize(Number(e.currentTarget.value))}
          >
            <For each={mergePageSizeOptions([10, 20, 50, 100], table.pagination.pageSize())}>
              {(n) => <option value={n}>{n}</option>}
            </For>
          </select>
        </span>
      </div>
    </Show>
  )
}
