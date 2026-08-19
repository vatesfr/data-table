// Solid's `checked`/`indeterminate` reactive bindings write to the DOM synchronously the moment
// the underlying signal changes — including mid-click, inside a handler that calls
// `e.preventDefault()` to keep a checkbox fully "controlled" (needed for anything beyond a plain
// two-state toggle, e.g. the filter checklist's tri-state include/exclude cycling or the date
// tree's checked/unchecked/indeterminate rollup). But a checkbox's own native "canceled activation
// steps" (which revert `.checked` specifically because `preventDefault()` was called) run
// synchronously right after the click event finishes dispatching — i.e. *after* our handler and
// Solid's own synchronous DOM write — silently clobbering it back to the pre-click value a moment
// later, on exactly the element that was just clicked.
//
// `applyCheckboxState` is the plain, synchronous setter — used from a reactive effect, where it's
// correct and instantaneous for every update *except* the specific click-with-preventDefault race
// above (a different checkbox changing, a setViewState call, initial render, etc. are all fine
// synchronously). `deferCheckboxCorrection` is the targeted fix for that one race: called from the
// click handler itself, right after the state-changing action, it re-applies the (by-then-settled)
// correct state from a microtask — guaranteed to run after the browser's own post-dispatch revert,
// so it wins — but ONLY for the element that was actually clicked. Deferring unconditionally in
// the general effect instead would "fix" the race at the cost of a one-tick-late DOM read for
// every other update path too, which is both an unnecessary correctness trade and breaks any
// caller that reasonably expects a synchronous DOM read after a non-click state change.
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
  // A macrotask (setTimeout), not a microtask (queueMicrotask): for a script-fired click
  // (el.click(), as in most tests), the browser's "canceled activation steps" revert runs
  // synchronously within the same call, before any queued microtask gets a chance to run, so a
  // microtask correction happens to win there. But for a genuine trusted click (real mouse input
  // — what end users produce, and what Playwright's locator.click() simulates), that same revert
  // is scheduled to run *after* the microtask checkpoint that follows event dispatch, so a
  // microtask-deferred correction loses the race and gets silently reverted right back to the
  // pre-click value a moment later — observed as "the checkbox doesn't update when clicked". A
  // macrotask always runs after any microtask, so it wins the race either way.
  setTimeout(() => {
    const { checked, indeterminate } = getState()
    applyCheckboxState(el, checked, indeterminate)
  }, 0)
}
