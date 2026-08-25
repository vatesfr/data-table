// `@vates/data-table-core/internal` — everything core exposes that exists solely so the adapter
// packages (`@vates/data-table-react`/`-vue`/`-solid`/`-vanilla`) can share implementation code
// with each other while building their own `useTableState`/`createTableState`/persistence
// implementations. This is NOT a supported public API: a consumer of one of the adapter packages
// should get everything they need from that adapter directly, not from this sub-path. See
// `index.ts` for the small, deliberate public surface, and this package's README ("Public API
// surface") for the full split rationale.
//
// `dropdownDomUtils.ts` is re-exported wholesale (`export *`) rather than folded into this file's
// own body, so its file-scoped `/// <reference lib="dom" />` (see that file's own top comment for
// why it's needed, and why it's scoped to just that file instead of the whole package) stays
// exactly where it is — this avoids duplicating that reasoning/reference here while still folding
// its contents into `/internal`'s reachable surface, per CLAUDE.md.

export * from './logic'
export * from './dropdownDomUtils'

export { encodeViewState, decodeViewState, buildViewStateSnapshot, resolveViewState } from './view'
export type { ViewStateSnapshotInput, ResolvedViewState, TableViewState } from './view'

export type { ViewStateApi, ResetViewOptions } from './viewPersistence'
export {
  loadViewFromStorage,
  saveOrClearViewInStorage,
  readViewFromUrlParam,
  writeViewToUrlParam,
  resetView,
} from './viewPersistence'
