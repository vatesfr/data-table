// Shared adapter implementation, not a public API: see `index.ts` and the README's "Public API surface".

export * from './logic'
export * from './dropdownDomUtils'
export * from './headerMenu'
export * from './filterChecklist'
export * from './checkboxSync'
export * from './tableWrap'
export * from './styles'
// Only the internal date-tree filter and the adapters' date-tree components need it
export type { DateTreeNode } from './types'

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
