# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U26** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Filters](#filters)
- [Active bar](#active-bar)
- [Column headers](#column-headers)
- [Empty and cleared states](#empty-and-cleared-states)
- [Layout and integration](#layout-and-integration)
- [Adapter-specific](#adapter-specific)

## Filters

- **U4 · minor · UC01, UC08** — the Filter dropdown's column pane is 149 px wide for 222 px of content, so it scrolls sideways even with short names like "Order Date" and clips its own search box; all adapters. Size the pane to its content, within the dropdown's max width.
- **U5 · minor · UC01** — a range filter's inputs are named only by their "Min"/"Max" placeholders, with no column label, and show raw bounds instead of the column's format ("0 – 1000" for amounts shown as "$12.34"). Label them with the column and show bounds through its `format`.

## Active bar

- **U6 · polish · UC01, UC02** — a column both sorted and grouped gets one chip reading "↑ Department × ⊞ ×": two identical × side by side, removing different things (the sort, the group); seen in Solid and React. Tell them apart: separate chips, or a name-revealing tooltip and distinct glyph on the group part.

## Column headers

- **U20 · minor · UC07** — on a phone the toolbar dropdowns focus their search box on open, raising the on-screen keyboard before the user asked to type (the header menu's Filter no longer does). On a coarse pointer, focus the panel rather than its search box.

## Empty and cleared states

- **U8 · polish · UC01** — Clear all drops every sort, group and filter at once with no undo. Consider an Undo next to the stats line for a few seconds.

## Layout and integration

- **U21 · minor · UC07, UC03** — row and select-all checkboxes are 13×13 px, under the 24 px touch target. Grow their hit area to the whole checkbox cell (a label filling it), keeping Shift+click range selection working; the chips' × and ⊞ already reach 24 px.

## Adapter-specific

- **U11 · polish · UC01 · React** — the Columns and Filter toolbar buttons render a darker, thicker right edge than the other buttons; Vue's and Solid's don't.
