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

- [ ] **A1. `labels`/`defaultGroupsCollapsed`/`getRowId` reactivity is inconsistent across
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

- [ ] **A2. `defaultVisibleColumns`/`defaultPageSize` are frozen-at-construction in all four
      adapters** (consistent, but worth confirming this is intentional given A1 makes the
      "default*" prefix an unreliable signal — `defaultGroupsCollapsed` is live in two adapters
      while these two are frozen everywhere). If kept frozen, document explicitly in each
      adapter's `types.ts`/README that these are seed-only and later prop/option changes are
      silently ignored except by an explicit `setViewState` call.

- [ ] **A3. Vanilla's `data`/`columns` are passed to `createTableState` as plain values, never
      as Accessors**, so vanilla gets none of the "auto-syncs to a live reactive source"
      convenience Solid's own `createTableState` supports for Accessor-typed args. Confirm this
      is the intended contract (vanilla has no reactive source to feed one from) rather than an
      unexploited capability, and document it in `packages/vanilla`'s CLAUDE.md section if so.
  - Location: `packages/vanilla/src/index.tsx` (`createTableState(options.data,
options.columns, {...})`).

- [ ] **A4. Vanilla's `DataTableInstance` method names don't map 1:1 onto
      `TableState.selection`.** `clearSelection()`/`setSelection()`/`getSelection()` vs.
      `selection.clear()`/`selection.setAll()`/`selection.all`. `setAll` exists **only** on
      Solid's `TableState` (added specifically to back vanilla's `setSelection` — see
      `createTableState.ts` comment) — React/Vue's `TableState.selection` has no equivalent
      method at all. Consider either renaming vanilla's methods to read as obvious aliases, or
      adding a doc note in CLAUDE.md's "Row selection" section cross-referencing the mapping so
      it isn't rediscovered by hand each time.

- [ ] **A5. Persistence helpers have no shared naming convention across packages**
      (`persistViewToLocalStorage`/`syncViewToUrl`/`persistView` vanilla vs.
      `usePersistedView`/`useUrlView`/`usePersistence` React/Vue/Solid) — expected given
      hooks-vs-plain-function conventions, but only `resetView` kept an identical name in all
      four. Low priority; flagging for awareness, not necessarily a fix.

- [ ] **A6. Core's pipeline functions disagree on where `columns` and `emptyLabel` sit in the
      parameter list**, risking transposition bugs when adapter code chains several calls:
  - `columns` position: `computeStringValues` (2), `searchData`/`groupData` (3),
    `sortWithinGroups`/`computeStringValueCounts` (4), `processData` (5).
  - `emptyLabel` position: `multiValues`/`computeDateTree` (2), `computeStringValues`/
    `groupData` (3), `processData`/`computeStringValueCounts` (5).
    Consider standardizing on one position for `columns` (e.g. always last-but-optional, or
    always position 2) across all `logic.ts` pipeline functions — a breaking change, so batch
    it with another planned breaking release.
  - Location: `packages/core/src/logic.ts`.

---

## B. Non-idiomatic approaches

- [ ] **B1. [BUG, not just style] Vanilla's `destroy()` leaks a permanent
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

- [ ] **B2. Vue's `isRowClickable`/`rowClickable` detection isn't actually reactive.** Both
      `DataTable.vue` and `DataTableView.vue` read
      `getCurrentInstance()?.vnode.props?.onRowClick` — a non-tracked raw property access.
      `DataTableView.vue` wraps it in `computed()`, but the only tracked dependency is
      `props.rowClickable` itself, so the `vnode.props` read effectively only happens once.
      Toggling an `@row-click` listener at runtime after mount has no effect on clickable
      styling. Fix or document as a known limitation.
  - Locations: `packages/vue/src/DataTable.vue` (`isRowClickable` const), `DataTableView.vue`
    (`computed` at ~line 56-58).

- [ ] **B3. Vue's `ref` vs `shallowRef` policy is inconsistent.** `selection`/
      `selectionAnchor` correctly use `shallowRef` (documented: always replaced wholesale, never
      mutated in place — and `UnwrapRefSimple<TRow>` would break the generic constraint
      otherwise). But `visibleCols`, `collapsedGroups`, `filters`, `excludeFilters`, `sorts`,
      `groupBy`, `columnOrder` follow the exact same "always replaced wholesale" pattern yet use
      plain `ref`, incurring unnecessary deep-Proxy wrapping on every `.value` access. Consider
      switching these to `shallowRef` for consistency (no behavior change expected, since nothing
      mutates them in place).
  - Location: `packages/vue/src/useTableState.ts`.

