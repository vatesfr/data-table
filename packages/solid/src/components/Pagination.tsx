import { For, Show } from 'solid-js'
import { pageSizeOptions, showsPager } from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'

interface PaginationProps<TRow extends object> {
  table: TableState<TRow>
}

export function Pagination<TRow extends object>(props: PaginationProps<TRow>) {
  const { table } = props
  const pageSizes = () => pageSizeOptions(table.pagination.pageSize())

  return (
    <Show
      when={table.pagination.pageSize() > 0 && showsPager(table.visibleItems().length, pageSizes())}
    >
      <div class="dt-pagination">
        <Show when={table.pagination.numPages() > 1}>
          <button
            type="button"
            class="dt-page-btn"
            disabled={table.pagination.page() === 1}
            aria-label={table.labels().firstPage}
            onClick={() => table.pagination.setPage(1)}
          >
            «
          </button>
          <button
            type="button"
            class="dt-page-btn"
            disabled={table.pagination.page() === 1}
            aria-label={table.labels().previousPage}
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
            aria-label={table.labels().nextPage}
            onClick={() => table.pagination.setPage(table.pagination.page() + 1)}
          >
            ›
          </button>
          <button
            type="button"
            class="dt-page-btn"
            disabled={table.pagination.page() >= table.pagination.numPages()}
            aria-label={table.labels().lastPage}
            onClick={() => table.pagination.setPage(table.pagination.numPages())}
          >
            »
          </button>
        </Show>
        <label class="dt-rows-per-page-group">
          <span class="dt-rows-per-page">{table.labels().rowsPerPage}:</span>
          <select
            class="dt-page-select"
            value={table.pagination.pageSize()}
            onChange={(e) => table.pagination.setPageSize(Number(e.currentTarget.value))}
          >
            <For each={pageSizes()}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
      </div>
    </Show>
  )
}
