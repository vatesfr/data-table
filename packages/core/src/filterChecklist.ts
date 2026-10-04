import type { DateTreeNode } from './types'
import { findDateTreeNode, getDateTreeNodeState, selectDateRange, selectRange } from './logic'

// The filter pane's checklist and date-tree clicks, shared by every adapter's FilterPane (see
// docs/filter-dropdown.md's "Filter dropdown"). Adapters keep the anchor and render; these decide
// what a click does and apply it through `table.filter`.

/** The `table.filter` actions the checklist uses — identical in every adapter */
export interface ChecklistFilterActions {
  toggleAll(key: string, values: string[]): void
  setValues(key: string, values: string[], selected: boolean): void
  cycleValue(key: string, value: string): void
  clearExcludeValues(key: string, values: string[]): void
  setExcludeValues(key: string, values: string[], excluded: boolean): void
  toggleExcludeAll(key: string, values: string[]): void
}

/**
 * The select-all or "Others" checkbox state over `values`. `touched` is the set the column's model
 * writes: its exclusions for an exclude-only (checked-by-default) column, its inclusions otherwise.
 */
export function checklistBulkState(
  values: string[],
  touched: ReadonlySet<string> | undefined,
  excludeOnly: boolean,
): { checked: boolean; indeterminate: boolean } {
  const count = touched ? values.filter((v) => touched.has(v)).length : 0
  const indeterminate = count > 0 && count < values.length
  return excludeOnly
    ? { checked: count === 0, indeterminate }
    : { checked: count > 0 && count === values.length, indeterminate }
}

/** The select-all or "Others" checkbox click: toggles every one of `values` */
export function toggleChecklistValues(
  filter: ChecklistFilterActions,
  key: string,
  values: string[],
  excludeOnly: boolean,
): void {
  if (values.length === 0) return
  if (excludeOnly) filter.toggleExcludeAll(key, values)
  else filter.toggleAll(key, values)
}

/**
 * A checklist value click. Exclude-only column: flips the value (or the shift-range from `anchor`,
 * in the clicked value's direction). Otherwise a plain click cycles neutral → included → excluded,
 * and a shift-range includes or un-includes, clearing the swept exclusions when including.
 */
export function clickChecklistValue(
  filter: ChecklistFilterActions,
  key: string,
  value: string,
  shift: boolean,
  ctx: {
    anchor: string | null | undefined
    values: string[]
    include: ReadonlySet<string> | undefined
    exclude: ReadonlySet<string> | undefined
    excludeOnly: boolean
  },
): void {
  const range = shift && ctx.anchor != null ? selectRange(ctx.values, ctx.anchor, value) : null
  if (ctx.excludeOnly) {
    filter.setExcludeValues(key, range ?? [value], !(ctx.exclude?.has(value) ?? false))
  } else if (range) {
    const select = !(ctx.include?.has(value) ?? false)
    filter.setValues(key, range, select)
    if (select) filter.clearExcludeValues(key, range)
  } else {
    filter.cycleValue(key, value)
  }
}

/**
 * A date-tree node click: toggles the node's values, or with shift includes or un-includes the
 * chronological range from the anchor node (see `selectDateRange`), clearing swept exclusions when
 * including.
 */
export function clickDateTreeNode(
  filter: ChecklistFilterActions,
  key: string,
  node: DateTreeNode,
  shift: boolean,
  ctx: {
    anchorPath: string | null | undefined
    tree: DateTreeNode[]
    values: string[]
    include: Set<string> | undefined
    parseDate?: (value: string) => number
  },
): void {
  const anchorNode = ctx.anchorPath != null ? findDateTreeNode(ctx.tree, ctx.anchorPath) : undefined
  if (!shift || !anchorNode) {
    filter.toggleAll(key, node.values)
    return
  }
  const select = getDateTreeNodeState(node, ctx.include ?? new Set()) !== 'checked'
  const range = selectDateRange(ctx.values, anchorNode, node, ctx.parseDate)
  filter.setValues(key, range, select)
  if (select) filter.clearExcludeValues(key, range)
}
