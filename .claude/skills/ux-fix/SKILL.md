---
name: ux-fix
description: Fix items from the UX backlog (docs/improvements.md) — test first, fix in every adapter, check on the demos, close the item, one commit each. Use when asked to fix, implement or close a U-item or a ux-review finding.
---

# UX fix

Works through the named `U<n>` items in [improvements.md](../../../docs/improvements.md), in order, one commit each. Finding new problems is `ux-review`'s job; this one fixes what's there.

## 0. Before starting

- Read each item, the use case it names in [use cases](../../../docs/use-cases.md), the feature doc of the area (CLAUDE.md's Documentation list), then the code in all three adapters.
- Batch the real design forks into one `AskUserQuestion`, recommendation first: interaction model or placement, a new prop or label (every locale), a core primitive vs. adapter-only, anything on CLAUDE.md's Ask-first list. An item whose Direction already settles it needs no question.

## 1. Test first

- Behavior: a test per adapter (React, Vue, Solid — vanilla too when its wrapper is involved) in that package's `src/__tests__/`, next to the area's existing tests; logic: a pure-function test in core. See [testing](../../../docs/testing.md).
- Run it alone (`npx vitest run <path>` from the package) and confirm it fails for the reason the item describes.
- What jsdom can't show (layout, overflow, sizes, scroll) skips the test; step 3 measures it instead, before and after.

## 2. Fix

The smallest change closing the item, the same in every adapter (CLAUDE.md's Parity rule). Re-run the step 1 tests.

## 3. Look at it

- Solid demo (`npm run dev:solid`, `:58983`), at **1440×900** and **390×844**: for layout, `node scripts/ux-measure.mjs --name=ux-U<n> #section…` then `browser_run_code_unsafe` with `filename: .playwright-mcp/measure.js`; otherwise one `browser_run_code_unsafe` call per step that acts, measures what the item is about (focus, bounding boxes, accessible names) and screenshots to `.playwright-mcp/ux-U<n>-<what>.png`.
- Then the same check on the React (`:58981`) and Vue (`:58982`) demos — they render their own UI.
- This is the item's re-check — no separate ux-review run.

## 4. Close and commit

- Remove the item from improvements.md, or narrow it to what's left and say so.
- CLAUDE.md's Development workflow: `CHANGELOG.md` under `## [Unreleased]` in user-facing words, the feature doc updated, the demos if the fix adds something to show, a pitfall if something surprised.
- Commit (Conventional Commits, scope of the area): subject says what changed for the user, body names `U<n>` and why. The pre-commit hook runs the full checks.

## Report

One table — item, commit, how it was verified (tests, measurement, adapters checked) — then anything narrowed rather than closed, and side effects worth knowing.
