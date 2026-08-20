# Cross-package API audit — findings (2026-08-20)

Audit of `packages/{core,react,vue,solid,vanilla}`'s public APIs, covering: cross-package
differences, non-idiomatic patterns per framework, and settings that should be
reactive/updatable but aren't. Produced by parallel per-package code audits (not just a
re-read of CLAUDE.md) — findings below are code-derived, not previously documented unless
noted.

Check off `[x]` as each item is fixed and re-verified, or mark `~~strikethrough~~` with a
one-line note if deliberately not fixed (e.g. "won't fix — acceptable trade-off, see #N").

---

## A. Cross-package differences

- [x] **A1. `labels`/`defaultGroupsCollapsed`/`getRowId` reactivity is inconsistent across
      adapters.** React and Vue treat these three options as live (React: recomputed every
      render / read directly with no capture; Vue: wrapped in `computed`). Solid captures all
      three once at construction (`labels` merged into a plain static object;
      `defaultGroupsCollapsed` a closed-over const, exposed via `group.defaultCollapsed()` but
      the value never changes; `getRowId` a closed-over const). Vanilla inherits Solid's frozen
      behavior. Not documented anywhere as an intentional difference — reads as Solid simply not
      having been built to match. Decide: make Solid/vanilla live to match React/Vue, or make
      React/Vue explicitly frozen to match Solid — then document the decision in CLAUDE.md.
  - Locations: `packages/react/src/useTableState.ts`, `packages/vue/src/useTableState.ts`,
    `packages/solid/src/createTableState.ts`.
  - **Resolved**: Solid's `createTableState` now accepts its whole `options` 3rd argument as a
    plain object or an `Accessor` returning one (mirroring Vue's own whole-`options`
    `MaybeRefOrGetter`), making `labels`/`defaultGroupsCollapsed`/`getRowId` live there too.
    `table.labels` is now a `createMemo` (`table.labels()`) instead of a plain object — a
    breaking change to Solid's own `TableState` shape, acceptable at `0.1.0`. Documented in
    CLAUDE.md's "Solid package" section.

- [x] **A2. `defaultVisibleColumns`/`defaultPageSize` are frozen-at-construction in all four
      adapters** (consistent, but worth confirming this is intentional given A1 makes the
      "default*" prefix an unreliable signal — `defaultGroupsCollapsed` is live in two adapters
      while these two are frozen everywhere). If kept frozen, document explicitly in each
      adapter's `types.ts`/README that these are seed-only and later prop/option changes are
      silently ignored except by an explicit `setViewState` call.
  - **Resolved via documentation, no code change** — kept frozen (deliberately, not a bug);
    documented explicitly in CLAUDE.md's "Solid package" and "Vanilla package" sections as
    seed-only across every adapter.

- [x] **A3. Vanilla's `data`/`columns` are passed to `createTableState` as plain values, never
      as Accessors**, so vanilla gets none of the "auto-syncs to a live reactive source"
      convenience Solid's own `createTableState` supports for Accessor-typed args. Confirm this
      is the intended contract (vanilla has no reactive source to feed one from) rather than an
      unexploited capability, and document it in `packages/vanilla`'s CLAUDE.md section if so.
  - Location: `packages/vanilla/src/index.tsx` (`createTableState(options.data,
options.columns, {...})`).
  - **Resolved via documentation, no code change** — confirmed intended (vanilla's own
    `options` object has no reactivity of its own to feed an Accessor from); documented in
    CLAUDE.md's "Vanilla package" section.

- [x] **A4. Vanilla's `DataTableInstance` method names don't map 1:1 onto
      `TableState.selection`.** `clearSelection()`/`setSelection()`/`getSelection()` vs.
      `selection.clear()`/`selection.setAll()`/`selection.all`. `setAll` exists **only** on
      Solid's `TableState` (added specifically to back vanilla's `setSelection` — see
      `createTableState.ts` comment) — React/Vue's `TableState.selection` has no equivalent
      method at all. Consider either renaming vanilla's methods to read as obvious aliases, or
      adding a doc note in CLAUDE.md's "Row selection" section cross-referencing the mapping so
      it isn't rediscovered by hand each time.
  - **Resolved via documentation, no rename** — added a cross-reference note to CLAUDE.md's
    "Row selection" section listing the three name mappings.

- ~~**A5. Persistence helpers have no shared naming convention across packages**~~ — no action
  taken; low priority, each naming scheme is already justified by its own
  hooks-vs-plain-function convention. Won't fix.

