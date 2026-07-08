import {
  processData,
  searchData,
  groupData,
  computeStringValues,
  computeAggregate,
  paginateData,
  calcTotalPages,
  toggleSort as coreToggleSort,
  toggleFilter as coreToggleFilter,
  toggleGroupBy,
  toggleCollapse,
  getSortIcon,
  getSortIndex,
  countActiveFilters,
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableOptions, DataTableInstance } from './types'
import { STYLES } from './styles'

export type { ColumnDef, DataTableOptions, DataTableInstance }
export type { DataTableLabels } from '@vates/data-table-core'
export * from '@vates/data-table-core/locales'

// --- Styles ---

let stylesInjected = false
function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const s = document.createElement('style')
  s.dataset.dtStyles = ''
  s.textContent = STYLES
  document.head.insertBefore(s, document.head.firstChild)
}

// --- HTML helpers ---

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDd(isOpen: boolean, trigger: string, contentFn: () => string): string {
  return `<div class="dt-dd-wrap">${trigger}${isOpen ? `<div class="dt-dd">${contentFn()}</div>` : ''}</div>`
}

// --- Factory ---

export function createDataTable<TRow extends object>(
  container: HTMLElement,
  options: DataTableOptions<TRow>,
): DataTableInstance<TRow> {
  injectStyles()

  let data = options.data
  let columns = options.columns
  const { rowKey, selectable = false, onSelectionChange, onRowClick } = options
  const L: DataTableLabels = { ...DEFAULT_LABELS, ...options.labels }

  let sorts: SortEntry[] = []
  let filters: Record<string, Set<string>> = {}
  let rangeFilters: Record<string, RangeFilter> = {}
  let groupBy: string[] = []
  let collapsedGroups = new Set<string>()
  let page = 1
  let pageSize = options.defaultPageSize ?? 0
  let visibleCols = new Set<string>(options.defaultVisibleColumns ?? columns.map((c) => c.key))
  let selection = new Set<TRow>()
  let openDropdown: string | null = null
  let searchQuery = ''

  // Updated by derive(), read by event handlers
  let _processedData: TRow[] = []
  let _groupedData: Array<{ key: string | null; keyParts: string[]; rows: TRow[] }> = []
  let _numPages = 1
  let _clampedPage = 1

  function derive() {
    const stringValueMap = computeStringValues(data, columns, L.emptyValue)
    _processedData = processData(
      searchData(data, searchQuery, columns),
      filters,
      rangeFilters,
      sorts,
      columns,
      L.emptyValue,
    )
    _numPages = calcTotalPages(_processedData.length, pageSize)
    _clampedPage = Math.min(page, Math.max(1, _numPages))
    const pagedData = paginateData(_processedData, _clampedPage, pageSize)
    _groupedData = groupData(pagedData, groupBy, L.emptyValue)
    const activeColumns = columns.filter((c) => visibleCols.has(c.key) && !groupBy.includes(c.key))
    const activeFilterCount = countActiveFilters(filters, rangeFilters)
    const selectedRows = _processedData.filter((r) => selection.has(r))
    return { stringValueMap, activeColumns, activeFilterCount, selectedRows }
  }

  function formatStr(v: unknown, row: TRow, col: ColumnDef<TRow>): string {
    if (col.format) return esc(col.format(v, row))
    if (Array.isArray(v)) return esc(v.join(', '))
    return esc(v != null ? String(v) : '')
  }

  function aggStr(col: ColumnDef<TRow>, rows: TRow[]): string {
    const v = computeAggregate(col, rows)
    if (v === undefined || v === null) return ''
    return formatStr(v, rows[0], col)
  }

  function cellStr(row: TRow, col: ColumnDef<TRow>): string {
    return formatStr((row as Record<string, unknown>)[col.key], row, col)
  }

  function render(): void {
    // Save focus state
    const focused = document.activeElement as HTMLElement | null
    const focusKey =
      focused && container.contains(focused) ? (focused.dataset.focusKey ?? null) : null
    const selStart = focused instanceof HTMLInputElement ? focused.selectionStart : null
    const selEnd = focused instanceof HTMLInputElement ? focused.selectionEnd : null

    const { stringValueMap, activeColumns, activeFilterCount, selectedRows } = derive()

    const allSelected = _processedData.length > 0 && selectedRows.length === _processedData.length
    const someSelected = selectedRows.length > 0 && !allSelected
    const hasActiveState =
      sorts.length > 0 || activeFilterCount > 0 || groupBy.length > 0 || searchQuery !== ''
    const hasAgg = activeColumns.some((c) => c.aggregate !== undefined)
    const numericFilterCols = columns.filter((c) => c.type === 'number' && c.filterable !== false)
    const stringFilterCols = columns.filter(
      (c) => c.type !== 'number' && c.type !== 'date' && c.filterable !== false,
    )
    const groupableCols = columns.filter((c) => c.groupable === true)

    let html = `<div class="dt">`

    // --- Toolbar ---
    html += `<div class="dt-toolbar">`

    // Columns
    html += buildDd(
      openDropdown === 'cols',
      `<button class="dt-btn${openDropdown === 'cols' ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="cols">${esc(L.columns)}</button>`,
      () => {
        let s = `<div class="dt-dd-section">${esc(L.columnsSection)}</div>`
        for (const col of columns) {
          s += `<label class="dt-dd-item"><input type="checkbox" data-action="toggle-col" data-key="${esc(col.key)}"${visibleCols.has(col.key) ? ' checked' : ''}> ${esc(col.label)}</label>`
        }
        return s
      },
    )

    // Sort
    html += buildDd(
      openDropdown === 'sort',
      `<button class="dt-btn${sorts.length > 0 ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="sort">${esc(L.sort)}${sorts.length > 0 ? ` <span class="dt-chip">${sorts.length}</span>` : ''}</button>`,
      () => {
        let s = `<div class="dt-dd-section">${esc(L.sortSection)}</div>`
        for (const col of columns) {
          const sortIdx = getSortIndex(sorts, col.key)
          s += `<div class="dt-dd-item dt-dd-item--click" data-action="toggle-sort" data-key="${esc(col.key)}"><span class="dt-sort-idx">${sortIdx ?? ''}</span><span style="flex:1">${esc(col.label)}</span><span class="dt-sort-icon${sortIdx ? ' dt-sort-icon--active' : ''}">${getSortIcon(sorts, col.key)}</span></div>`
        }
        if (sorts.length > 0) {
          s += `<div class="dt-dd-footer"><button class="dt-clear-btn" data-action="clear-sorts">${esc(L.clearSorts)}</button></div>`
        }
        return s
      },
    )

    // Filter
    if (stringFilterCols.length > 0 || numericFilterCols.length > 0) {
      html += buildDd(
        openDropdown === 'filter',
        `<button class="dt-btn${activeFilterCount > 0 ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="filter">${esc(L.filter)}${activeFilterCount > 0 ? ` <span class="dt-chip">${activeFilterCount}</span>` : ''}</button>`,
        () => {
          let s = `<div style="max-height:380px;overflow-y:auto;min-width:240px">`
          for (const col of stringFilterCols) {
            s += `<div class="dt-dd-section">${esc(col.label)}</div>`
            for (const v of stringValueMap[col.key] ?? []) {
              s += `<label class="dt-dd-item"><input type="checkbox" data-action="toggle-filter" data-key="${esc(col.key)}" data-value="${esc(v)}"${filters[col.key]?.has(v) ? ' checked' : ''}> ${esc(v)}</label>`
            }
          }
          if (numericFilterCols.length > 0) {
            s += `<div class="dt-dd-section">${esc(L.numericRanges)}</div>`
            for (const col of numericFilterCols) {
              const rf = rangeFilters[col.key]
              s += `<div style="padding:4px 14px 8px"><div class="dt-dd-sublabel">${esc(col.label)}</div>`
              s += `<div style="display:flex;gap:6px;align-items:center">`
              s += `<input type="number" class="dt-range-input" placeholder="${esc(L.min)}" value="${esc(rf?.min ?? '')}" data-action="range-min" data-key="${esc(col.key)}" data-focus-key="rmin-${esc(col.key)}">`
              s += `<span class="dt-range-sep">–</span>`
              s += `<input type="number" class="dt-range-input" placeholder="${esc(L.max)}" value="${esc(rf?.max ?? '')}" data-action="range-max" data-key="${esc(col.key)}" data-focus-key="rmax-${esc(col.key)}">`
              s += `</div></div>`
            }
          }
          if (activeFilterCount > 0) {
            s += `<div class="dt-dd-footer"><button class="dt-clear-btn" data-action="clear-filters">${esc(L.clearFilters)}</button></div>`
          }
          s += `</div>`
          return s
        },
      )
    }

    // Group
    if (groupableCols.length > 0) {
      html += buildDd(
        openDropdown === 'group',
        `<button class="dt-btn${groupBy.length > 0 ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="group">${esc(L.group)}${groupBy.length > 0 ? ` <span class="dt-chip">${groupBy.length}</span>` : ''}</button>`,
        () => {
          let s = `<div class="dt-dd-section">${esc(L.groupSection)}</div>`
          for (const col of groupableCols) {
            const gIdx = groupBy.indexOf(col.key)
            s += `<div class="dt-dd-item dt-dd-item--click" data-action="toggle-group" data-key="${esc(col.key)}"><span class="dt-sort-idx">${gIdx >= 0 ? gIdx + 1 : ''}</span><span style="flex:1">${esc(col.label)}</span>${groupBy.includes(col.key) ? '<span>✓</span>' : ''}</div>`
          }
          if (groupBy.length > 0) {
            s += `<div class="dt-dd-footer"><button class="dt-clear-btn" data-action="clear-groups">${esc(L.clearGroups)}</button></div>`
          }
          return s
        },
      )
    }

    html += `<input type="text" class="dt-search-input" placeholder="${esc(L.search)}" value="${esc(searchQuery)}" data-action="search" data-focus-key="search">`

    if (hasActiveState) {
      html += `<button class="dt-btn" data-action="clear-all" style="margin-left:4px">${esc(L.clearAll)}</button>`
    }

    html += `<span class="dt-stats">${esc(L.rowCount(_processedData.length, data.length))}${groupBy.length > 0 ? esc(L.groupCount(_groupedData.length)) : ''}</span>`
    html += `</div>` // toolbar

    // --- Active chips ---
    if (hasActiveState) {
      html += `<div class="dt-chips">`
      for (const s of sorts) {
        html += `<span class="dt-chip">${sorts.indexOf(s) + 1}. ${esc(columns.find((c) => c.key === s.key)?.label ?? s.key)} ${s.dir === 'asc' ? '↑' : '↓'} <span class="dt-chip-x" data-action="remove-sort" data-key="${esc(s.key)}">×</span></span>`
      }
      for (const [key, vals] of Object.entries(filters)) {
        if (!vals.size) continue
        html += `<span class="dt-chip dt-chip--filter">${esc(columns.find((c) => c.key === key)?.label ?? key)}: ${esc([...vals].join(', '))} <span class="dt-chip-x" data-action="clear-filter-key" data-key="${esc(key)}">×</span></span>`
      }
      for (let i = 0; i < groupBy.length; i++) {
        const key = groupBy[i]
        html += `<span class="dt-chip dt-chip--group">${esc(L.groupLabel(i + 1))}: ${esc(columns.find((c) => c.key === key)?.label ?? key)} <span class="dt-chip-x" data-action="remove-group" data-key="${esc(key)}">×</span></span>`
      }
      html += `</div>`
    }

    // --- Table ---
    html += `<div class="dt-table-wrap"><table class="dt-table"><thead><tr>`
    if (selectable) {
      html += `<th class="dt-th dt-th--no-sort" style="width:36px"><input type="checkbox" data-action="select-all"${allSelected ? ' checked' : ''}></th>`
    }
    if (groupBy.length > 0) {
      html += `<th class="dt-th dt-th--no-sort" style="width:28px"></th>`
    }
    for (const col of activeColumns) {
      const sortIdx = getSortIndex(sorts, col.key)
      html += `<th class="dt-th"${col.width ? ` style="width:${col.width}px"` : ''} data-action="toggle-sort" data-key="${esc(col.key)}"><span class="dt-th-inner">${esc(col.label)} <span class="dt-sort-icon${sortIdx ? ' dt-sort-icon--active' : ''}">${sortIdx ? `${sortIdx}${getSortIcon(sorts, col.key)}` : '↕'}</span></span></th>`
    }
    html += `</tr></thead><tbody>`

    const procIdxMap = new Map(_processedData.map((r, i) => [r, i]))

    for (const { key: gkey, keyParts, rows } of _groupedData) {
      if (gkey !== null) {
        const isCollapsed = collapsedGroups.has(gkey)
        const gAllSel = rows.length > 0 && rows.every((r) => selection.has(r))
        html += `<tr class="dt-group-row" data-action="toggle-group-collapse" data-gkey="${esc(gkey)}">`
        if (selectable) {
          // data-no-collapse prevents this td click from triggering the row collapse
          html += `<td class="dt-group-td" style="width:36px" data-no-collapse><input type="checkbox" data-action="toggle-group-select" data-gkey="${esc(gkey)}"${gAllSel ? ' checked' : ''}></td>`
        }
        html += `<td class="dt-group-td" style="width:28px">${isCollapsed ? '▶' : '▼'}</td>`
        html += `<td class="dt-group-td" colspan="${activeColumns.length}">`
        for (let gi = 0; gi < groupBy.length; gi++) {
          const gColKey = groupBy[gi]
          const gCol = columns.find((c) => c.key === gColKey)
          const raw = (rows[0] as Record<string, unknown>)[gColKey]
          const value = Array.isArray(raw) ? keyParts[gi] : raw
          if (gi > 0) html += `<span class="dt-group-sep"> › </span>`
          html += `<span class="dt-group-colname">${esc(gCol?.label ?? gColKey)}:</span> `
          html += gCol ? formatStr(value, rows[0], gCol) : esc(String(value ?? ''))
        }
        html += ` <span class="dt-group-count">${esc(L.rowsInGroup(rows.length))}</span></td></tr>`

        if (hasAgg) {
          html += `<tr class="dt-agg-row">`
          if (selectable) html += `<td class="dt-agg-td" style="width:36px"></td>`
          html += `<td class="dt-agg-td" style="width:28px"></td>`
          for (const col of activeColumns) {
            html += `<td class="dt-agg-td">${aggStr(col, rows)}</td>`
          }
          html += `</tr>`
        }

        if (!isCollapsed) {
          for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri]
            const procIdx = procIdxMap.get(row) ?? -1
            const isSelected = selection.has(row)
            const trClass = `dt-tr${isSelected ? ' dt-tr--selected' : ri % 2 !== 0 ? ' dt-tr--odd' : ''}${onRowClick ? ' dt-tr--clickable' : ''}`
            const rk = rowKey ? String((row as Record<string, unknown>)[rowKey] ?? ri) : ri
            html += `<tr class="${trClass}" data-row-key="${esc(rk)}" data-action="row-click" data-proc-idx="${procIdx}">`
            if (selectable) {
              html += `<td class="dt-td" style="width:36px" data-no-row-click><input type="checkbox" data-action="toggle-row-select" data-proc-idx="${procIdx}"${isSelected ? ' checked' : ''}></td>`
            }
            html += `<td class="dt-td" style="width:28px"></td>`
            for (const col of activeColumns) {
              html += `<td class="dt-td">${cellStr(row, col)}</td>`
            }
            html += `</tr>`
          }
        }
      } else {
        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri]
          const procIdx = procIdxMap.get(row) ?? -1
          const isSelected = selection.has(row)
          const trClass = `dt-tr${isSelected ? ' dt-tr--selected' : ri % 2 !== 0 ? ' dt-tr--odd' : ''}${onRowClick ? ' dt-tr--clickable' : ''}`
          const rk = rowKey ? String((row as Record<string, unknown>)[rowKey] ?? ri) : ri
          html += `<tr class="${trClass}" data-row-key="${esc(rk)}" data-action="row-click" data-proc-idx="${procIdx}">`
          if (selectable) {
            html += `<td class="dt-td" style="width:36px" data-no-row-click><input type="checkbox" data-action="toggle-row-select" data-proc-idx="${procIdx}"${isSelected ? ' checked' : ''}></td>`
          }
          for (const col of activeColumns) {
            html += `<td class="dt-td">${cellStr(row, col)}</td>`
          }
          html += `</tr>`
        }
      }
    }

    html += `</tbody></table></div>`

    // --- Pagination ---
    if (pageSize > 0) {
      html += `<div class="dt-pagination">`
      html += `<button class="dt-page-btn" data-action="page-first"${_clampedPage === 1 ? ' disabled' : ''}>«</button>`
      html += `<button class="dt-page-btn" data-action="page-prev"${_clampedPage === 1 ? ' disabled' : ''}>‹</button>`
      html += `<span class="dt-page-info">${esc(L.pageOf(_clampedPage, _numPages))}</span>`
      html += `<button class="dt-page-btn" data-action="page-next"${_clampedPage >= _numPages ? ' disabled' : ''}>›</button>`
      html += `<button class="dt-page-btn" data-action="page-last"${_clampedPage >= _numPages ? ' disabled' : ''}>»</button>`
      html += `<span class="dt-rows-per-page">${esc(L.rowsPerPage)}:</span>`
      html += `<select class="dt-page-select" data-action="set-page-size">`
      for (const n of [10, 20, 50, 100]) {
        html += `<option value="${n}"${pageSize === n ? ' selected' : ''}>${n}</option>`
      }
      html += `</select></div>`
    }

    html += `</div>` // .dt

    container.innerHTML = html

    // Fix indeterminate checkboxes (not settable via HTML attribute)
    if (selectable) {
      if (someSelected) {
        const cb = container.querySelector<HTMLInputElement>('[data-action="select-all"]')
        if (cb) cb.indeterminate = true
      }
      for (const { key: gkey, rows } of _groupedData) {
        if (gkey === null) continue
        const gAllSel = rows.every((r) => selection.has(r))
        const gSomeSel = !gAllSel && rows.some((r) => selection.has(r))
        if (gSomeSel) {
          for (const cb of container.querySelectorAll<HTMLInputElement>(
            '[data-action="toggle-group-select"]',
          )) {
            if (cb.dataset.gkey === gkey) {
              cb.indeterminate = true
              break
            }
          }
        }
      }
    }

    // Restore focus
    if (focusKey) {
      for (const el of container.querySelectorAll<HTMLElement>('[data-focus-key]')) {
        if (el.dataset.focusKey === focusKey) {
          el.focus()
          if (el instanceof HTMLInputElement && selStart !== null) {
            el.setSelectionRange(selStart, selEnd ?? selStart)
          }
          break
        }
      }
    }
  }

  // --- Event handlers ---

  function handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    const actionEl = target.closest('[data-action]') as HTMLElement | null

    // Close dropdown when clicking outside a dd-wrap
    if (openDropdown !== null && !target.closest('.dt-dd-wrap')) {
      openDropdown = null
      if (!actionEl) {
        render()
        return
      }
    }

    if (!actionEl) return

    const action = actionEl.dataset.action!
    const key = actionEl.dataset.key ?? ''
    const dd = actionEl.dataset.dd ?? ''
    const value = actionEl.dataset.value ?? ''
    const gkey = actionEl.dataset.gkey ?? ''
    const procIdx = parseInt(actionEl.dataset.procIdx ?? '-1', 10)

    let selectionChanged = false

    switch (action) {
      case 'toggle-dd':
        openDropdown = openDropdown === dd ? null : dd
        break
      case 'toggle-sort':
        sorts = coreToggleSort(sorts, key)
        break
      case 'remove-sort':
        sorts = sorts.filter((s) => s.key !== key)
        break
      case 'toggle-col': {
        const next = new Set(visibleCols)
        if (next.has(key)) {
          if (next.size > 1) next.delete(key)
        } else next.add(key)
        visibleCols = next
        break
      }
      case 'toggle-filter':
        filters = coreToggleFilter(filters, key, value)
        page = 1
        break
      case 'toggle-group':
        groupBy = toggleGroupBy(groupBy, key)
        break
      case 'remove-group':
        groupBy = groupBy.filter((k) => k !== key)
        break
      case 'toggle-group-collapse':
        if (!target.closest('[data-no-collapse]')) {
          collapsedGroups = toggleCollapse(collapsedGroups, gkey)
        }
        break
      case 'clear-sorts':
        sorts = []
        break
      case 'clear-filters':
        filters = {}
        rangeFilters = {}
        page = 1
        break
      case 'clear-groups':
        groupBy = []
        collapsedGroups = new Set()
        break
      case 'clear-filter-key':
        filters = { ...filters, [key]: new Set() }
        page = 1
        break
      case 'clear-all':
        sorts = []
        filters = {}
        rangeFilters = {}
        groupBy = []
        collapsedGroups = new Set()
        page = 1
        searchQuery = ''
        openDropdown = null
        break
      case 'select-all': {
        const next = new Set(selection)
        const allSel = _processedData.length > 0 && _processedData.every((r) => next.has(r))
        if (allSel) _processedData.forEach((r) => next.delete(r))
        else _processedData.forEach((r) => next.add(r))
        selection = next
        selectionChanged = true
        break
      }
      case 'toggle-row-select': {
        if (procIdx >= 0 && procIdx < _processedData.length) {
          const row = _processedData[procIdx]
          const next = new Set(selection)
          if (next.has(row)) next.delete(row)
          else next.add(row)
          selection = next
          selectionChanged = true
        }
        break
      }
      case 'toggle-group-select': {
        const group = _groupedData.find((g) => g.key === gkey)
        if (group) {
          const groupRows = group.rows
          const next = new Set(selection)
          const allSel = groupRows.length > 0 && groupRows.every((r) => next.has(r))
          if (allSel) groupRows.forEach((r) => next.delete(r))
          else groupRows.forEach((r) => next.add(r))
          selection = next
          selectionChanged = true
        }
        break
      }
      case 'page-first':
        page = 1
        break
      case 'page-prev':
        page = Math.max(1, _clampedPage - 1)
        break
      case 'page-next':
        page = Math.min(_numPages, _clampedPage + 1)
        break
      case 'page-last':
        page = _numPages
        break
      case 'row-click':
        if (
          !target.closest('[data-no-row-click]') &&
          procIdx >= 0 &&
          procIdx < _processedData.length
        ) {
          onRowClick?.(_processedData[procIdx], e)
        }
        return
      default:
        return
    }

    render()

    if (selectionChanged) {
      onSelectionChange?.(_processedData.filter((r) => selection.has(r)))
    }
  }

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement
    const action = target.dataset.action
    if (action === 'search') {
      searchQuery = target.value
      page = 1
      render()
      return
    }
    if (action !== 'range-min' && action !== 'range-max') return
    const key = target.dataset.key ?? ''
    const field = action === 'range-min' ? 'min' : 'max'
    rangeFilters = {
      ...rangeFilters,
      [key]: {
        min: rangeFilters[key]?.min ?? '',
        max: rangeFilters[key]?.max ?? '',
        [field]: target.value,
      },
    }
    page = 1
    render()
  }

  function handleChange(e: Event): void {
    const target = e.target as HTMLSelectElement
    if (target.dataset.action !== 'set-page-size') return
    pageSize = Number(target.value)
    page = 1
    render()
  }

  function handleDocClick(e: MouseEvent): void {
    // composedPath() captures the dispatch-time path, so it stays correct even
    // after innerHTML re-renders detach the original target from the DOM.
    if (openDropdown !== null && !e.composedPath().includes(container)) {
      openDropdown = null
      render()
    }
  }

  container.addEventListener('click', handleClick)
  container.addEventListener('input', handleInput)
  container.addEventListener('change', handleChange)
  document.addEventListener('click', handleDocClick)

  render()

  return {
    setData(newData: TRow[]): void {
      data = newData
      render()
    },
    setColumns(newCols: ColumnDef<TRow>[]): void {
      columns = newCols
      render()
    },
    destroy(): void {
      container.removeEventListener('click', handleClick)
      container.removeEventListener('input', handleInput)
      container.removeEventListener('change', handleChange)
      document.removeEventListener('click', handleDocClick)
      container.innerHTML = ''
    },
  }
}
