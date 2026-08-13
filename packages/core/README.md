# @vates/data-table-core

Framework-agnostic core logic for [data-table](../../README.md). Zero runtime dependencies.

You don't need this package directly if you're using `@vates/data-table-react` or `@vates/data-table-vue` — it is bundled into both adapters. Use it only if you're building your own adapter.

## What's inside

### Types

```ts
ColumnDefBase<TRow extends object>  // column definition (key, label, type, value, format, sortable, compare, multiMode, …)
GroupResult<TRow extends object>    // { key, keyParts, rows } — one entry per group from groupData
PagedGroup<TRow extends object>     // GroupResult + { continued, sampleRow } — one page's chunk from paginateVisibleGroups
SortEntry                           // { key: string; dir: 'asc' | 'desc' }
RangeFilter                         // { min: string; max: string }
ValueSort                           // { by: 'alpha' | 'count'; dir: 'asc' | 'desc' } — a filter checklist's value sort order
DataTableLabels                     // all UI strings + 4 pluralization functions + emptyValue
TableViewState                      // serializable snapshot of visibleCols/columnOrder/sorts/filters/rangeFilters/groupBy/collapsedGroups/page/pageSize/searchQuery (not selection)
DEFAULT_LABELS                      // English defaults (alias for LABELS_EN)
LABELS_EN                           // English
LABELS_FR                           // French
LABELS_ES                           // Spanish
LABELS_DE                           // German
LABELS_PT                           // Portuguese
```

### Pure functions

```ts
getColumnValue(col, row) // read a column's cell value: row[col.key], or col.value(row) if value is set
processData(data, filters, rangeFilters, sorts, columns?, emptyLabel?) // filter + sort rows; columns needed for array-valued (multiMode) filters and computed columns, emptyLabel for empty-array rows (default '(none)')
groupData(rows, groupBy, columns?, emptyLabel?) // group sorted rows; array-valued columns fan a row into one group per item, empty arrays bucket under emptyLabel; columns needed to group by a computed column
computeStringValues(data, columns, emptyLabel?) // build filter value lists; array values are flattened and deduped, empty arrays contribute emptyLabel
paginateData(data, page, pageSize) // slice rows for the current page (pageSize 0 → all)
calcTotalPages(count, pageSize) // total page count (pageSize 0 → 1)
paginateVisibleGroups(groupedFull, visibleItems, collapsedGroups, defaultCollapsed, page, pageSize) // re-chunk a page's slice of visibleItems back into PagedGroup[] for rendering, counting header rows toward the page budget
paginateVisibleItems(visibleItems, page, pageSize) // per-page slice of visibleItems for keyboard nav, with a synthetic continuation header prepended when the page starts mid-group
mergePageSizeOptions(options, pageSize) // insert pageSize into a "rows per page" option list (sorted) if it's missing, so a custom page size still shows correctly in a <select>
toggleSort(sorts, key) // cycle asc → desc → off
toggleFilter(filters, key, value) // toggle a checklist value
filterValuesBySearch(values, term) // narrow a checklist's values by a case-insensitive substring
filterValuesByRange(values, range, parseDate?) // narrow a date column's checklist/tree values to those within range's bounds (filterValuesBySearch's sibling, for the range filter above a date tree)
computeValueBounds(data, col) // a number/date column's actual min/max across data, for a range filter's slider bounds; null if no row has a parseable value
toggleFilterAll(filters, key, values) // deselect all given values if any is selected, else select all of them
sortFilterValues(values, counts, sort, compare?) // reorder a filter checklist's values by ValueSort (alphabetical or by facet count, asc/desc); compare mirrors the column's own ColumnDefBase.compare
compareMissingLast(compare?, isMissing?) // ready-made ColumnDefBase.compare that pins a value (missing data, by default) last regardless of sort direction
cycleValueSort(sort) // advance a ValueSort: alpha-asc → alpha-desc → count-desc → count-asc → alpha-asc
toggleSortDir(dir) // flip 'asc' | 'desc' (used for the date tree's own asc/desc toggle)
getValueSortIcon(sort) // compact icon for a ValueSort, e.g. 'ABC ↑' or '# ↓'
getDateSortIcon(dir) // compact icon for a date tree's sort direction, '↑' | '↓'
toggleGroupBy(groupBy, key) // add/remove a group key
toggleCollapse(collapsed, key) // toggle a collapsed group
getOrderedColumns(columns, order) // sort columns per an order array of keys; columns missing from order are appended at the end
reorderColumn(order, dragKey, targetKey, after = false) // move dragKey to just before targetKey (or just after, if after is true) (drag-and-drop)
moveColumnBy(order, key, delta) // swap key with its neighbor delta positions away (e.g. -1/+1 for up/down buttons)
moveSortBy(sorts, key, delta) // swap the sort entry for key with its neighbor delta positions away (e.g. -1/+1 for up/down buttons)
reorderSort(sorts, dragKey, targetKey, after = false) // move the sort entry keyed dragKey to just before targetKey's (or just after, if after is true) (drag-and-drop)
getSortIcon(sorts, key) // '↑' | '↓' | '↕'
getSortIndex(sorts, key) // 1-based position or null
countActiveFilters(filters, rangeFilters) // total active filter count
```

### View state

```ts
encodeViewState(view) // TableViewState -> compact, URL-safe string (base64url of a shortened JSON shape; fields at their default are omitted)
decodeViewState(encoded) // string -> TableViewState, or undefined if the input is malformed
```

## License

MIT
