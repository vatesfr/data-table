# @vates/flexi-table-core

Framework-agnostic core logic for [flexi-table](../../README.md). Zero runtime dependencies.

You don't need this package directly if you're using `@vates/flexi-table-react` or `@vates/flexi-table-vue` — it is bundled into both adapters. Use it only if you're building your own adapter.

## What's inside

### Types

```ts
ColumnDefBase<TRow extends object>  // column definition (key, label, type, format, sortable, …)
SortEntry                           // { key: string; dir: 'asc' | 'desc' }
RangeFilter                         // { min: string; max: string }
DataTableLabels                     // all UI strings + 4 pluralization functions
DEFAULT_LABELS                      // English defaults (alias for LABELS_EN)
LABELS_EN                           // English
LABELS_FR                           // French
LABELS_ES                           // Spanish
LABELS_DE                           // German
LABELS_PT                           // Portuguese
```

### Pure functions

```ts
processData(data, filters, rangeFilters, sorts) // filter + sort rows
groupData(rows, groupBy) // group sorted rows
computeStringValues(data, columns) // build filter value lists
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
