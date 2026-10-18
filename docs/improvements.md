# Improvements

UX backlog from `ux-review` runs against [use cases](use-cases.md) and [UI guidelines](ui-guidelines.md). Each item names the use cases it slows down and, when not all three, the adapters; `ux-fix` fixes one per commit and removes it once shipped. IDs are never reused.

Next free ID: **U29** (IDs are never reused, including ones dropped before committing).

Severity: **blocker** (goal unreachable) · **major** (reached with confusion or a workaround) · **minor** (friction) · **polish**.

Seeded 2026-10-04 from issues reported by a consumer app, each reproduced on the demos (Solid, spot-checked on React and Vue).

- [Pagination](#pagination)
- [Active bar](#active-bar)

## Pagination

- **U27 · major · UC01, UC04, UC07** — with fewer rows than the next page size (search "lead": 7 rows at 5 per page), picking 10 in "Rows per page" hides the whole pager: the select vanishes under the pointer, focus drops to the page, and 5 is no longer offered, so the starting page size can't be picked again. Keep the table's initial page size among the choices, so the pager stays while it can still split the rows.

## Active bar

- **U28 · minor · UC09** — chips are named only by their column: each sort chip's × is a plain "Remove sort", so a grouped column's sort × and another column's read alike, and the group chip's body reads as plain "Department" (its ⊞ is hidden from screen readers), so it can't be told from the sort chip. Name each × after its column ("Remove sort: Salary") and say on the group chip's body that it's the grouping.
