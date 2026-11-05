import {
  createTableState,
  DataTableView,
  numericRangeGroup,
  type ColumnDef,
} from '@vates/data-table-solid'
import { Shell } from '../common/Shell'
import { makePlayers, TEAM_BY_NAME, type Player, type Position } from './data'
import source from './App.tsx?raw'

const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW']
const FORM_POINTS: Record<string, number> = { W: 3, D: 1, L: 0 }
const formPoints = (form: string) => [...form].reduce((sum, r) => sum + FORM_POINTS[r], 0)
const points = (p: Player) => p.goals + p.assists
const PAGE_SIZE = 25

function crest(team: string) {
  const t = TEAM_BY_NAME.get(team)
  return (
    <span class="team">
      <span class="crest" style={{ background: t?.color }}>
        {t?.code}
      </span>
      {team}
    </span>
  )
}

const posPill = (pos: Position) => <span class={`pos pos--${pos.toLowerCase()}`}>{pos}</span>

const card = (kind: 'yellow' | 'red', n: number) =>
  n ? <span class={`card card--${kind}`}>{n}</span> : <span class="zero">0</span>

// Every stat ranks best-first on its first header click
const stat = (key: string, label: string): ColumnDef<Player> => ({
  key,
  label,
  type: 'number',
  defaultSortDir: 'desc',
  aggregate: 'sum',
})

const COLUMNS: ColumnDef<Player>[] = [
  {
    key: 'name',
    label: 'Player',
    pinned: true,
    width: 170,
    // Limit: B35 — the result goes through the column's render/format with the group's
    // first row, and has no formatter of its own, so the label is baked into the returned string
    aggregate: (rows) => {
      const top = rows.reduce((a, b) => (b.goals > a.goals ? b : a))
      return `★ ${top.name} (${top.goals})`
    },
  },
  {
    key: 'team',
    label: 'Team',
    width: 200,
    groupable: true,
    render: (v) => crest(v as string),
    renderFilterLabel: (v) => crest(v as string),
  },
  {
    key: 'position',
    label: 'Pos',
    groupable: true,
    compare: (a, b) => POSITIONS.indexOf(a as Position) - POSITIONS.indexOf(b as Position),
    render: (v) => posPill(v as Position),
    renderFilterLabel: (v) => posPill(v as Position),
  },
  // Limit: B36 — abbreviated stat headers (GP, G, A…) can't carry a title/description
  { key: 'age', label: 'Age', type: 'number', groupable: true, ...numericRangeGroup(5) },
  stat('games', 'GP'),
  {
    ...stat('minutes', 'Min'),
    groupable: true,
    keepVisibleWhenGrouped: true,
    format: (v) => Number(v).toLocaleString('en'),
    ...numericRangeGroup(500, ' min'),
  },
  stat('goals', 'G'),
  stat('assists', 'A'),
  { ...stat('points', 'Pts'), value: points },
  {
    ...stat('per90', 'G/90'),
    value: (p) => (p.minutes ? (p.goals / p.minutes) * 90 : 0),
    format: (v) => Number(v).toFixed(2),
    // Squad rate from totals: averaging per-player rates would let a 10-minute cameo weigh as much as a regular
    aggregate: (rows) => {
      const minutes = rows.reduce((sum, p) => sum + p.minutes, 0)
      return minutes ? (rows.reduce((sum, p) => sum + p.goals, 0) / minutes) * 90 : 0
    },
  },
  stat('shots', 'Sh'),
  {
    ...stat('passPct', 'Pass %'),
    aggregate: 'avg',
    format: (v) => `${Math.round(Number(v))}%`,
  },
  { ...stat('yellow', 'YC'), render: (v) => card('yellow', v as number) },
  { ...stat('red', 'RC'), render: (v) => card('red', v as number) },
  {
    key: 'form',
    label: 'Form',
    filterable: false,
    searchable: false,
    defaultSortDir: 'desc',
    compare: (a, b) => formPoints(a as string) - formPoints(b as string),
    // A squad shares its club's form; the aggregate row renders it through `render` too
    aggregate: (rows) => rows[0].form,
    render: (v) => (
      <span class="form" aria-label={`Last five: ${v as string}`}>
        {[...(v as string)].map((r) => (
          <span class={`form-dot form-dot--${r.toLowerCase()}`}>{r}</span>
        ))}
      </span>
    ),
  },
]

export function App() {
  const players = makePlayers()
  // League's top three by points get a podium marker whatever the current sort
  const podium = new Set([...players].sort((a, b) => points(b) - points(a)).slice(0, 3))
  const table = createTableState(players, COLUMNS, {
    getRowId: (p) => p.id,
    initialViewState: {
      sorts: [
        { key: 'points', dir: 'desc' },
        { key: 'goals', dir: 'desc' },
      ],
      pageSize: PAGE_SIZE,
    },
  })
  const grouping = () => table.group.by()
  const byTeam = () => grouping().length === 1 && grouping()[0] === 'team'

  return (
    <Shell
      title="Season stats"
      context="500 players from a 20-club league, ranked by goals plus assists. Switch to clubs for squad totals, average output per 90 minutes and each club's top scorer."
      source={source}
    >
      <DataTableView
        table={table}
        rowClass={(p) => (podium.has(p) ? 'podium' : undefined)}
        toolbarEnd={
          <div class="switch" role="group" aria-label="View">
            <button
              aria-pressed={grouping().length === 0}
              onClick={() => {
                table.group.clear()
                // Ungrouping keeps the club sort grouping added (by design): drop it to get the ranking back
                table.sort.remove('team')
                table.pagination.setPageSize(PAGE_SIZE)
              }}
            >
              Players
            </button>
            {/* Limit: B37 — clubs list by name; ordering groups by an aggregate (points) has no API */}
            <button
              aria-pressed={byTeam()}
              onClick={() => {
                if (byTeam()) return
                table.group.clear()
                table.group.toggle('team')
                // Limit: B34 — a group split across pages totals only that page's rows: show clubs whole
                table.pagination.setPageSize(0)
              }}
            >
              Clubs
            </button>
          </div>
        }
      />
    </Shell>
  )
}
