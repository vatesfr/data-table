export * from './types'
export * from './logic'
export * from './locales'
export * from './view'
export * from './viewPersistence'
// `theme` (LIGHT_THEME/DARK_THEME/renderThemeCss) is vanilla-adapter-only plumbing — it injects a
// <style> tag since vanilla has no CSS-in-JS/scoped-style mechanism of its own (React/Vue theme
// via inline styles / scoped CSS instead, see "Visual hierarchy" in the docs). Deliberately not
// re-exported from the main barrel so React/Vue consumers importing this package directly don't
// see irrelevant theme APIs in their autocomplete; it's still reachable via the dedicated
// `@vates/data-table-core/theme` sub-path export, same pattern as `/locales`.
