<script setup lang="ts">
import {
  formatDateTreeLabel,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  type DateTreeNode,
} from '@vates/data-table-core/internal'
// Recursive component: self-imported so each nesting level (year → month → day) can render its
// own children the same way, regardless of whether Vue's filename-based self-reference applies
// to this build setup.
import DateTreeItem from './DateTreeItem.vue'
import { vIndeterminate } from '../directives/vIndeterminate'

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

function isLeaf(node: DateTreeNode): boolean {
  return node.children.length === 0
}

function isExpanded(node: DateTreeNode): boolean {
  return props.searchActive || props.expanded.has(node.path)
}

function label(node: DateTreeNode): string {
  return formatDateTreeLabel(node.key, props.depth)
}
</script>

<template>
  <div v-for="node in nodes" :key="node.path">
    <label class="dt-date-tree-item" :style="{ paddingLeft: `${14 + depth * 16}px` }">
      <span
        v-if="!isLeaf(node)"
        class="dt-date-tree-toggle dt-date-tree-toggle--branch"
        @click.prevent="emit('toggleExpand', node.path)"
      >
        {{ isExpanded(node) ? '▼' : '▶' }}
      </span>
      <span v-else class="dt-date-tree-toggle" />
      <input
        type="checkbox"
        v-indeterminate="getDateTreeNodeState(node, selected) === 'indeterminate'"
        :checked="getDateTreeNodeState(node, selected) === 'checked'"
        @click="emit('toggleNode', node, $event)"
      />
      <span class="dt-flex1">{{ label(node) }}</span>
      <span class="dt-filter-count">{{ sumDateTreeNodeCount(node, counts) }}</span>
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
