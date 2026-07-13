<script setup lang="ts">
import {
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  type DateTreeNode,
} from '@vates/data-table-core'
// Recursive component: self-imported so each nesting level (year → month → day) can render its
// own children the same way, regardless of whether Vue's filename-based self-reference applies
// to this build setup.
import DateTreeItem from './DateTreeItem.vue'

const props = defineProps<{
  nodes: DateTreeNode[]
  depth: number
  selected: Set<string>
  counts: Map<string, number>
  expanded: Set<string>
  searchActive: boolean
}>()

const emit = defineEmits<{
  toggleNode: [node: DateTreeNode, event: MouseEvent]
  toggleExpand: [path: string]
}>()

const vIndeterminate = {
  mounted: (el: HTMLInputElement, b: { value: boolean }) => {
    el.indeterminate = b.value
  },
  updated: (el: HTMLInputElement, b: { value: boolean }) => {
    el.indeterminate = b.value
  },
}

function isLeaf(node: DateTreeNode): boolean {
  return node.children.length === 0
}

function isExpanded(node: DateTreeNode): boolean {
  return props.searchActive || props.expanded.has(node.path)
}

function label(node: DateTreeNode): string {
  if (props.depth === 1)
    return new Date(2000, Number(node.key) - 1, 1).toLocaleDateString(undefined, { month: 'long' })
  if (props.depth === 2) return String(Number(node.key))
  return node.key
}
</script>

<template>
  <div v-for="node in nodes" :key="node.path">
    <label class="dt__date-tree-item" :style="{ paddingLeft: `${14 + depth * 16}px` }">
      <span
        v-if="!isLeaf(node)"
        class="dt__date-tree-toggle dt__date-tree-toggle--branch"
        @click.prevent="emit('toggleExpand', node.path)"
      >
        {{ isExpanded(node) ? '▼' : '▶' }}
      </span>
      <span v-else class="dt__date-tree-toggle" />
      <input
        type="checkbox"
        v-indeterminate="getDateTreeNodeState(node, selected) === 'indeterminate'"
        :checked="getDateTreeNodeState(node, selected) === 'checked'"
        @click="emit('toggleNode', node, $event)"
      />
      <span class="dt__flex1">{{ label(node) }}</span>
      <span class="dt__filter-count">{{ sumDateTreeNodeCount(node, counts) }}</span>
    </label>
    <DateTreeItem
      v-if="!isLeaf(node) && isExpanded(node)"
      :nodes="node.children"
      :depth="depth + 1"
      :selected="selected"
      :counts="counts"
      :expanded="expanded"
      :search-active="searchActive"
      @toggle-node="(n, e) => emit('toggleNode', n, e)"
      @toggle-expand="(p) => emit('toggleExpand', p)"
    />
  </div>
</template>

<style scoped>
.dt__date-tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
}
.dt__date-tree-toggle {
  width: 14px;
  flex-shrink: 0;
  text-align: center;
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.dt__date-tree-toggle--branch {
  cursor: pointer;
}
.dt__flex1 {
  flex: 1;
}
.dt__filter-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
</style>
