import { createSignal, onCleanup, Show } from 'solid-js'
import {
  compareInOrder,
  compareMissingLast,
  createTableState,
  DataTableView,
  datePartGroup,
  logRangeGroup,
  type ColumnDef,
} from '@vates/data-table-solid'
import { Shell } from '../common/Shell'
import { makeVms, tick, type Power, type Vm } from './data'
import source from './App.tsx?raw'

const POWER_ORDER: Power[] = ['Running', 'Paused', 'Halted']

function powerDot(power: Power) {
  return <span class={`power power--${power.toLowerCase()}`}>{power}</span>
}

// Limit: B49 — a column `width` is only a hint, so cells keep themselves on one line
function oneLine(text: string) {
  return <span class="nowrap">{text}</span>
}

function cpuBar(cpu: number | null) {
  if (cpu == null) return <span class="muted">—</span>
  const level = cpu >= 90 ? 'hot' : cpu >= 70 ? 'warm' : 'ok'
  return (
    <span class={`cpu cpu--${level}`}>
      <span class="cpu-bar" style={{ width: `${cpu}%` }} />
      <span class="cpu-value">{cpu}%</span>
    </span>
  )
}

const COLUMNS: ColumnDef<Vm>[] = [
  { key: 'name', label: 'Name', pinned: true, render: (_, vm) => oneLine(vm.name) },
  {
    key: 'power',
    label: 'Power',
    groupable: true,
    compare: compareInOrder(POWER_ORDER),
    render: (_, vm) => powerDot(vm.power),
    renderFilterLabel: (v) => powerDot(v as Power),
  },
  {
    key: 'cpu',
    label: 'CPU',
    type: 'number',
    // Hottest first, machines with no sample last in both directions
    defaultSortDir: 'desc',
    compare: compareMissingLast(),
    render: (_, vm) => cpuBar(vm.cpu),
  },
  { key: 'pool', label: 'Pool', groupable: true, category: 'Placement' },
  { key: 'host', label: 'Host', groupable: true, category: 'Placement' },
  {
    key: 'os',
    label: 'OS',
    groupable: true,
    category: 'Placement',
    render: (_, vm) => oneLine(vm.os),
  },
  { key: 'vcpus', label: 'vCPU', type: 'number', aggregate: 'sum', category: 'Resources' },
  {
    key: 'ramGiB',
    label: 'RAM',
    type: 'number',
    aggregate: 'sum',
    category: 'Resources',
    format: (v) => `${Number(v).toLocaleString('en')} GiB`,
  },
  {
    key: 'diskGiB',
    label: 'Disk',
    type: 'number',
    aggregate: 'sum',
    category: 'Resources',
    groupable: true,
    format: (v) => `${Number(v).toLocaleString('en')} GiB`,
    ...logRangeGroup({ divisions: [1, 3] }, ' GiB'),
  },
  {
    key: 'tags',
    label: 'Tags',
    multiMode: 'and',
    groupable: true,
    render: (_, vm) => (
      <span class="tags">
        {vm.tags.map((t) => (
          <span class="tag">{t}</span>
        ))}
      </span>
    ),
  },
  {
    key: 'lastBoot',
    label: 'Last boot',
    type: 'date',
    defaultSortDir: 'desc',
    groupable: true,
    ...datePartGroup('month'),
  },
]

export function App() {
  const [vms, setVms] = createSignal(makeVms())
  const table = createTableState(vms, COLUMNS, {
    // New row objects arrive every tick: match the selection by id, not by object
    getRowId: (vm) => vm.id,
    defaultGroupsCollapsed: false,
    initialViewState: { groupBy: ['pool'], pageSize: 50 },
  })

  // Live metrics: a fresh sample every 2 s, as a monitoring backend would push them. Held while
  // machines are selected, so a re-sorted list doesn't move rows under the user's next click.
  const [live, setLive] = createSignal(true)
  const selecting = () => table.selection.rows().length > 0
  const timer = setInterval(() => live() && !selecting() && setVms(tick), 2000)
  onCleanup(() => clearInterval(timer))

  const setPower = (power: Power) => {
    const ids = new Set(table.selection.rows().map((vm) => vm.id))
    const verb = power === 'Running' ? 'Start' : 'Stop'
    if (ids.size > 10 && !confirm(`${verb} ${ids.size} machines?`)) return
    setVms((prev) =>
      prev.map((vm) =>
        ids.has(vm.id) ? { ...vm, power, cpu: power === 'Running' ? (vm.cpu ?? 5) : null } : vm,
      ),
    )
  }

  return (
    <Shell
      title="Fleet console"
      context="1,500 virtual machines across four pools, CPU sampled live. Grouped by pool with resource totals; sort by CPU for the hottest machines, select some to start or stop them in bulk (live updates hold while you select)."
      source={source}
    >
      <DataTableView
        table={table}
        selectable
        rowClass={(vm) => (vm.power === 'Halted' ? 'vm-halted' : undefined)}
        toolbarEnd={
          <div class="actions">
            <Show when={table.selection.rows().length > 0}>
              <span class="selected">{table.selection.rows().length} selected</span>
              <button onClick={() => setPower('Running')}>▶ Start</button>
              <button onClick={() => setPower('Halted')}>■ Stop</button>
              <button onClick={() => table.selection.clear()}>Clear</button>
            </Show>
            <button aria-pressed={live()} onClick={() => setLive(!live())}>
              {live() ? '❚❚ Pause live' : '▶ Resume live'}
            </button>
            <Show when={live() && selecting()}>
              <span class="muted">held while selecting</span>
            </Show>
          </div>
        }
      />
    </Shell>
  )
}