- [x] **A6. Core's pipeline functions disagree on where `columns` and `emptyLabel` sit in the
      parameter list**, risking transposition bugs when adapter code chains several calls:
  - `columns` position: `computeStringValues` (2), `searchData`/`groupData` (3),
    `sortWithinGroups`/`computeStringValueCounts` (4), `processData` (5).
  - `emptyLabel` position: `multiValues`/`computeDateTree` (2), `computeStringValues`/
    `groupData` (3), `processData`/`computeStringValueCounts` (5).
    Consider standardizing on one position for `columns` (e.g. always last-but-optional, or
    always position 2) across all `logic.ts` pipeline functions — a breaking change, so batch
    it with another planned breaking release.
  - Location: `packages/core/src/logic.ts`.
  - **Resolved, narrower scope than originally framed** — re-reading `logic.ts` directly showed
    `columns`/`emptyLabel` are already adjacent wherever both appear; the position drift just
    reflects each function's own differing count of preceding required params, not a real
    inconsistency worth reordering. The one genuine drift was `columns` being **optional**
    (defaulting to `[]`) in `processData`/`groupData`/`sortWithinGroups` but **required** in
    their siblings — fixed by making it required in all six (breaking change; every real call
    site already passed it). No parameter reordering was done.

---

## B. Non-idiomatic approaches

- [x] **B1. [BUG, not just style] Vanilla's `destroy()` leaks a permanent
      `document`-level click listener per Dropdown, every time a table is destroyed.**
      `render()` (from `solid-js/web`) creates its _own_ internal `createRoot` and returns a
      disposer that `index.tsx` discards; the outer `createRoot` the wrapper captures as
      `dispose` never reaches that inner root's `owned` tree (traced through solid-js's
      `createRoot`/`cleanNode` — a nested root is only linked via `.owner`, never registered in
      the parent's `.owned`). Concretely: `Dropdown.tsx`'s `onMount` registers a capture-phase
      `document.addEventListener('click', ...)` cleaned up via `onCleanup`, but that `onCleanup`
      never fires on `destroy()`. Every `createDataTable(...)` call mounts 3–4 Dropdowns
      (Columns/Sort/Filter always, Group when applicable) — so every destroyed table leaves 3–4
      permanent listeners holding closures over its disposed state. Existing tests
      (`createDataTable.toolbar.test.tsx`) only assert `container.innerHTML === ''`, which stays
      true, so this is untested.
      **Fix**: capture `render()`'s own returned disposer in `index.tsx` and call _that_ (not
      just the outer `createRoot`'s) inside `destroy()`.
  - Location: `packages/vanilla/src/index.tsx`.
  - **Fixed** — `render()`'s own returned disposer is now captured (`disposeView`) and called
    in `destroy()` alongside the outer root's `dispose()`. Regression test spies on
    `document.addEventListener`/`removeEventListener` across a create+destroy cycle.

- [x] **B2. Vue's `isRowClickable`/`rowClickable` detection isn't actually reactive.** Both
      `DataTable.vue` and `DataTableView.vue` read
      `getCurrentInstance()?.vnode.props?.onRowClick` — a non-tracked raw property access.
      `DataTableView.vue` wraps it in `computed()`, but the only tracked dependency is
      `props.rowClickable` itself, so the `vnode.props` read effectively only happens once.
      Toggling an `@row-click` listener at runtime after mount has no effect on clickable
      styling. Fix or document as a known limitation.
  - Locations: `packages/vue/src/DataTable.vue` (`isRowClickable` const), `DataTableView.vue`
    (`computed` at ~line 56-58).
  - **Fixed** — both now hold the self-detected value in a `ref`, re-derived in `onUpdated`
    (runs after every re-render, by which point `vnode.props` reflects the latest listener).

- [x] **B3. Vue's `ref` vs `shallowRef` policy is inconsistent.** `selection`/
      `selectionAnchor` correctly use `shallowRef` (documented: always replaced wholesale, never
      mutated in place — and `UnwrapRefSimple<TRow>` would break the generic constraint
      otherwise). But `visibleCols`, `collapsedGroups`, `filters`, `excludeFilters`, `sorts`,
      `groupBy`, `columnOrder` follow the exact same "always replaced wholesale" pattern yet use
      plain `ref`, incurring unnecessary deep-Proxy wrapping on every `.value` access. Consider
      switching these to `shallowRef` for consistency (no behavior change expected, since nothing
      mutates them in place).
  - Location: `packages/vue/src/useTableState.ts`.
  - **Fixed** — all switched to `shallowRef`; full suite green, no behavior change.

