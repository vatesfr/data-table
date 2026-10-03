---
name: ux-review
description: Run a UX/UI review of the table by walking docs/use-cases.md in a real browser on the demos, record findings in docs/improvements.md, and report them ranked. Also re-checks one backlog item after its fix. Use when asked for a design, usability, UX, UI or accessibility review, or to re-check a use case or a U-item.
---

# UX review

Judges the table against [use cases](../../../docs/use-cases.md) and [UI guidelines](../../../docs/ui-guidelines.md), not general taste. A finding is friction on a use case's path, a broken **Done when** / **Edges** line, or a guideline broken along the way. Findings only — fix nothing.

## Scope

- **Default: every use case.** A named UC, area or demo section narrows it.
- **Re-check `U<n>`**: walk only the use cases the item names, confirm the fix, then drop or narrow the item.
- A use case wrong about the library (missing step, stale expectation) is a finding against the doc.
- Say which use cases were walked and which skipped, and why.

## Server

- **Solid demo** (`npm run dev:solid`, `:58983`; `run_in_background`, check with `curl -s localhost:58983` first). Vanilla inherits Solid's UI; React and Vue render their own, so a finding about markup, styling or behavior gets a spot-check there (`dev:react` `:58981`, `dev:vue` `:58982`; `ux-measure.mjs --demo=solid,react,vue` covers layout in one pass) before it's recorded as cross-adapter or adapter-specific.
- Every table persists its view to localStorage and the URL: start from a clean state (`node scripts/ux-measure.mjs` clears it; or `localStorage.clear()` and load `/` without a query).
- A finding about the demo page itself (its nav, its own buttons) isn't a library finding: report it separately, don't record it.

## Walk each use case

At **1440×900**, then **390×844**, following its steps as a user would — mouse (touch on phone) first, then keyboard only. At each step check:

- **Clarity** — is the next action obvious? Labels and icons self-explanatory?
- **Feedback** — does each action visibly change something where the user is looking (row count, chip, header icon)?
- **Empty and missing** — no rows, no matching rows, missing values: does the table say what happened and how to get back?
- **Consistency** — same action, same name and look across dropdowns, chips and headers.
- **Keyboard and accessibility** — visible focus in a sensible order, focus never dropped to `<body>`, names on icon-only controls and checkboxes, state exposed, contrast in both themes (the demo's theme toggle).
- **Layout** — no horizontal page scroll on phone, nothing clipped or overlapping, dropdowns inside the viewport, nothing jumping under the pointer.
- **i18n** — switch the demo's locale (FR, DE): nothing left in English, nothing truncated.
- **Console** — errors and warnings.

## Mechanics

- **Layout per section**: `node scripts/ux-measure.mjs [--demo=solid[,react,vue]] [--name=ux-UC<n>] [#section…]`, then `browser_run_code_unsafe` with `filename: .playwright-mcp/measure.js` — controls height above the table, first-row position, page/in-table overflow, targets under 24 px, unnamed controls, console errors, screenshots at both widths.
- **Batch each step in one `browser_run_code_unsafe` call**: act, then measure with `page.evaluate` (`document.activeElement`, bounding boxes, accessible names, `scrollWidth > innerWidth`), then screenshot. Far cheaper than click-by-click snapshots.
- **Scope locators to a section**: every table has the same toolbar; anchor on the section heading (`#full-table`) and its following table.
- **Pick dropdown rows by keyboard**: type in the dropdown's search, then ↓ and Enter. Matching rows by text breaks when a column sits in a category submenu, and row markup differs per adapter; the keyboard path is the same in all three.
- **Screenshots** go to `.playwright-mcp/ux-<UC>-<what>.png` (gitignored); `Read` them to look, `magick <in> -crop WxH+X+Y <out>` for detail.
- **Copied links** (UC06): stub `navigator.clipboard.writeText` to capture them; open them in `page.context().browser().newContext()` for a fresh storage.

## Record and report

- Record every finding in [improvements.md](../../../docs/improvements.md): next free `U` number (never reused), under its area, `**U<n> · <severity> · <use cases>** — problem. Direction.` Note adapters when not all three. Update or drop items the run shows fixed.
- UI text goes in quotes, not backticks — `npm run check:docs` fails on a backticked name absent from the code.
- **Severity**: _blocker_ (the goal can't be reached) · _major_ (reached with real confusion or a workaround) · _minor_ (friction) · _polish_.
- Report one table ranked by severity, then demo-only findings, then one line on what worked well enough to keep:

| U   | Severity | Use case | Where | Finding | Suggestion |
| --- | -------- | -------- | ----- | ------- | ---------- |

- The user picks what to fix (`ux-fix`); commit the improvements.md update only when asked.
