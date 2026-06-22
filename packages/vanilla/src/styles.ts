export const STYLES = `
:root{--color-background-primary:#fff;--color-background-secondary:#f7f6f3;--color-background-info:#e6f1fb;--color-background-warning:#faeeda;--color-text-primary:#1a1916;--color-text-secondary:#6b6a66;--color-text-tertiary:#9b9a96;--color-text-info:#185fa5;--color-text-warning:#854f0b;--color-border-secondary:#dddcd8;--color-border-tertiary:#eeedea;--color-border-info:#b8d6f5;--color-border-warning:#f0d4a8}
@media(prefers-color-scheme:dark){:root{--color-background-primary:#141413;--color-background-secondary:#1e1d1b;--color-background-info:#0d2640;--color-background-warning:#2a1900;--color-text-primary:#e8e7e4;--color-text-secondary:#9b9a96;--color-text-tertiary:#6b6a66;--color-text-info:#5b9fe0;--color-text-warning:#e8a040;--color-border-secondary:#333230;--color-border-tertiary:#252422;--color-border-info:#1a4070;--color-border-warning:#4a2c00}}
[data-theme=dark]{--color-background-primary:#141413;--color-background-secondary:#1e1d1b;--color-background-info:#0d2640;--color-background-warning:#2a1900;--color-text-primary:#e8e7e4;--color-text-secondary:#9b9a96;--color-text-tertiary:#6b6a66;--color-text-info:#5b9fe0;--color-text-warning:#e8a040;--color-border-secondary:#333230;--color-border-tertiary:#252422;--color-border-info:#1a4070;--color-border-warning:#4a2c00}
[data-theme=light]{--color-background-primary:#fff;--color-background-secondary:#f7f6f3;--color-background-info:#e6f1fb;--color-background-warning:#faeeda;--color-text-primary:#1a1916;--color-text-secondary:#6b6a66;--color-text-tertiary:#9b9a96;--color-text-info:#185fa5;--color-text-warning:#854f0b;--color-border-secondary:#dddcd8;--color-border-tertiary:#eeedea;--color-border-info:#b8d6f5;--color-border-warning:#f0d4a8}
.ft{font-family:inherit;font-size:14px;color:var(--color-text-primary,#1a1916)}
.ft-toolbar{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);flex-wrap:wrap}
.ft-stats{margin-left:auto;font-size:12px;color:var(--color-text-secondary,#6b6a66)}
.ft-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;font-size:13px;cursor:pointer;color:var(--color-text-primary,#1a1916);font-family:inherit;line-height:1}
.ft-btn--active{background:var(--color-background-secondary,#f7f6f3)}
.ft-dd-wrap{position:relative}
.ft-dd{position:absolute;top:calc(100% + 4px);left:0;z-index:100;background:var(--color-background-primary,#fff);border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:180px}
.ft-dd-section{padding:6px 14px 2px;font-size:11px;color:var(--color-text-tertiary,#9b9a96);font-weight:500;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.ft-dd-sublabel{font-size:12px;margin-bottom:4px;color:var(--color-text-secondary,#6b6a66)}
.ft-dd-item{display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:13px;color:var(--color-text-primary,#1a1916);cursor:default}
.ft-dd-item--click{cursor:pointer}
.ft-dd-item--click:hover{background:var(--color-background-secondary,#f7f6f3)}
.ft-dd-footer{padding:4px 14px 6px}
.ft-clear-btn{font-size:12px;background:none;border:none;color:var(--color-text-secondary,#6b6a66);cursor:pointer;padding:0;font-family:inherit}
.ft-sort-idx{width:18px;font-size:11px;color:var(--color-text-tertiary,#9b9a96);font-weight:500;flex-shrink:0}
.ft-sort-icon{font-size:15px;color:var(--color-border-secondary,#dddcd8)}
.ft-sort-icon--active{color:var(--color-text-primary,#1a1916)}
.ft-range-input{width:80px;padding:3px 6px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;font-family:inherit;background:transparent;color:inherit}
.ft-range-sep{color:var(--color-text-tertiary,#9b9a96);font-size:12px}
.ft-chips{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 0}
.ft-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--color-background-secondary,#f7f6f3);border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:12px;font-size:12px;color:var(--color-text-secondary,#6b6a66)}
.ft-chip--filter{background:var(--color-background-info,#e6f1fb);color:var(--color-text-info,#185fa5);border-color:var(--color-border-info,#b8d6f5)}
.ft-chip--group{background:var(--color-background-warning,#faeeda);color:var(--color-text-warning,#854f0b);border-color:var(--color-border-warning,#f0d4a8)}
.ft-chip-x{cursor:pointer;margin-left:2px}
.ft-table-wrap{overflow-x:auto;border:0.5px solid var(--color-border-tertiary,#eeedea);border-radius:8px;margin-top:12px}
.ft-table{width:100%;border-collapse:collapse;font-size:13px}
.ft-th{padding:8px 12px;text-align:left;font-weight:500;font-size:12px;background:var(--color-background-secondary,#f7f6f3);color:var(--color-text-secondary,#6b6a66);border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);white-space:nowrap;user-select:none;cursor:pointer}
.ft-th--no-sort{cursor:default}
.ft-th-inner{display:inline-flex;align-items:center;gap:4px}
.ft-td{padding:8px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea);color:var(--color-text-primary,#1a1916);vertical-align:middle}
.ft-tr--odd .ft-td{background:var(--color-background-secondary,#f7f6f3)}
.ft-tr--selected .ft-td{background:var(--color-background-info,#e6f1fb)}
.ft-group-row{background:var(--color-background-secondary,#f7f6f3);font-weight:500;font-size:12px;color:var(--color-text-secondary,#6b6a66);cursor:pointer}
.ft-group-td{padding:6px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea)}
.ft-group-sep{margin:0 4px;opacity:.4}
.ft-group-colname{margin-right:4px;opacity:.6}
.ft-group-count{margin-left:10px;font-weight:400;opacity:.6}
.ft-pagination{display:flex;align-items:center;gap:6px;padding:10px 2px;justify-content:flex-end;flex-wrap:wrap}
.ft-page-btn{padding:4px 9px;background:none;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;cursor:pointer;font-size:13px;color:var(--color-text-primary,#1a1916);font-family:inherit;line-height:1}
.ft-page-btn:disabled{opacity:.35;cursor:default}
.ft-page-info{font-size:12px;color:var(--color-text-secondary,#6b6a66);padding:0 6px}
.ft-page-select{padding:4px 6px;font-size:12px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:4px;background:transparent;color:inherit;font-family:inherit;cursor:pointer}
.ft-rows-per-page{font-size:12px;color:var(--color-text-secondary,#6b6a66);margin-left:10px}
.ft-search-input{padding:4px 8px;font-size:13px;border:0.5px solid var(--color-border-secondary,#dddcd8);border-radius:6px;background:transparent;color:inherit;font-family:inherit;min-width:160px}
.ft-agg-row{font-size:12px;font-weight:500;color:var(--color-text-secondary,#6b6a66);background:var(--color-background-secondary,#f7f6f3)}
.ft-agg-td{padding:4px 12px;border-bottom:0.5px solid var(--color-border-tertiary,#eeedea)}
`
