# Improvements

<!-- check-docs-ignore: aria-current -->

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U26** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Filters](#filters)
- [Active bar](#active-bar)
- [Column headers](#column-headers)
- [Empty and cleared states](#empty-and-cleared-states)
- [Pagination](#pagination)
- [Layout and integration](#layout-and-integration)
- [Adapter-specific](#adapter-specific)

## Filters

- **U4 · minor · UC01, UC08** — the Filter dropdown's column pane is 149 px wide for 222 px of content, so it scrolls sideways even with short names like "Order Date" and clips its own search box; all adapters. Size the pane to its content, within the dropdown's max width.
- **U5 · minor · UC01** — a range filter's inputs are named only by their "Min"/"Max" placeholders, with no column label, and show raw bounds instead of the column's format ("0 – 1000" for amounts shown as "$12.34"). Label them with the column and show bounds through its `format`.

## Active bar

- **U6 · polish · UC01, UC02** — a column both sorted and grouped gets one chip reading "↑ Department × ⊞ ×": two identical × side by side, removing different things (the sort, the group); seen in Solid and React. Tell them apart: separate chips, or a name-revealing tooltip and distinct glyph on the group part.

- **U25 · minor · UC01** — with the Filter dropdown open and its column search hiding a column ("Sal" typed), clicking that column's chip leaves the current column's pane showing: a chip selects its column by focusing the column's button in the left pane, which isn't rendered. A collapsed category or a phone's values pane likely hides it the same way. Seen in Solid; React selects the column the same way. Select the chip's column directly (state, not DOM focus), clearing the column search and expanding its category.

## Column headers

- **U20 · minor · UC07, UC11** — on a phone the header menu's Filter flyout covers the whole menu, so getting back to Group by or Hide means closing everything; it also focuses its search box, raising the on-screen keyboard before the user asked to type (the toolbar dropdowns do the same). On a coarse pointer, focus the panel rather than its search box, and give the flyout a way back to the menu.

- **U24 · polish · UC01, UC09** — header labels are #6b6a66 on the #eae9e5 header background: 4.45:1, just under WCAG AA's 4.5:1 for 12 px text; seen in Solid. Darken the label color or lighten the header. Found by `e2e/axe.spec.ts`, which lists it as known until fixed.

## Empty and cleared states

- **U8 · polish · UC01** — Clear all drops every sort, group and filter at once with no undo. Consider an Undo next to the stats line for a few seconds.

## Pagination

- **U23 · minor · UC09** — the rows-per-page `<select>` has no accessible name: its visible "Rows per page:" text is a sibling span, so a screen reader announces only "combo box, 10"; all adapters. Wrap both in a `<label>`. Found by `e2e/axe.spec.ts`, which lists it as known until fixed.

## Layout and integration

- **U9 · minor · UC07** — at 390 px the library's controls take 132 px above the first row (toolbar on two lines plus the active bar), and an app has no way to put its own actions on the toolbar line, so they add yet another row. Add a toolbar slot.
- **U10 · minor · UC03** — no per-row attribute or class hook, so an app can't mark or expose its current row (`aria-current`). Add a row-attributes callback.
- **U21 · minor · UC07, UC03** — row and select-all checkboxes are 13×13 px, under the 24 px touch target. Grow their hit area to the whole checkbox cell (a label filling it), keeping Shift+click range selection working; the chips' × and ⊞ already reach 24 px.

## Adapter-specific

- **U11 · polish · UC01 · React** — the Columns and Filter toolbar buttons render a darker, thicker right edge than the other buttons; Vue's and Solid's don't.
