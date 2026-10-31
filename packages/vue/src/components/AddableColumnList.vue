<script setup lang="ts" generic="T extends { key: string; label: string; category?: string }">
import type { CategorizedColumns } from '@vates/data-table-core/internal'
import CategorySubmenu from './CategorySubmenu.vue'

// The Columns/Sort/Group dropdowns' click-to-add rows: flat and category-tagged while searching,
// else uncategorized rows then one CategorySubmenu per category (see addableLists, core).
defineProps<{
  searching: boolean
  flat: T[]
  categorized: CategorizedColumns<T>
  // Which category submenu is open: one per dropdown, so opening one closes the others
  openCategory: string | null
  setRowRef: (key: string, el: Element | null) => void
  setCategoryRef?: (name: string, el: unknown) => void
}>()
const emit = defineEmits<{
  activate: [key: string]
  'update:openCategory': [name: string | null]
}>()
</script>

<template>
  <button
    v-for="col in searching ? flat : categorized.uncategorized"
    :key="col.key"
    :ref="(el) => setRowRef(col.key, el as Element | null)"
    type="button"
    class="dt-dd-item dt-dd-item--click"
    data-dd-row
    @click="emit('activate', col.key)"
  >
    <span class="dt-flex1">{{ col.label }}</span>
    <span v-if="searching && col.category" class="dt-dd-item-category">{{ col.category }}</span>
  </button>
  <template v-if="!searching">
    <CategorySubmenu
      v-for="category in categorized.categories"
      :key="category.name"
      :ref="(el) => setCategoryRef?.(category.name, el)"
      :name="category.name"
      :is-open="openCategory === category.name"
      @open="emit('update:openCategory', category.name)"
      @close="openCategory === category.name && emit('update:openCategory', null)"
    >
      <button
        v-for="col in category.columns"
        :key="col.key"
        :ref="(el) => setRowRef(col.key, el as Element | null)"
        type="button"
        class="dt-dd-item dt-dd-item--click"
        data-dd-row
        @click="emit('activate', col.key)"
      >
        <span class="dt-flex1">{{ col.label }}</span>
      </button>
    </CategorySubmenu>
  </template>
</template>
