/// <reference lib="dom" />
// Shared by Solid and Vue: re-applies a checkbox's state after the browser's post-click revert (docs/filter-dropdown.md, docs/pitfalls.md).
export function applyCheckboxState(
  el: HTMLInputElement | undefined,
  checked: boolean,
  indeterminate: boolean,
): void {
  if (!el) return
  el.checked = checked
  el.indeterminate = indeterminate
}

export function deferCheckboxCorrection(
  el: HTMLInputElement | undefined,
  getState: () => { checked: boolean; indeterminate: boolean },
): void {
  // Macrotask, not microtask: a trusted click's revert runs after the microtask checkpoint
  setTimeout(() => {
    const { checked, indeterminate } = getState()
    applyCheckboxState(el, checked, indeterminate)
  }, 0)
}
