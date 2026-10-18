# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U30** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Dropdowns](#dropdowns)

## Dropdowns

- **U29 · minor · UC07** — the viewport clamp only re-runs on a DOM change, so a panel whose size changes by animation stays where it was: with the common reduced-motion reset (a near-zero transition duration on every element) and the open Filter panel's `min-width` raised 40 px at 390 px wide, it ends 32 px past the right edge. Also re-clamp when the panel's size changes (a ResizeObserver on it).
