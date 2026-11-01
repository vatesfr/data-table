# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U40** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Active bar](#active-bar)

## Active bar

- **U39 · polish · UC07** — at 390 px the active bar wraps to two lines once a column is grouped and one more sort is set: grouped by Status, sorted by Status then Name, the Solid demo's chips (84 + 81 + 80 px) and stats (128 px) overflow its 342 px bar. The stats ("20 / 20 rows · 2 groups") are the widest item; a label-less `↑ ×` sort chip for the grouped column (43 px) still needs 353 px. Consider shorter stats on narrow viewports. Seen in Solid.
