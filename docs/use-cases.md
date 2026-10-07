# Use cases

What people do with a table built on this library, end to end — the yardstick for UX reviews (`ux-review` skill) and fixes (`ux-fix` skill):

- A finding is friction on a use case's path, or a broken **Done when** / **Edges** line; general taste is judged against [UI guidelines](ui-guidelines.md).
- A use case wrong about the library (a step that doesn't exist, a stale expectation) is itself a finding.
- **Who** is someone using an app that embeds the table, not the developer integrating it.
- Each names the demo section it runs on (`demo/*`, same anchors in every adapter). Data: the demo's 20 employees; `#huge-dataset`'s generated orders.
- A step or edge marked ◇ is a target, not built yet: add it before building a feature, so the feature has a line to meet, and drop the ◇ when it ships. A missing ◇ behavior isn't a finding.
- UC01 and UC07 also run as Playwright tests in `e2e/` ([testing](testing.md)).
- IDs are never reused.

## UC01 Find rows in a list

**Who**: someone looking for specific employees in a list too long to scan. **Demo**: `#full-table`.

**Done when**: the rows shown are exactly the ones wanted, they can tell which filters and sorts produced them, and one action gets back to everything.

1. Type "lead" in Search: only matching rows remain; the row count says how many.
2. Filter Department to Engineering and Product: the active bar shows the filter as a chip.
3. Narrow Salary with the range: bounds read as the column displays them (currency, no raw floats).
4. Exclude the "Leadership" skill (the ≠ button on its checklist row): rows having it disappear.
5. Sort by Salary, then shift-click Joined to add a second sort.
6. Click the sort chip to flip its direction; remove the filter chip with its ×.
7. Clear all: every row is back, sorted as at first.

**Edges**: a filter matching nothing (says so, offers a way out); missing values (Eva's salary, unreviewed scores) placed and labelled consistently; a column whose values are badges, in cells and in its checklist; another locale or the dark theme (nav switchers): every string translated, plurals right ("1 row"), chips, focus and excluded values still distinct.

**Docs**: [sorting](sorting.md), [filter dropdown](filter-dropdown.md), [columns](columns.md), [toolbar](toolbar.md)

## UC02 Group and read totals

**Who**: a manager comparing departments. **Demo**: `#full-table`.

**Done when**: each group shows its size and totals without expanding it, and the grouping is undone as easily as it was set.

1. Group by Department: groups start collapsed, each with a count and its Salary sum / Tenure average.
2. Expand Engineering, then add a second grouping by Joined (by year).
3. Sort by Salary: group order and the Group dropdown's order stay consistent.
4. Page through: a group split across pages shows its header again, marked as continued.
5. Remove the groupings from their chips.

**Edges**: grouping by Skills (a row in several groups); a "(none)" bucket for a missing salary; a grouped-away column kept visible (`keepVisibleWhenGrouped`).

**Docs**: [grouped columns](grouped-columns.md), [pagination](pagination.md)

## UC03 Select rows and act on them

**Who**: someone picking employees for a bulk action. **Demo**: `#row-selection`, `#row-click`.

**Done when**: the selection is exactly what was meant, visible at a glance, and survives sorting and paging.

1. Check one row, then shift-click another: the range between them is selected.
2. Select all from the header: what "all" covers (page, filtered rows) is clear.
3. Change the sort and page: the selection is kept and the app's "N selected" bar agrees.
4. In `#row-click`, click a row: the app reacts; clicking a checkbox or control inside a row doesn't count as a row click.

**Edges**: selecting inside a collapsed group (group checkbox); a filter hiding selected rows.

**Docs**: [selection and row click](selection-and-row-click.md)

## UC04 Keyboard only

**Who**: someone who doesn't use a mouse. **Demo**: `#row-selection`, `#full-table`.

**Done when**: every UC01–UC03 step can be done from the keyboard, with focus always visible and never lost to the page.

1. Tab into the toolbar, open Filter, search a column, cross to its values (→), pick one, Esc back to the button.
2. Tab to the table body: ↑/↓/Home/End move between rows, crossing pages; Ctrl+Home/End reach the true first/last row.
3. Space selects, Shift+↑/↓ extends; Enter on a group header collapses it, on a row (`#row-click`) clicks it.
4. Reach the active-bar chips and remove one; focus lands somewhere sensible.
5. Reorder a column from the Columns dropdown with Alt+↑/↓.

**Edges**: focus after a dropdown closes, a chip is removed, a group collapses over the focused row, or a page changes.

**Docs**: [keyboard navigation](keyboard-navigation.md), [dropdown keyboard nav](dropdown-keyboard-nav.md)

## UC05 Shape the table

**Who**: someone who wants the columns that matter to them, in their order. **Demo**: `#persisted-table`, `#full-table`.

**Done when**: hidden, shown and reordered columns stay that way, and the default layout is one action away.

1. Hide Status and show ID from the Columns dropdown (find them via its search or category).
2. Drag the Salary header before Name; reorder from the Columns dropdown too.
3. Reload: the layout is kept.
4. Reset: the default layout is back.

**Edges**: hiding the column the table is sorted, grouped or filtered by; a narrow viewport with many visible columns; 200% browser zoom (toolbar and dropdowns reflow, nothing clipped).

**Docs**: [column reordering](column-reordering.md), [columns](columns.md)

## UC06 Keep or share a view

**Who**: someone sending a colleague the exact list they're looking at. **Demo**: any section (Copy share link).

**Done when**: the link opens the same rows in the same order and layout, and the recipient can tell it differs from the default and get back to it.

1. Set a filter, a sort and a grouping; copy the share link.
2. Open it in a fresh browser context: same view.
3. Reset there: the default view, and the URL no longer carries one.

**Edges**: a link naming a removed column or a value no longer present (renders, doesn't throw); a link without changes; the same for a view saved in `#persisted-table` and reopened later.

**Docs**: [view persistence](view-persistence.md)

## UC07 On a phone

**Who**: someone checking the list on a 390 px wide phone. **Demo**: `#full-table`, `#row-selection`.

**Done when**: UC01 and UC03 can be done by touch, with no horizontal page scroll, nothing clipped, and the first rows visible without scrolling past the controls.

1. Search, then open Filter: the dropdown fits the screen and its two panes are usable.
2. Sort from the Sort dropdown (no shift-click on a phone).
3. Scroll the table sideways inside its own area, not the page.
4. Select a few rows by tapping.

**Edges**: touch targets on checkboxes, chips' ×, pagination; dropdowns near the screen edge; a longer locale (DE, FR) still fitting the toolbar.

**Docs**: [toolbar](toolbar.md) (viewport clamping)

## UC08 Large dataset

**Who**: someone working through a long order history. **Demo**: `#huge-dataset`.

**Done when**: sort, filter, search and group respond without a noticeable freeze, and the user always knows where they are in the data.

1. Sort by Amount; search a customer name; filter Customer from its checklist (thousands of values).
2. Group by Category, then Region; expand a group.
3. Change rows per page and jump to the last page.

**Edges**: a checklist search narrowing thousands of values; clearing everything at once.

**Docs**: [performance](performance.md), [pagination](pagination.md)

## UC09 Screen reader

**Who**: someone using a screen reader (NVDA, VoiceOver). **Demo**: `#full-table`, `#row-selection`.

**Done when**: after each UC01–UC03 action they hear what changed without looking, and every control's name says what it does.

1. Search "lead": the new row count is announced.
2. Sort by Salary: the header reports its direction.
3. Group by Department, reach a group header: its name, count and collapsed state are read; Enter toggles it and the new state is heard.
4. Select rows: each checkbox names its row and its state.
5. Page forward: the new page is announced.
6. Remove a chip: its × is named after what it removes; focus lands on something announced.

**Edges**: "No matching rows" announced; a dropdown's open state and the active item while searching its list.

**Docs**: [keyboard navigation](keyboard-navigation.md), [dropdown keyboard nav](dropdown-keyboard-nav.md), [toolbar](toolbar.md)

## UC10 Rows change underneath

**Who**: someone whose list changes while they work on it, e.g. after a bulk action. **Demo**: `#row-selection` (Delete; reload restores the rows).

**Done when**: removed rows never change what the user meant: selection, focus, page and counts stay coherent.

1. Go to page 2, select two rows, Delete: they're gone, the "N selected" bar clears, the row count drops.
2. Filter Department to Sales, select all, Delete: the filter stays and the table says nothing matches.
3. Delete rows from the last page until it empties: the table shows the new last page.
4. Delete every row: the table says "No rows", not "No matching rows".

**Edges**: deleting the keyboard-focused row; a group losing its last row; a checklist filter on a value no longer present.

**Docs**: [selection and row click](selection-and-row-click.md), [pagination](pagination.md), [table state](table-state.md)

## UC11 Act on a column where it is

**Who**: someone who spots something in a column and wants to act on it right there. **Demo**: `#full-table`.

**Done when**: every action on a column starts from that column in at most two clicks or taps, and the header shows the column's state.

1. Sort Salary from its header, then flip it.
2. Filter Department to Engineering from its header.
3. Group by Department from its header.
4. Hide Status from its header.
5. From the headers alone, tell which columns are sorted, filtered and grouped.

**Edges**: on a phone (no shift-click, no hover); from the keyboard; a narrow column; a column that can't be filtered or grouped (offers only what applies).

**Docs**: [sorting](sorting.md), [filter dropdown](filter-dropdown.md), [grouped columns](grouped-columns.md), [columns](columns.md)