- [x] **B4. Vue's `vIndeterminate` directive is duplicated verbatim** in
      `DataTableView.vue` and `components/DateTreeItem.vue` instead of being defined once and
      imported. Low priority, pure DRY cleanup.
  - **Fixed** — extracted to `packages/vue/src/directives/vIndeterminate.ts`, imported by both.

- [x] **B5. React's memoization policy differs between `useTableState.ts` and
      `DataTableView.tsx`.** The hook manually `useMemo`s every derived value with explicit dep
      arrays. The view component instead leaves several derived values
      (`stringValueCounts`, `filterDetailBounds`, `filterDetailValues`, `filterDetailTree`)
      un-memoized, with a comment asserting "the React Compiler auto-memoizes this." **Action
      item: confirm the React Compiler is actually enabled and verified for this package's
      build** — if it isn't, these recompute on every render for no reason. If confirmed enabled,
      at least leave a pointer comment in `useTableState.ts` explaining why _that_ file still
      memoizes manually (consistency note) so a future reader doesn't wonder why the two files
      disagree.
  - Location: `packages/react/src/DataTableView.tsx` (~lines 1010-1308) vs.
    `packages/react/src/useTableState.ts`.
  - **Resolved differently than planned** — confirmed `vite.config.ts` doesn't wire in the
    actual React Compiler babel plugin, so the original comment's premise was false and these
    do recompute every render. The planned fix (wrap in manual `useMemo`) was attempted but
    **rejected by `eslint-plugin-react-hooks@7`'s `recommended` ruleset**
    (`react-hooks/preserve-manual-memoization`), which is already enforced in
    `eslint.config.mjs` in preparation for eventually enabling the real compiler — it flagged
    the hand-written `useMemo` as unpreservable. Reverted the `useMemo` attempt; replaced the
    comment with an accurate one instead. No behavior change.

- [x] **B6. Core naming inconsistencies** (lower priority, cosmetic/discoverability):
  - `toggleSort`/`appendOrToggleSort` are true multi-state cycles (none→dir→opposite→none /
    add→flip) but keep the "toggle" verb instead of "cycle" like `cycleValueSort`/
    `cycleFilterValue` — the `replaceSort` doc comment itself admits the three read as
    confusing near-synonyms.
  - ~~`calcTotalPages` is the only `calc*`-prefixed function~~ — **renamed to
    `computeTotalPages`**.
  - ~~`selectedRowsOf` breaks the verb-first convention~~ — **renamed to `getSelectedRows`**.
  - `sumDateTreeNodeCount` is the only `sum*`-prefixed function among otherwise `compute*`/
    `get*`-named aggregation helpers.
  - `toggleFilterAll` (verb+Object+"All") vs. `toggleAllInSelection` (verb+"All"+In+Object) —
    same "toggle...all" concept, inverted word order.
  - Location: `packages/core/src/logic.ts`.
  - **Partially resolved** — only the two clearest, highest-value renames were made (see
    above); `toggleSort`/`appendOrToggleSort` naming, `sumDateTreeNodeCount`, and the
    `toggleFilterAll`/`toggleAllInSelection` word-order mismatch are left as-is — lower signal,
    not worth further breaking churn for a cosmetic gain.

- [x] **B7. Core internal duplication** (cosmetic/maintenance, not user-facing):
  - `getComparableValue(col, row)` and `comparableFromKeyPart(col, keyPart)` have identical
    type-coercion bodies (date/number/raw), differing only in how the raw value is obtained.
    Could share one `coerceByType(col, raw)` helper.
  - `toggleFilterAll`'s body duplicates `setFilterValues`'s add/delete loop plus a
    `someSelected` check up front — could be rewritten as
    `setFilterValues(filters, key, values, !someSelected)`.
  - The five selection-identity functions (`isRowSelected`, `getSelectedRows`,
    `toggleRowInSelection`, `toggleAllInSelection`, `reconcileSelection`) each hand-roll the
    same `if (!getRowId) {identity} else {id-map}` branching — intentional per existing
    comment, but still five repetitions of one pattern.
  - Location: `packages/core/src/logic.ts`.
  - **Fixed** — `coerceByType` extracted and shared; `toggleFilterAll` now delegates to
    `setFilterValues`. The five-function `getRowId?` branching repetition was left as-is
    (already flagged as intentional in the existing comment there).

