# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U39** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

## Filter

- **U38 · minor · UC01, UC04**: on desktop the Filter panel names the shown column only by its left-pane row, whose `.dt-filter-col-row--active` background is the hover one (`#f7f6f3` on white) plus weight 500, so it reads as a hovered row; a consumer asked for a pane heading instead. Mark the active row distinctly from hover rather than repeating the name in a heading.