- [ ] **B4. Vue's `vIndeterminate` directive is duplicated verbatim** in
      `DataTableView.vue` and `components/DateTreeItem.vue` instead of being defined once and
      imported. Low priority, pure DRY cleanup.

- [ ] **B5. React's memoization policy differs between `useTableState.ts` and
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

- [ ] **B6. Core naming inconsistencies** (lower priority, cosmetic/discoverability):
  - `toggleSort`/`appendOrToggleSort` are true multi-state cycles (none→dir→opposite→none /
    add→flip) but keep the "toggle" verb instead of "cycle" like `cycleValueSort`/
    `cycleFilterValue` — the `replaceSort` doc comment itself admits the three read as
    confusing near-synonyms.
  - `calcTotalPages` is the only `calc*`-prefixed function next to a consistent `compute*`
    family (`computeStringValueCounts`, `computeValueBounds`, `computeDateTree`,
    `computeAggregate`, `computeVirtualRange`).
  - `selectedRowsOf` breaks the verb-first convention its own siblings use
    (`isRowSelected`, `toggleRowInSelection`, `reconcileSelection`) — `getSelectedRows` would
    match better.
  - `sumDateTreeNodeCount` is the only `sum*`-prefixed function among otherwise `compute*`/
    `get*`-named aggregation helpers.
  - `toggleFilterAll` (verb+Object+"All") vs. `toggleAllInSelection` (verb+"All"+In+Object) —
    same "toggle...all" concept, inverted word order.
  - Location: `packages/core/src/logic.ts`.

- [ ] **B7. Core internal duplication** (cosmetic/maintenance, not user-facing):
  - `getComparableValue(col, row)` and `comparableFromKeyPart(col, keyPart)` have identical
    type-coercion bodies (date/number/raw), differing only in how the raw value is obtained.
    Could share one `coerceByType(col, raw)` helper.
  - `toggleFilterAll`'s body duplicates `setFilterValues`'s add/delete loop plus a
    `someSelected` check up front — could be rewritten as
    `setFilterValues(filters, key, values, !someSelected)`.
  - The five selection-identity functions (`isRowSelected`, `selectedRowsOf`,
    `toggleRowInSelection`, `toggleAllInSelection`, `reconcileSelection`) each hand-roll the
    same `if (!getRowId) {identity} else {id-map}` branching — intentional per existing
    comment, but still five repetitions of one pattern.
  - Location: `packages/core/src/logic.ts`.

- [ ] **B8. Vanilla wrapper imposes static-only behavior on options that have no underlying
      reason to be static.** `rowKey`, `selectable`, `onRowClick` are destructured into plain
      consts in `index.tsx` and passed to `DataTableView` once — but `DataTableView` already
      reads `props.rowKey`/`props.selectable`/`props.onRowClick` in a way that would stay
      reactive if the wrapper threaded a signal through. Pure wrapper-layer gap (no Solid-layer
      change needed), distinct from A1/A2's options which are frozen at the Solid layer itself.
  - Location: `packages/vanilla/src/index.tsx`.

---

## C. Settings that should be reactive/updatable and aren't

- [ ] **C1. [Highest value, easy fix] Vanilla's `onSelectionChange` has no way to attach a
      listener after construction.** Unlike `onViewChange(cb)`, which is exactly this
      subscribe/unsubscribe pattern and already exists in the same file, `onSelectionChange` is
      wired into a single `createEffect` only if passed at construction time — there's no
      `onSelectionChange(cb)` method on `DataTableInstance` to add one later. Add one, mirroring
      `onViewChange`'s existing implementation.
  - Location: `packages/vanilla/src/index.tsx`, `packages/vanilla/src/types.ts`
    (`DataTableInstance`).

- [ ] **C2. Vanilla: `rowKey`, `selectable`, `onRowClick` should be updatable post-construction**
      the same way `setData`/`setColumns` are — see B8, same underlying fix.

- [ ] **C3. Solid (and therefore vanilla, transitively): `labels`, `defaultGroupsCollapsed`,
      `getRowId` are frozen at the `createTableState` layer** — see A1. If parity with React/Vue
      is the chosen resolution, these three need to accept `Accessor`s the same way
      `data`/`columns` already do in `createTableState.ts`.

- [ ] **C4. React/Vue: `defaultVisibleColumns`/`defaultPageSize` are silently inert after
      mount** — changing them only affects a later explicit `setViewState`/`getViewState()` call,
      not the live table state. See A2 — either make them live or document the freeze explicitly
      in each adapter's `types.ts`.

- [ ] **C5. Vanilla's `data`/`columns` never use Solid's Accessor mechanism** — see A3.
      Confirm intended, or thread accessors through if there's a real use case (e.g. a future
      vanilla consumer with its own reactive data source wanting to skip manual `setData` calls).

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
