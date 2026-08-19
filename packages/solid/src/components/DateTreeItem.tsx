import { For, Show, createEffect } from 'solid-js'
import {
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  type DateTreeNode,
} from '@vates/data-table-core'
import { applyCheckboxState, deferCheckboxCorrection } from './checkboxSync'

interface DateTreeItemProps {
  node: DateTreeNode
  depth: number
  selected: Set<string>
  counts: Map<string, number>
  expanded: Set<string>
  // Force-expanded regardless of `expanded`/click history whenever the column's own search term
  // is non-empty — the already-narrowed list is small enough to show in full (see CLAUDE.md's
  // date-tree section: "a node with an active search term for its column is force-expanded
  // regardless of click history").
  searchActive: boolean
  onToggleExpand: (path: string) => void
  onToggleNode: (node: DateTreeNode, shiftKey: boolean) => void
}

const monthName = (m: string): string =>
  new Date(2000, Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long' })

// Recursive Year › Month › Day tree node (see CLAUDE.md's date-tree section). Self-imports for
// recursion — mirrors vue/components/DateTreeItem.vue's own self-import pattern (safer than
// filename-based self-reference across build setups).
export function DateTreeItem(props: DateTreeItemProps) {
  const isLeaf = () => props.node.children.length === 0
  const state = () => getDateTreeNodeState(props.node, props.selected)
  const expanded = () => props.searchActive || props.expanded.has(props.node.path)
  const count = () => sumDateTreeNodeCount(props.node, props.counts)
  // Year nodes (depth 0) are plain 4-digit numbers; month nodes (depth 1) render as a localized
  // long month name ("May", not "05"); day nodes (depth 2) as a plain (non-zero-padded) number —
  // matches the old vanilla renderer's own depth-based formatting. Anything deeper, or a
  // non-numeric key (the emptyLabel leaf for unparseable values), is left as its raw key.
  const label = () => {
    const key = props.node.key
    if (props.depth === 1) return monthName(key)
    if ((props.depth === 0 || props.depth === 2) && /^\d+$/.test(key)) return String(Number(key))
    return key
  }

  // `.indeterminate` has no JSX/attribute equivalent — it's a DOM-only imperative property, so
  // it needs an effect re-applying it whenever `state()` changes, not a one-shot ref callback
  // (which only runs once at mount and would freeze on the tree's initial checked state).
  let checkboxEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(checkboxEl, state() === 'checked', state() === 'indeterminate')
  })

  return (
    <>
      <label class="dt-date-tree-item" style={{ 'padding-left': `${14 + props.depth * 16}px` }}>
        <Show when={!isLeaf()} fallback={<span class="dt-date-tree-toggle" />}>
          <span
            class="dt-date-tree-toggle dt-date-tree-toggle--branch"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              props.onToggleExpand(props.node.path)
            }}
          >
            {expanded() ? '▼' : '▶'}
          </span>
        </Show>
        <input
          type="checkbox"
          checked={state() === 'checked'}
          ref={checkboxEl}
          onClick={(e) => {
            e.preventDefault()
            props.onToggleNode(props.node, (e as MouseEvent).shiftKey)
            deferCheckboxCorrection(checkboxEl, () => ({
              checked: state() === 'checked',
              indeterminate: state() === 'indeterminate',
            }))
          }}
        />
        <span class="dt-flex1">{label()}</span>
        <span class="dt-filter-count">{count()}</span>
      </label>
      <Show when={!isLeaf() && expanded()}>
        <For each={props.node.children}>
          {(child) => (
            <DateTreeItem
              node={child}
              depth={props.depth + 1}
              selected={props.selected}
              counts={props.counts}
              expanded={props.expanded}
              searchActive={props.searchActive}
              onToggleExpand={props.onToggleExpand}
              onToggleNode={props.onToggleNode}
            />
          )}
        </For>
      </Show>
    </>
  )
}
