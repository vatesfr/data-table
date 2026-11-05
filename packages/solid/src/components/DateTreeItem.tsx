import { For, Show, createEffect } from 'solid-js'
import {
  formatDateTreeLabel,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  type DateTreeNode,
  applyCheckboxState,
  deferCheckboxCorrection,
} from '@vates/data-table-core/internal'

interface DateTreeItemProps {
  node: DateTreeNode
  depth: number
  selected: Set<string>
  counts: Map<string, number>
  formatCount: (n: number) => string
  expanded: Set<string>
  // Force-expands every node while the column's value search is active
  searchActive: boolean
  onToggleExpand: (path: string) => void
  onToggleNode: (node: DateTreeNode, shiftKey: boolean) => void
}

// Recursive Year › Month › Day node (docs/filter-dropdown.md), self-imported like Vue's DateTreeItem
export function DateTreeItem(props: DateTreeItemProps) {
  const isLeaf = () => props.node.children.length === 0
  const state = () => getDateTreeNodeState(props.node, props.selected)
  const expanded = () => props.searchActive || props.expanded.has(props.node.path)
  const count = () => sumDateTreeNodeCount(props.node, props.counts)
  const label = () => formatDateTreeLabel(props.node.key, props.depth)

  // An effect, not a ref callback: `.indeterminate` is a DOM property that must follow `state()`
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
        <span class="dt-filter-count">{props.formatCount(count())}</span>
      </label>
      <Show when={!isLeaf() && expanded()}>
        <For each={props.node.children}>
          {(child) => (
            <DateTreeItem
              node={child}
              depth={props.depth + 1}
              selected={props.selected}
              counts={props.counts}
              formatCount={props.formatCount}
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
