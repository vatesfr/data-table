# Improvements

<!-- check-docs-ignore: aria-conditional-attr empty-table-header -->

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U47** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Active bar](#active-bar)
- [Grouping](#grouping)
- [Table body](#table-body)
- [Toolbar](#toolbar)

## Active bar

- **U39 · polish · UC07** — at 390 px the active bar wraps to two lines once a column is grouped and one more sort is set: grouped by Status, sorted by Status then Name, the Solid demo's chips (84 + 81 + 80 px) and stats (128 px) overflow its 342 px bar. The stats ("20 / 20 rows · 2 groups") are the widest item; a label-less `↑ ×` sort chip for the grouped column (43 px) still needs 353 px. Consider shorter stats on narrow viewports. Seen in Solid.
- **U42 · minor · UC02** — the stats' "· 1 group" counts the current page's groups (`pageGroupCount`, deliberate per [pagination](pagination.md)) next to a row count covering every page, so it reads as a wrong total: the showcase's infra shows "1500 / 1500 rows · 1 group" with 4 pools, its ledger "1 groupe" over 24 months. Say it's per page, or count all groups. Seen in Solid.

## Grouping

- **U41 · minor · UC02, UC07** — with a pinned column, a group header's label sits in a non-sticky `colspan` cell: scrolled sideways on a phone, headers turn into empty bands (showcase sports in Clubs view; ledger's aggregate band is blank while Montant is off-screen). Keep the label in the pinned area. Seen in Solid.
- **U43 · minor · UC02** — a group header's column name and count use `opacity: .6` instead of a text token, so their contrast depends on the theme: 4.46:1 on the showcase ledger's palette. Use `--color-text-secondary`. Seen in Solid.

## Table body

- **U45 · polish** — the pinned column's row border (its `::after`) sits ~1 px above the rest of the row and runs 8 px past the column's edge; its shadow (`rgba(0,0,0,.12)`) vanishes on dark themes. Reported from zoomed screenshots of the showcase's catalog and users. Seen in Solid.

## Toolbar

- **U46 · polish · UC07** — when the toolbar wraps on a phone, its divider can end a line on its own (showcase users at 390 px: divider after Sort, search on the next line). Seen in Solid.
