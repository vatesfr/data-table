<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import {
  ddNavFocusables,
  openDropdownPanel,
  rovingFocusTarget,
} from '@vates/data-table-core/internal'

// Listeners (@dragover/@drop for reorder drops past the last row, @keydown merged with the panel's own) go to the panel via `$attrs`
defineOptions({ inheritAttrs: false })

// Rows reached by the roving nav carry `data-dd-row`, the dropdown's own search box
// `data-dd-search` (core's DD_NAV_SELECTOR). The Filter dropdown's detail pane uses its own
// `data-dd-value-*` markers and nav (see FilterPane.vue), so this nav never sweeps it up.
const props = withDefaults(
  defineProps<{
    // Bound by the toolbar, which keeps one dropdown open at a time; local state when unbound
    open?: boolean
    // Escape clears a search term first, closing on a second press; returns whether it cleared something
    onEscapeClearable?: () => boolean
  }>(),
  // Vue casts an absent boolean prop to false, which would read as bound
  { open: undefined },
)
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
// The trigger content is caller-provided via the #trigger slot, so this wraps it just to give
// `focusTrigger` something to query into after Escape closes the menu.
const triggerWrapRef = ref<HTMLElement | null>(null)
const localOpen = ref(false)
const isOpen = computed(() => props.open ?? localOpen.value)

function setOpen(open: boolean) {
  localOpen.value = open
  emit('update:open', open)
}

function focusTrigger() {
  triggerWrapRef.value?.querySelector<HTMLElement>('button, [tabindex]')?.focus()
}

function onMousedown(e: MouseEvent) {
  if (isOpen.value && containerRef.value && !containerRef.value.contains(e.target as Node)) {
    setOpen(false)
  }
}

onMounted(() => document.addEventListener('mousedown', onMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onMousedown))

// The menu is destroyed/recreated by v-if on every open, so each open starts from a fresh,
// unclamped node — `flush: 'post'` runs this once that node is in the DOM
watch(
  isOpen,
  (open, _, onCleanup) => {
    if (open && menuRef.value) onCleanup(openDropdownPanel(menuRef.value))
  },
  { flush: 'post' },
)

// Roving ↑/↓/Home/End over the panel's marked rows (`DD_NAV_SELECTOR`), plus Escape; Alt is left to row reordering
function onPanelKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (props.onEscapeClearable?.()) return
    setOpen(false)
    focusTrigger()
    return
  }
  if (e.altKey) return
  const menu = menuRef.value
  if (!menu) return
  // An open CategorySubmenu runs its own nav
  const all = ddNavFocusables(menu).filter((el) => !el.closest('[data-category-submenu]'))
  const rows = all.filter((el) => !el.hasAttribute('data-dd-search'))
  const target = rovingFocusTarget(e.key, all, document.activeElement, rows)
  if (!target) return
  e.preventDefault()
  target.focus()
}
</script>

<template>
  <div ref="containerRef" class="dt-dd-wrap">
    <span style="display: inline-flex">
      <span ref="triggerWrapRef" style="display: contents" @click="setOpen(!isOpen)">
        <slot name="trigger" />
      </span>
      <!-- Beside the trigger, inside the outside-click boundary but outside its toggle (the toolbar's × clear button) -->
      <slot name="extra-trigger" />
    </span>
    <div v-if="isOpen" ref="menuRef" class="dt-dd" v-bind="$attrs" @keydown="onPanelKeydown">
      <slot />
    </div>
  </div>
</template>
