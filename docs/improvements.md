# Improvements

<!-- check-docs-ignore: aria-current -->

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

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
- **U17 · minor · UC11, UC04 · Solid, Vue** — with focus on the "Others" row, Escape clears the value search, the row disappears and focus drops to the page; further Escapes do nothing and the menu or dropdown stays open. Move focus to the value search box when clearing it.

## Active bar

- **U6 · polish · UC01, UC02** — a column both sorted and grouped gets one chip reading "↑ Department × ⊞ ×": two identical × side by side, removing different things (the sort, the group); seen in Solid and React. Tell them apart: separate chips, or a name-revealing tooltip and distinct glyph on the group part.
- **U18 · minor · UC01, UC11** — narrowing a single-value column to one value (Department to Engineering) shows a red exclusion chip, "Department: ≠ Design, HR, Product, +1 more", for what the user experienced as picking one value. When fewer values are kept than hidden, word the chip positively ("Department: Engineering") in the regular filter style.

## Column headers

- **U19 · minor · UC11, UC09** — a filtered column's ▾ differs from the others only by color, and its accessible name ("Department options") doesn't say it's filtered. Give it a distinct shape (a funnel) and say it in the name ("Department options, filtered").
- **U20 · minor · UC07, UC11** — on a phone the header menu's Filter flyout covers the whole menu, so getting back to Group by or Hide means closing everything; it also focuses its search box, raising the on-screen keyboard before the user asked to type (the toolbar dropdowns do the same). On a coarse pointer, focus the panel rather than its search box, and give the flyout a way back to the menu.

## Empty and cleared states

- **U8 · polish · UC01** — Clear all drops every sort, group and filter at once with no undo. Consider an Undo next to the stats line for a few seconds.

## Layout and integration

- **U9 · minor · UC07** — at 390 px the library's controls take 132 px above the first row (toolbar on two lines plus the active bar), and an app has no way to put its own actions on the toolbar line, so they add yet another row. Add a toolbar slot.
- **U10 · minor · UC03** — no per-row attribute or class hook, so an app can't mark or expose its current row (`aria-current`). Add a row-attributes callback.
- **U21 · minor · UC07, UC03** — touch targets under 24 px: row and select-all checkboxes are 13×13, a chip's × 20×23. Grow their hit area to at least 24 px (padding or the surrounding cell/label).

## Adapter-specific

- **U11 · polish · UC01 · React** — the Columns and Filter toolbar buttons render a darker, thicker right edge than the other buttons; Vue's and Solid's don't.
- **U22 · polish · UC01, UC11 · React** — React logs "You provided a `checked` prop to a form field without an `onChange` handler" for the filter pane's "Others" checkbox. Mark it read-only like the pane's other controlled checkboxes.
