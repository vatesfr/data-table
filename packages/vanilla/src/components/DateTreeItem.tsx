import { For, Show, createEffect } from 'solid-js'
import {
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  type DateTreeNode,
} from '@vates/data-table-core'

interface DateTreeItemProps {
  node: DateTreeNode
  depth: number
  selected: Set<string>
  counts: Map<string, number>
  expanded: Set<string>
  onToggleExpand: (path: string) => void
  onToggleNode: (node: DateTreeNode, shiftKey: boolean) => void
}

// Recursive Year › Month › Day tree node (see CLAUDE.md's date-tree section). Self-imports for
// recursion — mirrors vue/components/DateTreeItem.vue's own self-import pattern (safer than
// filename-based self-reference across build setups).
export function DateTreeItem(props: DateTreeItemProps) {
  const isLeaf = () => props.node.children.length === 0
  const state = () => getDateTreeNodeState(props.node, props.selected)
  const expanded = () => props.expanded.has(props.node.path)
  const count = () => sumDateTreeNodeCount(props.node, props.counts)
  // Year nodes are 4-digit numbers and read more naturally unpadded; month/day nodes are
  // 0-padded 2-digit strings (from computeDateTree) and read fine as-is, except the emptyLabel
  // leaf (non-numeric key) which must be left untouched.
  const label = () =>
    props.depth === 0 && /^\d+$/.test(props.node.key)
      ? String(Number(props.node.key))
      : props.node.key

  // `.indeterminate` has no JSX/attribute equivalent — it's a DOM-only imperative property, so
  // it needs an effect re-applying it whenever `state()` changes, not a one-shot ref callback
  // (which only runs once at mount and would freeze on the tree's initial checked state).
  let checkboxEl: HTMLInputElement | undefined
  createEffect(() => {
    if (checkboxEl) checkboxEl.indeterminate = state() === 'indeterminate'
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
              onToggleExpand={props.onToggleExpand}
              onToggleNode={props.onToggleNode}
            />
          )}
        </For>
      </Show>
    </>
  )
}
