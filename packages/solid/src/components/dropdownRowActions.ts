// Shared by Sort/Group's own active-row Alt+↑/↓ and remove-button handlers (see CLAUDE.md's
// "Sort"/"Group" sections): each one resolves its own dropdown panel via `.closest('.dt-dd')`
// *before* mutating state, mutates, then refocuses a fresh element by a `data-*` selector — Solid
// updates the DOM synchronously within the same handler, so the new element already exists by the
// time `.focus()` runs (see SortDropdown.tsx's own comment on this). Extracted after a
// cross-dropdown review found this exact three-step shape duplicated three times in each of
// SortDropdown.tsx and GroupDropdown.tsx.
//
// `panel` must be resolved before `mutate()` runs, not after — a remove button is itself removed
// from the DOM as a synchronous side effect of its own mutation, so `.closest()` on it afterward
// would find nothing (this is exactly the bug class CategorySubmenu's portal already forced a
// `document.querySelector` workaround for elsewhere; this helper only ever runs on non-portaled
// active rows, so `.closest('.dt-dd')` is safe here).
export function withPanelRefocus(el: HTMLElement, selector: string, mutate: () => void): void {
  const panel = el.closest('.dt-dd')
  mutate()
  panel?.querySelector<HTMLElement>(selector)?.focus()
}
