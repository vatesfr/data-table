# UI guidelines

<!-- check-docs-ignore: aria-sort -->

How the table's UI should behave where the feature docs are silent; what `ux-review` judges taste against. Conventions, not hard rules: a design that breaks one says why in its feature doc.

## Principles

- One way to do each thing; a second path to the same action is a shortcut to it (a chip toggling a sort the Sort dropdown also sets), not a variant.
- Every state the user can reach, they can leave: each active sort, group and filter is visible (active bar) and removable in one action.
- Defaults that work without options; a new prop is the last resort, not a way to avoid deciding.
- No hidden affordances: every shortcut, drag and shift-click has a visible equivalent (a button, a dropdown entry).
- The consumer's page stays theirs: no layout shift when state changes, nothing escaping the table's box except dropdowns, which stay in the viewport.

## Keyboard

- Every action is reachable from the keyboard, with visible focus.
- Focus order follows reading order; closing a dropdown returns focus to its button; an action removing the focused element moves focus to its nearest equivalent, never to `<body>`.
- Esc clears a non-empty search first, then closes the innermost dropdown.
- Keys follow the ARIA grid and listbox conventions (arrows, Home/End, Space, Enter); no shortcut overrides a browser or OS one.

## Touch and small screens

- Every hover or shift-click behavior has a touch equivalent; no information is hover-only (a `title` alone doesn't count).
- Touch targets are at least 24×24 px (WCAG 2.5.8), 44×44 px where space allows (pagination, chips' ×).
- At 390 px wide: no horizontal page scroll (the table scrolls inside its own area), toolbar wraps without clipping, dropdowns fit the screen.

## Accessibility

- Every control has an accessible name — icon-only buttons and checkboxes included ("Select all", "Select Alice Martin").
- State is exposed, not only colored: sort direction (`aria-sort`), expanded groups, selected rows, pressed toggles.
- Text and icons meet WCAG AA contrast in both themes.

## Patterns

- **Reversible actions** (sort, filter, hide a column) act at once with no confirmation; clearing many at once (Clear all, Reset) is the one place an undo is worth considering.
- **Disabled controls** say why, or are hidden when there's nothing to act on (see [toolbar](toolbar.md)).
- **Empty states** say what emptied the table (no data vs. filters matching nothing) and offer the way back (clear filters).
- **Numbers and dates** in filters, chips and group headers read as the column displays them (its `format`), never as raw floats or timestamps.
- **Missing values** are placed and labelled consistently across cells, filters, sorting and groups.

## Wording

- User terms, not model terms: "Hide column", not "remove from visibleCols".
- Every visible string comes from the labels (`DataTableLabels`) and exists in every locale ([i18n](i18n.md)); nothing hard-coded in English.
- A control's label says what it does ("Clear filters"), not what it is ("×") — the glyph is fine visually, the name carries the action.

## Checklist for a new UI feature

- Keyboard path and touch equivalent.
- Its inverse, and where its state shows when active.
- Empty, disabled and missing-value states.
- Accessible names and exposed state.
- Labels in every locale.
- Phone width: no page overflow, nothing clipped.
- Same behavior in React, Vue and Solid.
