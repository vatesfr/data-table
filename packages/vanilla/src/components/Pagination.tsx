import { For, Show } from 'solid-js'
import { mergePageSizeOptions } from '@vates/data-table-core'
import type { TableState } from '../createTableState'

interface PaginationProps<TRow extends object> {
  table: TableState<TRow>
}

export function Pagination<TRow extends object>(props: PaginationProps<TRow>) {
  const { table } = props
  const clampedPage = () => Math.min(table.page(), table.numPages())

  return (
    <Show when={table.pageSize() > 0}>
      <div class="dt-pagination">
        <button
          type="button"
          class="dt-page-btn"
          disabled={clampedPage() === 1}
          onClick={() => table.setPage(1)}
        >
          «
        </button>
        <button
          type="button"
          class="dt-page-btn"
          disabled={clampedPage() === 1}
          onClick={() => table.setPage(clampedPage() - 1)}
        >
          ‹
        </button>
        <span class="dt-page-info">{table.L.pageOf(clampedPage(), table.numPages())}</span>
        <button
          type="button"
          class="dt-page-btn"
          disabled={clampedPage() >= table.numPages()}
          onClick={() => table.setPage(clampedPage() + 1)}
        >
          ›
        </button>
        <button
          type="button"
          class="dt-page-btn"
          disabled={clampedPage() >= table.numPages()}
          onClick={() => table.setPage(table.numPages())}
        >
          »
        </button>
        <span class="dt-rows-per-page-group">
          <span class="dt-rows-per-page">{table.L.rowsPerPage}:</span>
          <select
            class="dt-page-select"
            value={table.pageSize()}
            onChange={(e) => table.setPageSize(Number(e.currentTarget.value))}
          >
            <For each={mergePageSizeOptions([10, 20, 50, 100], table.pageSize())}>
              {(n) => <option value={n}>{n}</option>}
            </For>
          </select>
        </span>
      </div>
    </Show>
  )
}
