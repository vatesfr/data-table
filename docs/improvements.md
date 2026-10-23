# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U37** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Dropdowns](#dropdowns)
- [Keyboard](#keyboard)
- [Accessibility](#accessibility)

## Dropdowns

- **U29 · minor · UC07** — the viewport clamp only re-runs on a DOM change, so a panel whose size changes by animation stays where it was: with the common reduced-motion reset (a near-zero transition duration on every element) and the open Filter panel's `min-width` raised 40 px at 390 px wide, it ends 32 px past the right edge. Also re-clamp when the panel's size changes (a ResizeObserver on it).
- **U33 · minor · UC04, UC11** — React, Vue: opening a second toolbar dropdown from the keyboard while another is still open (focus left it with Tab) leaves both open, overlapping; Solid closes the first (one shared open state). One open dropdown per table, as in Solid.
- **U34 · minor · UC11** — the header menu's "Filter ▸" opens its flyout on hover, so the click that usually follows closes it again. A click on an already-open "Filter ▸" keeps the flyout open.
- **U35 · polish · UC01** — Filter checklist value rows get no hover background, while the left pane's column rows do. Same hover cue on both panes.

## Keyboard

- **U30 · minor · UC04** — removing an active-bar chip with its × (Enter) drops focus to the page body, even when other chips remain. Focus the next chip, else the previous one, else the search box.
- **U32 · minor · UC04** — React, Vue: → from a Filter column lands on the "Select all" checkbox, where ↓/↑ do nothing and Space toggles every value; Solid lands on the value search. Focus the value search, as Solid does.

## Accessibility

- **U31 · major · UC09** — nothing is announced after search, filter or paging: no live region carries the row count, the page or "No matching rows". A polite status region with the row count and page.
