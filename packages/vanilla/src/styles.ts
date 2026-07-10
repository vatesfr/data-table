export const STYLES = `
:root{--color-background-primary:#fff;--color-background-secondary:#f7f6f3;--color-background-info:#e6f1fb;--color-background-warning:#faeeda;--color-text-primary:#1a1916;--color-text-secondary:#6b6a66;--color-text-tertiary:#9b9a96;--color-text-info:#185fa5;--color-text-warning:#854f0b;--color-border-secondary:#dddcd8;--color-border-tertiary:#eeedea;--color-border-info:#b8d6f5;--color-border-warning:#f0d4a8}
@media(prefers-color-scheme:dark){:root{--color-background-primary:#141413;--color-background-secondary:#1e1d1b;--color-background-info:#0d2640;--color-background-warning:#2a1900;--color-text-primary:#e8e7e4;--color-text-secondary:#9b9a96;--color-text-tertiary:#6b6a66;--color-text-info:#5b9fe0;--color-text-warning:#e8a040;--color-border-secondary:#333230;--color-border-tertiary:#252422;--color-border-info:#1a4070;--color-border-warning:#4a2c00}}
[data-theme=dark]{--color-background-primary:#141413;--color-background-secondary:#1e1d1b;--color-background-info:#0d2640;--color-background-warning:#2a1900;--color-text-primary:#e8e7e4;--color-text-secondary:#9b9a96;--color-text-tertiary:#6b6a66;--color-text-info:#5b9fe0;--color-text-warning:#e8a040;--color-border-secondary:#333230;--color-border-tertiary:#252422;--color-border-info:#1a4070;--color-border-warning:#4a2c00}
[data-theme=light]{--color-background-primary:#fff;--color-background-secondary:#f7f6f3;--color-background-info:#e6f1fb;--color-background-warning:#faeeda;--color-text-primary:#1a1916;--color-text-secondary:#6b6a66;--color-text-tertiary:#9b9a96;--color-text-info:#185fa5;--color-text-warning:#854f0b;--color-border-secondary:#dddcd8;--color-border-tertiary:#eeedea;--color-border-info:#b8d6f5;--color-border-warning:#f0d4a8}
.dt{font-family:inherit;font-size:14px;color:var(--color-text-primary,#1a1916)}
.dt-toolbar{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);flex-wrap:wrap}
.dt-stats{margin-left:auto;font-size:12px;color:var(--color-text-secondary,#6b6a66)}
.dt-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;font-size:13px;cursor:pointer;color:var(--color-text-primary,#1a1916);font-family:inherit;line-height:1}
.dt-btn--active{background:var(--color-background-secondary,#f7f6f3)}
.dt-dd-wrap{position:relative}
.dt-dd{position:absolute;top:calc(100% + 4px);left:0;z-index:100;background:var(--color-background-primary,#fff);border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:180px}
.dt-dd-section{padding:6px 14px 2px;font-size:11px;color:var(--color-text-tertiary,#9b9a96);font-weight:500;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.dt-dd-sublabel{font-size:12px;margin-bottom:4px;color:var(--color-text-secondary,#6b6a66)}
.dt-dd-item{display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:13px;color:var(--color-text-primary,#1a1916);cursor:default}
.dt-dd-item--click{cursor:pointer}
.dt-dd-item--click:hover{background:var(--color-background-secondary,#f7f6f3)}
.dt-dd-item--col{justify-content:space-between}
.dt-flex1{flex:1}
.dt-reorder-btns{display:flex;gap:2px}
.dt-reorder-btn{background:none;border:none;cursor:pointer;padding:2px 4px;font-size:10px;color:var(--color-text-secondary,#6b6a66);line-height:1;font-family:inherit}
.dt-reorder-btn:disabled{opacity:.3;cursor:default}
.dt-dd-footer{padding:4px 14px 6px}
.dt-clear-btn{font-size:12px;background:none;border:none;color:var(--color-text-secondary,#6b6a66);cursor:pointer;padding:0;font-family:inherit}
.dt-sort-idx{width:18px;font-size:11px;color:var(--color-text-tertiary,#9b9a96);font-weight:500;flex-shrink:0}
.dt-sort-icon{font-size:15px;color:var(--color-border-secondary,#dddcd8)}
.dt-sort-icon--active{color:var(--color-text-primary,#1a1916)}
.dt-range-input{width:80px;padding:3px 6px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;font-family:inherit;background:transparent;color:inherit}
.dt-range-sep{color:var(--color-text-tertiary,#9b9a96);font-size:12px}
.dt-chips{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 0}
.dt-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--color-background-secondary,#f7f6f3);border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:12px;font-size:12px;color:var(--color-text-secondary,#6b6a66)}
.dt-chip--filter{background:var(--color-background-info,#e6f1fb);color:var(--color-text-info,#185fa5);border-color:var(--color-border-info,#b8d6f5)}
.dt-chip--group{background:var(--color-background-warning,#faeeda);color:var(--color-text-warning,#854f0b);border-color:var(--color-border-warning,#f0d4a8)}
.dt-chip-x{cursor:pointer;margin-left:2px}
.dt-table-wrap{overflow-x:auto;border:0.5px solid var(--color-border-tertiary,#eeedea);border-radius:8px;margin-top:12px}
.dt-table{width:100%;border-collapse:collapse;font-size:13px}
.dt-th{padding:8px 12px;text-align:left;font-weight:500;font-size:12px;background:var(--color-background-secondary,#f7f6f3);color:var(--color-text-secondary,#6b6a66);border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);white-space:nowrap;user-select:none;cursor:pointer}
.dt-th--no-sort{cursor:default}
.dt-th--dragging{opacity:.4}
.dt-th--drag-over{box-shadow:inset 2px 0 0 var(--color-text-primary,#1a1916)}
.dt-th-inner{display:inline-flex;align-items:center;gap:4px}
.dt-td{padding:8px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);color:var(--color-text-primary,#1a1916);vertical-align:middle}
.dt-tr--odd .dt-td{background:var(--color-background-secondary,#f7f6f3)}
.dt-tr--clickable{cursor:pointer}
.dt-tr--clickable:hover .dt-td{background:var(--color-background-secondary,#f7f6f3)}
.dt-tr--selected .dt-td{background:var(--color-background-info,#e6f1fb)}
.dt-group-row{background:var(--color-background-secondary,#f7f6f3);font-weight:500;font-size:12px;color:var(--color-text-secondary,#6b6a66);cursor:pointer}
.dt-group-td{padding:6px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea)}
.dt-group-sep{margin:0 4px;opacity:.4}
.dt-group-colname{margin-right:4px;opacity:.6}
.dt-group-count{margin-left:10px;font-weight:400;opacity:.6}
.dt-pagination{display:flex;align-items:center;gap:6px;padding:10px 2px;justify-content:flex-end;flex-wrap:wrap}
.dt-page-btn{padding:4px 9px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;cursor:pointer;font-size:13px;color:var(--color-text-primary,#1a1916);font-family:inherit;line-height:1}
.dt-page-btn:disabled{opacity:.35;cursor:default}
.dt-page-info{font-size:12px;color:var(--color-text-secondary,#6b6a66);padding:0 6px}
.dt-page-select{padding:4px 6px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;background:transparent;color:inherit;font-family:inherit;cursor:pointer}
.dt-rows-per-page{font-size:12px;color:var(--color-text-secondary,#6b6a66);margin-left:10px}
.dt-search-input{padding:4px 8px;font-size:13px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;background:transparent;color:inherit;font-family:inherit;min-width:160px}
.dt-filter-panel{display:flex;min-width:460px;max-height:380px}
.dt-filter-cols{width:150px;flex-shrink:0;overflow-y:auto;border-right:0.5px solid var(--color-border-tertiary,#eeedea);padding:4px 0}
.dt-filter-col-item{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 10px;font-size:13px;cursor:pointer;color:var(--color-text-primary,#1a1916)}
.dt-filter-col-item:hover{background:var(--color-background-secondary,#f7f6f3)}
.dt-filter-col-item--active{background:var(--color-background-secondary,#f7f6f3);font-weight:500}
.dt-filter-col-dot{width:6px;height:6px;border-radius:50%;background:var(--color-text-info,#185fa5);flex-shrink:0}
.dt-filter-detail{flex:1;overflow-y:auto;padding:6px 0;min-width:220px}
.dt-filter-search-row{display:flex;align-items:center;gap:6px;margin:2px 12px 6px}
.dt-dd-search{flex:1;padding:5px 8px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;background:transparent;color:inherit;font-family:inherit;box-sizing:border-box}
.dt-filter-select-all{flex-shrink:0;margin:0}
.dt-agg-row{font-size:12px;font-weight:500;color:var(--color-text-secondary,#6b6a66);background:var(--color-background-secondary,#f7f6f3)}
.dt-agg-td{padding:4px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea)}
`
