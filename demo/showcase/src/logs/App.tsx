import { createMemo, createSignal, For, onCleanup } from 'solid-js'
import {
  createTableState,
  DataTableView,
  datePartGroup,
  logRangeGroup,
  useUrlView,
  type ColumnDef,
  type TableViewState,
} from '@vates/data-table-solid'
import { Shell } from '../common/Shell'
import { LEVELS, makeEvents, type Level, type LogEvent } from './data'
import source from './App.tsx?raw'

function levelBadge(level: string) {
  return (<span class={`lvl lvl--${level}`}>{level}</span>) as HTMLElement
}

const COLUMNS: ColumnDef<LogEvent>[] = [
  {
    key: 'timestamp',
    label: 'Time',
    type: 'date',
    width: 190,
    defaultSortDir: 'desc',
    groupable: true,
    format: (v) => String(v).replace('T', ' '),
    // Limit: B31 — DatePart stops at 'day', an incident wants per-hour (or minute) buckets
    ...datePartGroup('day'),
  },
  {
    key: 'level',
    label: 'Level',
    width: 80,
    groupable: true,
    compare: (a, b) => LEVELS.indexOf(a as Level) - LEVELS.indexOf(b as Level),
    render: (v) => levelBadge(v as string),
    renderFilterLabel: levelBadge,
  },
  { key: 'service', label: 'Service', groupable: true },
  {
    key: 'host',
    label: 'Host',
    groupable: true,
    // 320 hosts: busiest first in the (virtualized) checklist
    // Limit: B32 — checklist counts print raw ("10010"), no label or format hook for them
    defaultValueSort: { by: 'count', dir: 'desc' },
  },
  {
    key: 'status',
    label: 'Status',
    type: 'number',
    width: 70,
    groupable: true,
    format: String,
    rangePresets: [
      { label: '2xx', min: 200, max: 299 },
      { label: '4xx', min: 400, max: 499 },
      { label: '5xx', min: 500, max: 599 },
    ],
  },
  {
    key: 'durationMs',
    label: 'Duration',
    type: 'number',
    width: 90,
    groupable: true,
    format: (v) => `${Number(v).toLocaleString('en')} ms`,
    ...logRangeGroup({ divisions: [1, 3] }, ' ms'),
  },
  {
    key: 'message',
    label: 'Message',
    // 100k distinct strings: a checklist would be useless, search covers it
    filterable: false,
    render: (v) =>
      (
        <span class="msg" title={v as string}>
          {v as string}
        </span>
      ) as HTMLElement,
  },
]

const ERRORS_ONLY: TableViewState = { excludeFilters: { level: ['debug', 'info', 'warn'] } }

// Limit: B30 — `encodeViewState` isn't public, so these can't be plain `<a href="?view=…">`
// links (open in a new tab, copy before applying); they apply the view in place instead
// Limit: B42 — no public way to compare two views: JSON with sorted keys, so field order can't matter
const viewKey = (view: TableViewState) =>
  JSON.stringify(view, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

const SAVED_SEARCHES: { label: string; view: TableViewState }[] = [
  { label: 'Errors only', view: ERRORS_ONLY },
  { label: 'Slow (≥ 1 s)', view: { rangeFilters: { durationMs: { min: '1000', max: '' } } } },
  {
    label: '5xx by service',
    view: { rangeFilters: { status: { min: '500', max: '599' } }, groupBy: ['service'] },
  },
  { label: 'Checkout errors', view: { searchQuery: 'checkout', ...ERRORS_ONLY } },
]

export function App() {
  const events = makeEvents()
  const table = createTableState(events, COLUMNS, {
    getRowId: (e) => e.id,
    initialViewState: { sorts: [{ key: 'timestamp', dir: 'desc' }], pageSize: 100 },
    // The default prints raw counts ("100000 / 100000 rows"): group the digits at this scale
    labels: {
      rowCount: (f, t) => `${f.toLocaleString('en')} of ${t.toLocaleString('en')} events`,
    },
  })
  // The whole view lives in `?view=…`: a copied URL reopens the same search
  useUrlView(table)

  const currentView = createMemo(() => viewKey(table.getViewState()))

  const levelCounts = createMemo(() => {
    const counts: Record<Level, number> = { debug: 0, info: 0, warn: 0, error: 0 }
    for (const e of table.processedData()) counts[e.level]++
    return counts
  })

  const [copied, setCopied] = createSignal(false)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(copiedTimer))
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard denied (insecure context, no permission): the address bar still has the link
    }
  }

  return (
    <Shell
      title="Event log"
      context="100,000 events from ten services over the last week, newest first. Search and filter at scale; the whole view is kept in the URL, so a link reopens the same search."
      source={source}
    >
      <div class="bar">
        <div class="counts" aria-label="Events by level in the current view">
          <For each={[...LEVELS].reverse()}>
            {(level) => (
              <span class={`count count--${level}`}>
                {levelBadge(level)}
                {levelCounts()[level].toLocaleString('en')}
              </span>
            )}
          </For>
        </div>
        <nav class="saved" aria-label="Saved searches">
          <For each={SAVED_SEARCHES}>
            {(s) => (
              <button
                aria-pressed={viewKey(s.view) === currentView()}
                onClick={() => table.setViewState(s.view)}
              >
                {s.label}
              </button>
            )}
          </For>
        </nav>
      </div>
      <DataTableView
        table={table}
        rowClass={(e) => (e.level === 'error' ? 'log-error' : undefined)}
        toolbarEnd={
          <button class="copy" onClick={copyLink}>
            {copied() ? 'Copied ✓' : 'Copy link'}
          </button>
        }
      />
    </Shell>
  )
}
