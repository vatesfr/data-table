# @vates/data-table-core

Framework-agnostic core logic for [data-table](../../README.md). Zero runtime dependencies.

You don't need this package directly if you're using `@vates/data-table-react` or `@vates/data-table-vue` — it is bundled into both adapters. Use it only if you're building your own adapter.

## What's inside

### Types

```ts
ColumnDefBase<TRow extends object>  // column definition (key, label, type, value, format, sortable, multiMode, …)
GroupResult<TRow extends object>    // { key, keyParts, rows } — one entry per group from groupData
SortEntry                           // { key: string; dir: 'asc' | 'desc' }
RangeFilter                         // { min: string; max: string }
DataTableLabels                     // all UI strings + 4 pluralization functions + emptyValue
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
toggleSort(sorts, key) // cycle asc → desc → off
toggleFilter(filters, key, value) // toggle a checklist value
toggleGroupBy(groupBy, key) // add/remove a group key
toggleCollapse(collapsed, key) // toggle a collapsed group
getSortIcon(sorts, key) // '↑' | '↓' | '↕'
getSortIndex(sorts, key) // 1-based position or null
countActiveFilters(filters, rangeFilters) // total active filter count
```

## License

MIT
