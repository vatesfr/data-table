# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U38** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

## Dropdowns

- **U37 · minor · UC05** — React, Vue (Solid unchecked): with the toolbar near the bottom of a 1280×800 viewport, the Columns panel flips up taller than the space above the trigger, so its top (the search box) starts 14 px above the viewport. Already on `main` before the backlog refactors. Cap a flipped panel's height to the space above it (scrolling inside), or keep it below when neither side fits.
