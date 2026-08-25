# @vates/data-table-core

[![npm](https://img.shields.io/npm/v/@vates/data-table-core)](https://www.npmjs.com/package/@vates/data-table-core)
[![node](https://img.shields.io/node/v/@vates/data-table-core)](https://www.npmjs.com/package/@vates/data-table-core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@vates/data-table-core)](https://bundlephobia.com/package/@vates/data-table-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Framework-agnostic core logic for [data-table](../../README.md). Zero runtime dependencies.

You don't need this package directly if you're using `@vates/data-table-react`, `@vates/data-table-vue`, `@vates/data-table-solid`, or `@vates/data-table-vanilla` — it is bundled into every adapter. Use it only if you're building your own adapter.

## Public API surface

`@vates/data-table-core`'s main (`.`) entry point is deliberately small — just the types and pure helper functions a consumer of an adapter package might reasonably need directly (e.g. to build a `groupValue`/`groupFormat` bucketer, or type a custom column def). It exports exactly:

```ts
// types
;(DataTableLabels, SortEntry, RangeFilter, ColumnDefBase, ValueSort, AggregateType)
;(DatePart, LogRangeOptions, GetRowId)
TableViewState

// values
DEFAULT_LABELS
;(bucketNumericRange, formatNumericRange, numericRangeGroup)
;(bucketDatePart, formatDatePart, datePartGroup)
;(bucketLogRange, formatLogRange, logRangeGroup)
compareMissingLast

// + every named locale export from `./locales` (LABELS_EN, LABELS_FR, LABELS_ES, LABELS_DE, LABELS_PT)
```

Everything else described below the fold in this README — `processData`, `groupData`, selection/keyboard-nav/pagination helpers, `encodeViewState`/`decodeViewState`, view-persistence helpers, and more — lives in **`@vates/data-table-core/internal`** instead. That sub-path exists solely so the adapter packages can share implementation code with each other while building their own `useTableState`/`createTableState`/persistence layer; it is **not a supported public API** and may change shape without a major version bump. If you're consuming one of the adapter packages, get what you need from that adapter directly rather than reaching into `@vates/data-table-core` or `@vates/data-table-core/internal` yourself.

`@vates/data-table-core/locales` and `@vates/data-table-core/theme` are unaffected by this split — see their own sections below.

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
TableViewState                      // serializable snapshot of visibleCols/columnOrder/sorts/filters/excludeFilters/filterModes/rangeFilters/groupBy/collapsedGroups/page/pageSize/searchQuery (not selection)
DEFAULT_LABELS                      // English defaults (alias for LABELS_EN)
LABELS_EN                           // English
LABELS_FR                           // French
LABELS_ES                           // Spanish
LABELS_DE                           // German
LABELS_PT                           // Portuguese
```

### Pure functions

#### Filtering

```ts
processData(data, filters, rangeFilters, sorts, columns, emptyLabel?, excludeFilters?, filterModes?) // filter + sort rows; columns needed for array-valued (multiMode) filters and computed columns, emptyLabel for empty-array rows (default '(none)'), excludeFilters for "not one of these" values, filterModes for a per-column runtime any/all override (see setFilterMode)
computeStringValues(data, columns, emptyLabel?) // build filter value lists; array values are flattened and deduped, empty arrays contribute emptyLabel
computeStringValueCounts(data, filters, rangeFilters, columns, emptyLabel?, targetKeys?, excludeFilters?, filterModes?) // per-value facet counts (rows matching every *other* active filter); targetKeys scopes computation to just the columns needed, for performance
cycleFilterValue(filters, excludeFilters, key, value) // cycle a checklist value neutral → include → exclude → neutral
clearExcludeValues(excludeFilters, key, values) // remove values from key's exclude set, keeping cycleFilterValue's "never in both sets" invariant after a batch include action
setFilterMode(filterModes, key, mode) // set a column's runtime checklist match to 'or' (any, default) or 'and' (all) — the user-facing counterpart to ColumnDefBase.multiMode, which only ever sets the default
isMultiValueColumn(data, col, key) // true if at least one row's value for key is an array — lets a UI decide whether an any/all toggle is meaningful to show at all
filterValuesBySearch(values, term) // narrow a checklist's values by a case- and diacritic-insensitive substring
filterValuesByRange(values, range, parseDate?) // narrow a date column's checklist/tree values to those within range's bounds (filterValuesBySearch's sibling, for the range filter above a date tree)
filterValuesByCount(values, counts, selected) // drop checklist values with a facet count of 0, except already-selected ones
computeValueBounds(data, col) // a number/date column's actual min/max across data, for a range filter's slider bounds; null if no row has a parseable value
toggleFilterAll(filters, key, values) // deselect all given values if any is selected, else select all of them
setFilterValues(filters, key, values, selected) // set values for key to selected unconditionally (backs shift-click range selection)
selectRange(items, anchor, target) // contiguous run of items between anchor and target (inclusive), for shift-click range selection over a rendered list
sortFilterValues(values, counts, sort, compare?) // reorder a filter checklist's values by ValueSort (alphabetical or by facet count, asc/desc); compare mirrors the column's own ColumnDefBase.compare
cycleValueSort(sort) // advance a ValueSort: alpha-asc → alpha-desc → count-desc → count-asc → alpha-asc
toggleSortDir(dir) // flip 'asc' | 'desc' (also used for the date tree's own asc/desc toggle)
getValueSortIcon(sort) // compact icon for a ValueSort, e.g. 'ABC ↑' or '# ↓'
getDateSortIcon(dir) // compact icon for a date tree's sort direction, '↑' | '↓'
countActiveFilters(filters, rangeFilters, excludeFilters?) // total active filter count
```

See [docs/filter-dropdown.md](../../docs/filter-dropdown.md) for the full master-detail filter dropdown design.

#### Date tree / filter checklist

```ts
DateTreeNode                                          // { key, path, values, children } — one level of a type:'date' column's filter tree
computeDateTree(values, emptyLabel?, dir?, parseDate?) // group a date column's checklist values into a Year › Month › Day tree
getDateTreeNodeState(node, selected)                  // 'checked' | 'unchecked' | 'indeterminate' for a date-tree node given selected filter values
sumDateTreeNodeCount(node, counts)                    // sum facet counts (computeStringValueCounts-style) across every raw value under a node
findDateTreeNode(nodes, path)                         // depth-first lookup of a node by its path
selectDateRange(allValues, anchorNode, targetNode, parseDate?) // shift-click range selection over the tree, as a chronological interval (not rendered-row order)
computeVirtualRange(scrollTop, viewportHeight, itemHeight, totalCount, overscan?) // VirtualRange { startIndex, endIndex, offsetY, totalHeight } for a fixed-row-height windowed checklist render
getVirtualScrollTarget(scrollTop, viewportHeight, itemHeight, targetIndex) // scrollTop needed to bring targetIndex into computeVirtualRange's mounted window, or null if already visible
normalizeForSearch(s) // lowercase + strip diacritics, e.g. "Öoo" -> "ooo" (used by filterValuesBySearch and searchData)
```

#### Sorting

```ts
toggleSort(sorts, key, defaultDir?) // cycle defaultDir → opposite → off (default defaultDir 'asc', so none → asc → desc → none)
replaceSort(sorts, key, defaultDir?, groupBy?) // plain header click: sort by key alone, discarding every other *non-group* sort entry; cycles direction if key is already the sole active non-group sort. groupBy (default []) exempts a currently grouped column's own entry from the discard, and — if key itself is grouped (reachable via keepVisibleWhenGrouped) — cycles that entry in place instead
appendOrToggleSort(sorts, key, defaultDir?) // shift-click header: add key to the multi-sort, or flip its direction in place if already present — never removes it
moveSortBy(sorts, key, delta) // swap the sort entry for key with its neighbor delta positions away (e.g. -1/+1 for up/down buttons)
reorderSort(sorts, dragKey, targetKey, after = false) // move the sort entry keyed dragKey to just before targetKey (or just after, if after is true) (drag-and-drop)
getSortIcon(sorts, key) // '↑' | '↓' | '↕'
getSortIndex(sorts, key) // 1-based position or null
countActiveSorts(sorts) // sorts.length, exported for symmetry with countActiveFilters/countActiveGroups
compareMissingLast(compare?, isMissing?) // ready-made ColumnDefBase.compare that pins a value (missing data, by default) last regardless of sort direction
```

`ColumnDefBase.compare`/`defaultSortDir` (a plain, direction-naive `(a, b, dir) => number` comparator, and the direction a fresh sort starts at) are read internally by `processData`'s sort, `sortWithinGroups`, `computeStringValues`, and `sortFilterValues` — no separate function to call.

#### Grouping

```ts
GroupResult<TRow>                    // { key, keyParts, rows } — one entry per group from groupData
groupData(rows, groupBy, columns, emptyLabel?) // group sorted rows; array-valued columns fan a row into one group per item, empty arrays bucket under emptyLabel; columns needed to group by a computed column
sortWithinGroups(groups, sorts, groupBy, columns) // reorder groups by their own groupBy value and re-sort each group's rows, fixing multi-value groupBy columns having no single per-row comparable value
toggleGroupBy(groupBy, key) // add/remove a group key
insertGroupSort(sorts, prevGroupBy, key, dir?) // called when a column is newly grouped: inserts (or repositions) a sort entry for it, after other grouped columns' entries and before everything else — an ordinary, user-removable/reversible entry, not tracked state (issue #17)
reorderGroupSorts(sorts, groupBy) // re-orders whichever sorts entries match a groupBy key to follow groupBy's own order — call after groupBy itself is reordered, so nesting priority never desyncs from it
toggleCollapse(collapsedGroups, key) // toggle a collapsed group
isGroupCollapsed(collapsedGroups, key, defaultCollapsed?) // whether key is collapsed; collapsedGroups tracks manual toggles away from defaultCollapsed, not absolute state
countActiveGroups(groupBy) // groupBy.length, exported for symmetry with countActiveFilters/countActiveSorts
DatePart                              // 'year' | 'month' | 'day' — granularity for bucketDatePart/formatDatePart
bucketNumericRange(step) // ready-made groupValue: rounds a number down to the start of its step-wide range; null for a missing/non-numeric value
formatNumericRange(step, unit?, missingLabel?) // formats a bucketNumericRange key as "<lower>–<upper><unit>"; missingLabel (default '(none)') for the missing-value group
numericRangeGroup(step, unit?, missingLabel?) // { groupValue, groupFormat } pair from one set of args, spreadable into a column def
bucketDatePart(part, parseDate?) // ready-made groupValue: truncates a date to the start of its enclosing year/month/day, as an ISO string; null for a missing value
formatDatePart(part, missingLabel?) // formats a bucketDatePart key for display, e.g. "2024-05-01" -> "May 2024"; missingLabel (default '(none)') for the missing-value group
datePartGroup(part, parseDate?, missingLabel?) // { groupValue, groupFormat } pair from one set of args
LogRangeOptions                      // { base?, divisions?, min? } — see bucketLogRange
bucketLogRange(options?) // ready-made groupValue: buckets on a log scale (base 10 decades by default; divisions splits each power of base, e.g. [1, 3] for a half-decade "1-3-10" grid); values < min (default 1) collapse into one low bucket, pass min: 0 to opt out
formatLogRange(options?, unit?, missingLabel?) // formats a bucketLogRange key, with k/M magnitude suffixes and a "<<min>" label for the below-min bucket
logRangeGroup(options?, unit?, missingLabel?) // { groupValue, groupFormat } pair from one set of args
```

See [docs/grouped-columns.md](../../docs/grouped-columns.md) for the full mechanics (fan-out, aggregation, bucketing).

#### Selection (identity)

```ts
GetRowId<TRow>                                    // (row: TRow) => string | number — opt-in id accessor for selection matched by id instead of object reference
isRowSelected(selection, row, getRowId?)          // membership check; Set.has by default, id-scan when getRowId is given
getSelectedRows(rows, selection, getRowId?)       // array-filter form of isRowSelected, backs `selectedRows`
toggleRowInSelection(selection, row, getRowId?)   // add/remove row from selection Set (by reference, or by id when getRowId is given)
toggleAllInSelection(selection, rows, getRowId?)  // select all of rows if none are selected, else deselect all of them
reconcileSelection(nextData, selection, getRowId?) // remap each selected id to its fresh object reference in nextData and drop ids no longer present; no-op when getRowId is omitted
```

Selection is tracked as `Set<TRow>` by object identity by default; `getRowId` is the opt-in escape hatch so selection survives a `data` refetch that produces new row objects with the same content. `selectRange` (see Filtering above) also backs shift-click range selection over rows, but is not id-aware.

#### Pagination

```ts
paginateData(data, page, pageSize) // slice rows for the current page (pageSize 0 → all)
computeTotalPages(count, pageSize) // total page count (pageSize 0 → 1)
PagedGroup<TRow> // GroupResult + { continued, sampleRow } — one page's chunk from paginateVisibleGroups
paginateVisibleGroups(groupedFull, visibleItems, collapsedGroups, defaultCollapsed, page, pageSize) // re-chunk a page's slice of visibleItems back into PagedGroup[] for rendering, counting header rows toward the page budget
mergePageSizeOptions(options, pageSize) // insert pageSize into a "rows per page" option list (sorted) if it's missing, so a custom page size still shows correctly in a <select>
```

See [docs/pagination.md](../../docs/pagination.md) for `PagedGroup`'s `continued`/`sampleRow` semantics and how grouping composes with pagination.

#### Columns

```ts
getColumnValue(col, row) // read a column's cell value: row[col.key], or col.value(row) if value is set
getOrderedColumns(columns, order) // sort columns per an order array of keys; columns missing from order are appended at the end
reconcileVisibleColumns(prevColumns, nextColumns, visibleCols) // reconcile a visibleCols set against a replaced column list — a column in both keeps its choice, a genuinely new column starts visible
reorderColumn(order, dragKey, targetKey, (after = false)) // move dragKey to just before targetKey (or just after, if after is true) (drag-and-drop)
moveColumnBy(order, key, delta) // swap key with its neighbor delta positions away (e.g. -1/+1 for up/down buttons)
```

See [docs/column-reordering.md](../../docs/column-reordering.md) for the full drag-and-drop wiring.

#### Keyboard navigation

```ts
VisibleItem<TRow>                                    // { kind: 'group', key } | { kind: 'row', row, groupKey? } — one navigable target in display order
getVisibleRows(groups, collapsedGroups, defaultCollapsed?) // flatten groupData's result into VisibleItem[] display order, for Up/Down/Home/End nav
isSameVisibleItem(a, b) // whether a and b are the same navigable target — rows by object identity, groups by key
indexOfVisibleItem(items, target) // index of target within items, or -1 if target is null/absent
paginateVisibleItems(visibleItems, page, pageSize) // per-page slice of visibleItems for keyboard nav, with a synthetic continuation header prepended when the page starts mid-group
getCrossPageFocusTarget(visibleItems, currentPage, numPages, pageSize, mode, rowNavEnabled) // { targetPage, item } to focus when row-nav keyboard crosses a page boundary (an edge Arrow step, or a Ctrl/Cmd+Home/End jump), or null if there's nowhere to go
```

See [docs/keyboard-navigation.md](../../docs/keyboard-navigation.md) for the roving-tabindex mechanism and per-adapter wiring. See also [docs/dropdown-keyboard-nav.md](../../docs/dropdown-keyboard-nav.md) for the separate dropdown-panel (Columns/Sort/Group/Filter) keyboard nav.

#### Aggregation

```ts
computeAggregate(col, rows) // compute a group header's aggregate value per col.aggregate ('sum' | 'count' | 'avg' | 'min' | 'max' or a custom function)
```

#### Search

```ts
searchData(data, query, columns) // filter rows by a case- and diacritic-insensitive substring match against any searchable column's string value
```

### View state

```ts
encodeViewState(view) // TableViewState -> compact, URL-safe string (base64url of a shortened JSON shape; fields at their default are omitted)
decodeViewState(encoded) // string -> TableViewState, or undefined if the input is malformed
```

### Theme

`LIGHT_THEME`/`DARK_THEME`/`renderThemeCss()` are **not** re-exported from this package's main entry point — they're reachable via a dedicated `@vates/data-table-core/theme` sub-path export instead (same pattern as `/locales`), since React/Vue consumers importing this package directly would otherwise see theme APIs with no relevance to them. Currently consumed only by the Solid adapter (vanilla gets it transitively by bundling `@vates/data-table-solid`).

## License

MIT
