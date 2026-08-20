// Sets a checkbox's `indeterminate` DOM property reactively — there is no HTML attribute or Vue
// prop for it (it's a DOM-property-only concern), so a plain `:indeterminate="..."` binding does
// nothing; a custom directive touching the property directly on mount/update is the standard
// workaround. Shared by DataTableView.vue's own tri-state header checkbox and DateTreeItem.vue's
// filter-tree branch checkboxes — previously duplicated verbatim in both files.
export const vIndeterminate = {
  mounted: (el: HTMLInputElement, b: { value: boolean }) => {
    el.indeterminate = b.value
  },
  updated: (el: HTMLInputElement, b: { value: boolean }) => {
    el.indeterminate = b.value
  },
}