- [x] **B8. Vanilla wrapper imposes static-only behavior on options that have no underlying
      reason to be static.** `rowKey`, `selectable`, `onRowClick` are destructured into plain
      consts in `index.tsx` and passed to `DataTableView` once — but `DataTableView` already
      reads `props.rowKey`/`props.selectable`/`props.onRowClick` in a way that would stay
      reactive if the wrapper threaded a signal through. Pure wrapper-layer gap (no Solid-layer
      change needed), distinct from A1/A2's options which are frozen at the Solid layer itself.
  - Location: `packages/vanilla/src/index.tsx`.
  - **Fixed** — each wrapped in its own `createSignal`; see C2.

---

## C. Settings that should be reactive/updatable and aren't

- [x] **C1. [Highest value, easy fix] Vanilla's `onSelectionChange` has no way to attach a
      listener after construction.** Unlike `onViewChange(cb)`, which is exactly this
      subscribe/unsubscribe pattern and already exists in the same file, `onSelectionChange` is
      wired into a single `createEffect` only if passed at construction time — there's no
      `onSelectionChange(cb)` method on `DataTableInstance` to add one later. Add one, mirroring
      `onViewChange`'s existing implementation.
  - Location: `packages/vanilla/src/index.tsx`, `packages/vanilla/src/types.ts`
    (`DataTableInstance`).
  - **Fixed** — `selectionChangeListeners` is now a `Set`, seeded with the constructor option;
    `onSelectionChange(cb): () => void` added to `DataTableInstance`.

- [x] **C2. Vanilla: `rowKey`, `selectable`, `onRowClick` should be updatable post-construction**
      the same way `setData`/`setColumns` are — see B8, same underlying fix.
  - **Fixed** — `setRowKey`/`setSelectable`/`setOnRowClick` added to `DataTableInstance`.

- [x] **C3. Solid (and therefore vanilla, transitively): `labels`, `defaultGroupsCollapsed`,
      `getRowId` are frozen at the `createTableState` layer** — see A1. If parity with React/Vue
      is the chosen resolution, these three need to accept `Accessor`s the same way
      `data`/`columns` already do in `createTableState.ts`.
  - **Fixed** — see A1. `setLabels`/`setDefaultGroupsCollapsed`/`setGetRowId` also added to
    vanilla's `DataTableInstance`, backed by the same mechanism.

- [x] **C4. React/Vue: `defaultVisibleColumns`/`defaultPageSize` are silently inert after
      mount** — changing them only affects a later explicit `setViewState`/`getViewState()` call,
      not the live table state. See A2 — either make them live or document the freeze explicitly
      in each adapter's `types.ts`.
  - **Resolved via documentation, no code change** — kept frozen; see A2.

- [x] **C5. Vanilla's `data`/`columns` never use Solid's Accessor mechanism** — see A3.
      Confirm intended, or thread accessors through if there's a real use case (e.g. a future
      vanilla consumer with its own reactive data source wanting to skip manual `setData` calls).
  - **Resolved via documentation, no code change** — confirmed intended; see A3.

---

## Suggested fix order

1. **B1** (vanilla `destroy()` leak — real bug, currently silent and untested)
2. **C1** (`onSelectionChange` subscribe gap — small, high-value, mirrors existing
   `onViewChange` pattern)
3. **A1** (decide + document the labels/defaultGroupsCollapsed/getRowId reactivity policy
   across all adapters) → then **C3**
4. **B2** (Vue `rowClickable` reactivity)
5. Everything else (B3–B8, A2/A4–A6, C2/C4/C5) — lower severity, batch opportunistically or
   alongside another breaking-change release given some (A6) require breaking core's
   parameter order.

---

## Status: all items resolved (2026-08-20)

Every item above is checked off, either fixed in code (A1, A6 in narrowed scope, B1–B4, B6 in
narrowed scope, B7, B8, C1–C3) or resolved via a documentation-only decision with no code
change (A2, A3, A4, C4, C5), with A5 explicitly left as won't-fix. See the individual **Fixed**/
**Resolved**/**Partially resolved** notes above for what actually happened at each item,
including two places where the actual outcome differed from the original plan (A6's scope was
narrowed after re-reading `logic.ts` directly; B5's fix turned out to be rejected by an
already-enforced ESLint rule, so the comment was corrected instead of adding memoization).
Implemented across 10 commits on the `fix/api-audit-findings` branch, each independently
type-checked, tested, and built across all five packages.
