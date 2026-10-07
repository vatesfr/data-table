# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U26** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Active bar](#active-bar)
- [Empty and cleared states](#empty-and-cleared-states)
- [Adapter-specific](#adapter-specific)

## Active bar

- **U6 · polish · UC01, UC02** — a column both sorted and grouped gets one chip reading "↑ Department × ⊞ ×": two identical × side by side, removing different things (the sort, the group); seen in Solid and React. Tell them apart: separate chips, or a name-revealing tooltip and distinct glyph on the group part.

## Empty and cleared states

- **U8 · polish · UC01** — Clear all drops every sort, group and filter at once with no undo. Consider an Undo next to the stats line for a few seconds.

## Adapter-specific

- **U11 · polish · UC01 · React** — the Columns and Filter toolbar buttons render a darker, thicker right edge than the other buttons; Vue's and Solid's don't.
