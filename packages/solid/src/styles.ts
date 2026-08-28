import { renderThemeCss } from '@vates/data-table-core/theme'

export const STYLES = `
${renderThemeCss()}
.dt{font-family:inherit;font-size:14px;color:var(--color-text-primary,#1a1916)}
.dt-toolbar{padding:12px 0;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea)}
.dt-toolbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dt-toolbar-divider{width:1px;height:22px;background:var(--color-border-secondary,#dddcd8);flex-shrink:0;margin:0 2px}
.dt-clear-all{margin-left:auto}
.dt-stats{margin-left:auto;font-size:12px;color:var(--color-text-secondary,#6b6a66);white-space:nowrap}
.dt-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;font-size:13px;cursor:pointer;color:var(--color-text-primary,#1a1916);font-family:inherit;line-height:1}
.dt-btn--active{background:var(--color-background-secondary,#f7f6f3)}
.dt-btn-group{display:inline-flex}
.dt-btn--grouped{border-radius:6px 0 0 6px;border-right:none}
.dt-btn-clear{display:inline-flex;align-items:center;padding:5px 8px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:0 6px 6px 0;font-size:14px;line-height:1;cursor:pointer;color:var(--color-text-tertiary,#9b9a96);font-family:inherit}
.dt-btn-clear:hover{color:var(--color-text-primary,#1a1916)}
.dt-dd-wrap{position:relative}
.dt-dd{position:absolute;top:calc(100% + 4px);left:0;z-index:100;background:var(--color-background-primary,#fff);border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:180px;max-height:420px;overflow-y:auto}
.dt-dd--up{top:auto;bottom:calc(100% + 4px)}
.dt-dd-search-row{position:sticky;top:0;display:flex;background:var(--color-background-primary,#fff);padding:6px 12px;z-index:1}
.dt-filter-cols-search{position:sticky;top:0;display:block;width:100%;box-sizing:border-box;margin-bottom:4px;background:var(--color-background-primary,#fff);z-index:1}
.dt-dd-section{padding:6px 14px 2px;font-size:11px;color:var(--color-text-tertiary,#9b9a96);font-weight:500;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.dt-dd-sublabel{font-size:12px;margin-bottom:4px;color:var(--color-text-secondary,#6b6a66)}
.dt-dd-hint{padding:0 14px 6px;font-size:11px;color:var(--color-text-tertiary,#9b9a96)}
.dt-dd-item{display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:13px;color:var(--color-text-primary,#1a1916);cursor:default;border:none;background:none;font-family:inherit;text-align:left;margin:0;width:100%;box-sizing:border-box}
.dt-dd-item--click{cursor:pointer}
.dt-dd-item--click:hover{background:var(--color-background-secondary,#f7f6f3)}
.dt-dd-item--col{justify-content:space-between}
.dt-dd-item--sortrow{cursor:pointer}
.dt-dd-item--sortrow:hover{background:var(--color-background-secondary,#f7f6f3)}
.dt-dd-item--grouprow{cursor:grab}
.dt-dd-item--colrow{cursor:grab}
.dt-dd-item--dragging{opacity:.4}
.dt-dd-item--drag-over{box-shadow:inset 0 2px 0 var(--color-text-primary,#1a1916)}
.dt-dd-item--drag-over-after{box-shadow:inset 0 -2px 0 var(--color-text-primary,#1a1916)}
.dt-dd-item--exclude{color:var(--color-text-danger,#a5182f)}
.dt-dd-item--exclude input[type=checkbox]{accent-color:var(--color-text-danger,#a5182f)}
.dt-flex1{flex:1}
.dt-filter-count{font-size:12px;color:var(--color-text-tertiary,#9b9a96);flex-shrink:0}
.dt-item-remove{background:none;border:none;cursor:pointer;padding:2px 4px;font-size:13px;color:var(--color-text-tertiary,#9b9a96);line-height:1;font-family:inherit}
.dt-item-remove:hover{color:var(--color-text-primary,#1a1916)}
.dt-sort-idx{width:18px;font-size:11px;color:var(--color-text-tertiary,#9b9a96);font-weight:500;flex-shrink:0}
.dt-sort-icon{font-size:15px;color:var(--color-border-secondary,#dddcd8)}
.dt-sort-icon--active{color:var(--color-text-primary,#1a1916)}
.dt-range-input{width:80px;padding:3px 6px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;font-family:inherit;background:transparent;color:inherit}
.dt-range-input[type=date]{width:118px}
.dt-range-sep{color:var(--color-text-tertiary,#9b9a96);font-size:12px}
.dt-range-slider{position:relative;height:22px;margin:8px 2px 2px}
.dt-range-slider-track{position:absolute;top:50%;left:7px;right:7px;height:4px;margin-top:-2px;border-radius:2px;background:var(--color-border-secondary,#dddcd8)}
.dt-range-slider-fill{position:absolute;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:var(--color-text-info,#185fa5)}
.dt-range-slider-thumb{position:absolute;left:0;right:0;top:0;width:100%;height:22px;margin:0;padding:0;background:transparent;border:none;-webkit-appearance:none;-moz-appearance:none;appearance:none;pointer-events:none}
.dt-range-slider-thumb::-webkit-slider-runnable-track{background:transparent}
.dt-range-slider-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;pointer-events:auto;width:14px;height:14px;margin-top:4px;border-radius:50%;background:var(--color-text-info,#185fa5);border:2px solid var(--color-background-primary,#fff);box-shadow:0 0 0 1px var(--color-border-info,#b8d6f5);cursor:pointer}
.dt-range-slider-thumb::-moz-range-track{background:transparent;border:none}
.dt-range-slider-thumb::-moz-range-thumb{pointer-events:auto;width:14px;height:14px;border-radius:50%;background:var(--color-text-info,#185fa5);border:2px solid var(--color-background-primary,#fff);box-shadow:0 0 0 1px var(--color-border-info,#b8d6f5);cursor:pointer}
.dt-active-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 0}
.dt-chip{display:inline-flex;align-items:center;font-size:12px}
.dt-chip-body{background:var(--color-background-secondary,#f7f6f3);border:0.5px solid var(--color-border-secondary,#dddcd8);border-right:none;border-radius:12px 0 0 12px;padding:2px 4px 2px 8px;font-size:12px;color:var(--color-text-secondary,#6b6a66);font-family:inherit;cursor:pointer;line-height:1.4}
.dt-chip-body:hover{background:var(--color-background-tertiary,#f1efe9)}
.dt-chip-x{cursor:pointer;background:var(--color-background-secondary,#f7f6f3);border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:0 12px 12px 0;padding:2px 8px 2px 2px;font-size:12px;color:var(--color-text-secondary,#6b6a66);font-family:inherit;line-height:1.4}
.dt-chip-x:hover{color:var(--color-text-primary,#1a1916)}
.dt-chip--filter .dt-chip-body,.dt-chip--filter .dt-chip-x{background:var(--color-background-info,#e6f1fb);color:var(--color-text-info,#185fa5);border-color:var(--color-border-info,#b8d6f5)}
.dt-chip--exclude .dt-chip-body,.dt-chip--exclude .dt-chip-x{background:var(--color-background-danger,#fbe9e9);color:var(--color-text-danger,#a5182f);border-color:var(--color-border-danger,#f2c2c2)}
.dt-chip--grouped-sort .dt-chip-body + .dt-chip-x{border-radius:0;border-right:none}
.dt-chip-group-mark{cursor:pointer;background:var(--color-background-secondary,#f7f6f3);border:0.5px solid var(--color-border-secondary,#dddcd8);border-right:none;border-radius:0;padding:2px 5px;font-size:12px;color:var(--color-text-tertiary,#9b9a96);font-family:inherit;line-height:1.4}
.dt-chip-group-mark:hover{background:var(--color-background-tertiary,#f1efe9);color:var(--color-text-primary,#1a1916)}
.dt-table-wrap{overflow-x:auto;border:0.5px solid var(--color-border-tertiary,#eeedea);border-radius:8px;margin-top:12px}
.dt-table{width:100%;border-collapse:collapse;font-size:13px}
.dt-th{padding:8px 12px;text-align:left;font-weight:500;font-size:12px;background:var(--color-background-tertiary,#eae9e5);color:var(--color-text-secondary,#6b6a66);border-bottom:1px solid var(--color-border-secondary,#dddcd8);white-space:nowrap;user-select:none;cursor:pointer}
.dt-th--no-sort{cursor:default}
.dt-th--dragging{opacity:.4}
.dt-th--drag-over{box-shadow:inset 2px 0 0 var(--color-text-primary,#1a1916)}
.dt-th-inner{display:inline-flex;align-items:center;gap:4px}
.dt-td{padding:8px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);color:var(--color-text-primary,#1a1916);vertical-align:middle}
.dt-tr--odd .dt-td{background:color-mix(in srgb,var(--color-background-secondary,#f7f6f3) 45%,transparent)}
.dt-tr--clickable{cursor:pointer}
.dt-tr--clickable:hover .dt-td{background:var(--color-background-secondary,#f7f6f3)}
.dt-tr--selected .dt-td{background:var(--color-background-info,#e6f1fb)}
.dt-group-row{background:var(--color-background-secondary,#f7f6f3);border-left:3px solid var(--color-border-secondary,#dddcd8);font-weight:600;font-size:12px;color:var(--color-text-primary,#1a1916);cursor:pointer}
.dt-group-td{padding:6px 12px;border-bottom:1px solid var(--color-border-secondary,#dddcd8)}
.dt-group-sep{margin:0 4px;opacity:.4}
.dt-group-colname{margin-right:4px;opacity:.6}
.dt-group-count{margin-left:10px;font-weight:400;opacity:.6}
.dt-group-continued{margin-left:8px;font-weight:400;opacity:.6}
.dt-pagination{display:flex;align-items:center;gap:6px;padding:10px 2px;justify-content:flex-end;flex-wrap:wrap}
.dt-page-btn{padding:4px 9px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;cursor:pointer;font-size:13px;color:var(--color-text-primary,#1a1916);font-family:inherit;line-height:1}
.dt-page-btn:disabled{opacity:.35;cursor:default}
.dt-page-info{font-size:12px;color:var(--color-text-secondary,#6b6a66);padding:0 6px}
.dt-page-select{padding:4px 6px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;background:transparent;color:inherit;font-family:inherit;cursor:pointer}
.dt-rows-per-page-group{display:inline-flex;align-items:center;gap:6px;margin-left:10px}
.dt-rows-per-page{font-size:12px;color:var(--color-text-secondary,#6b6a66)}
.dt-search-wrap{position:relative;display:inline-flex;flex:1;min-width:160px;max-width:280px}
.dt-search-input{padding:4px 24px 4px 8px;font-size:13px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;background:transparent;color:inherit;font-family:inherit;width:100%}
.dt-search-clear{position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;color:var(--color-text-tertiary,#9b9a96);font-family:inherit}
.dt-search-clear:hover{color:var(--color-text-primary,#1a1916)}
.dt-filter-panel{display:flex;min-width:460px;max-height:380px;overflow:hidden}
.dt-filter-cols{width:150px;flex-shrink:0;overflow-y:auto;border-right:0.5px solid var(--color-border-tertiary,#eeedea);padding:4px 0}
.dt-filter-col-row{display:flex;align-items:stretch}
.dt-filter-col-row:hover,.dt-filter-col-row--active{background:var(--color-background-secondary,#f7f6f3)}
.dt-filter-col-item{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 10px;font-size:13px;cursor:pointer;color:var(--color-text-primary,#1a1916);border:none;background:none;font-family:inherit;text-align:left;margin:0;flex:1 1 auto;min-width:0;overflow:hidden;box-sizing:border-box}
.dt-filter-col-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dt-filter-col-item--active{font-weight:500}
.dt-filter-col-clear{flex-shrink:0;display:flex;align-items:center;padding:0 10px;font-size:13px;line-height:1;cursor:pointer;color:var(--color-text-tertiary,#9b9a96);border:none;background:none;font-family:inherit}
.dt-filter-col-clear:hover{color:var(--color-text-primary,#1a1916)}
.dt-filter-category-header{display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;font-size:13px;font-weight:500;cursor:pointer;color:var(--color-text-secondary,#6b6a66);border:none;background:none;font-family:inherit;text-align:left;margin:0;box-sizing:border-box}
.dt-filter-category-header:hover{background:var(--color-background-secondary,#f7f6f3)}
.dt-filter-category-toggle{flex-shrink:0;font-size:10px;color:var(--color-text-tertiary,#9b9a96)}
.dt-filter-category-cols .dt-filter-col-item{padding-left:22px}
.dt-filter-detail{flex:1;padding:6px 0;min-width:220px;display:flex;flex-direction:column;min-height:0}
.dt-filter-list{overflow-y:auto;flex:1;min-height:0}
.dt-date-tree-wrap{overflow-y:auto;flex:1;min-height:0}
.dt-filter-search-row{display:flex;align-items:center;gap:6px;margin:2px 12px 6px}
.dt-dd-search{flex:1;padding:5px 8px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;background:transparent;color:inherit;font-family:inherit;box-sizing:border-box}
.dt-filter-select-all{flex-shrink:0;margin:0}
.dt-value-sort-btn{flex-shrink:0;padding:4px 7px;font-size:11px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;cursor:pointer;color:var(--color-text-secondary,#6b6a66);font-family:inherit;white-space:nowrap}
.dt-filter-match-mode-group{display:inline-flex;flex-shrink:0}
.dt-filter-match-mode--left{border-radius:6px 0 0 6px;border-right:none}
.dt-filter-match-mode--right{border-radius:0 6px 6px 0}
.dt-filter-match-mode--active{background:var(--color-background-secondary,#f7f6f3);color:var(--color-text-primary,#1a1916);font-weight:500}
.dt-date-tree-item{display:flex;align-items:center;gap:8px;padding:5px 14px;font-size:13px;color:var(--color-text-primary,#1a1916);cursor:pointer}
.dt-date-tree-toggle{width:14px;flex-shrink:0;text-align:center;font-size:10px;color:var(--color-text-tertiary,#9b9a96)}
.dt-date-tree-toggle--branch{cursor:pointer}
.dt-agg-row{font-size:12px;font-weight:500;color:var(--color-text-secondary,#6b6a66);background:var(--color-background-secondary,#f7f6f3)}
.dt-agg-td{padding:4px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea)}
`

// Injects the stylesheet into <head> at most once per page, regardless of how many tables are
// mounted or which entry point (createTableState/DataTableView directly, or a wrapper like
// @vates/data-table-vanilla's createDataTable) triggers the first one. Called from
// `DataTableView` itself (not left to each caller) so a consumer using the raw Solid components
// gets a styled table with no separate CSS import to remember, the same "just works" guarantee
// createDataTable already gave vanilla consumers.
let stylesInjected = false
export function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const s = document.createElement('style')
  s.dataset.dtStyles = ''
  s.textContent = STYLES
  document.head.insertBefore(s, document.head.firstChild)
}
