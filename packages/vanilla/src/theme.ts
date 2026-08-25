// Re-exports @vates/data-table-core's theme sub-path (LIGHT_THEME/DARK_THEME/renderThemeCss) so a
// vanilla consumer never needs to depend on @vates/data-table-core directly for it — same pattern
// as this package's own `/locales` re-export in index.tsx. Vanilla injects this CSS automatically
// via @vates/data-table-solid's `injectStyles()` on mount; this sub-path exists for a consumer who
// wants to read the theme tokens themselves (e.g. to theme their own surrounding UI to match).
export * from '@vates/data-table-core/theme'
