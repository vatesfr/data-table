import { createSignal, createEffect, onMount, onCleanup, on, Show, For, type JSX } from 'solid-js'
import {
  DataTableView,
  createTableState,
  bucketNumericRange,
  formatNumericRange,
  bucketDatePart,
  formatDatePart,
  compareMissingLast,
  usePersistedView,
  useUrlView,
  resetView,
  usePersistence,
  LABELS_EN,
  LABELS_FR,
  LABELS_DE,
  LABELS_ES,
  LABELS_PT,
  type ColumnDef,
  type DataTableLabels,
} from '@vates/data-table-solid'
import { badge } from './components/Badge'
import { scoreBar } from './components/ScoreBar'
import { HUGE_DATA, HUGE_COLUMNS, HUGE_ROW_COUNT } from './hugeData'

interface Employee {
  id: number
  name: string
  department: string
  role: string
  salary: number
  joined: string
  status: string
  score: number | null // null: no performance review yet — compareMissingLast() keeps these last regardless of sort direction
  skills: string[]
}

const SAMPLE_DATA: Employee[] = [
  {
    id: 1,
    name: 'Alice Martin',
    department: 'Engineering',
    role: 'Senior Dev',
    salary: 92000,
    joined: '2019-03-15',
    status: 'Active',
    score: 94,
    skills: ['TypeScript', 'React'],
  },
  {
    id: 2,
    name: 'Bob Chen',
    department: 'Product',
    role: 'PM',
    salary: 85000,
    joined: '2020-07-01',
    status: 'Active',
    score: 87,
    skills: ['Roadmapping', 'Analytics'],
  },
  {
    id: 3,
    name: 'Clara Dubois',
    department: 'Engineering',
    role: 'Lead Dev',
    salary: 105000,
    joined: '2017-11-20',
    status: 'Active',
    score: 98,
    skills: ['TypeScript', 'Architecture'],
  },
  {
    id: 4,
    name: 'David Kim',
    department: 'Design',
    role: 'UX Designer',
    salary: 78000,
    joined: '2021-01-10',
    status: 'Active',
    score: 82,
    skills: ['Figma', 'Prototyping'],
  },
  {
    id: 5,
    name: 'Eva Müller',
    department: 'Engineering',
    role: 'Junior Dev',
    salary: 62000,
    joined: '2023-04-05',
    status: 'Active',
    score: null, // just joined, no review yet
    skills: ['JavaScript', 'React'],
  },
  {
    id: 6,
    name: 'Frank Rossi',
    department: 'Sales',
    role: 'Account Exec',
    salary: 71000,
    joined: '2020-09-12',
    status: 'Inactive',
    score: 65,
    skills: ['Negotiation', 'CRM'],
  },
  {
    id: 7,
    name: 'Grace Liu',
    department: 'Product',
    role: 'Designer',
    salary: 74000,
    joined: '2021-06-28',
    status: 'Active',
    score: 89,
    skills: ['Figma', 'UX Research'],
  },
  {
    id: 8,
    name: 'Hiro Tanaka',
    department: 'Engineering',
    role: 'DevOps',
    salary: 88000,
    joined: '2018-02-14',
    status: 'Active',
    score: 91,
    skills: ['Kubernetes', 'CI/CD'],
  },
  {
    id: 9,
    name: 'Isabelle Roy',
    department: 'HR',
    role: 'HR Manager',
    salary: 67000,
    joined: '2019-08-22',
    status: 'Active',
    score: 79,
    skills: ['Recruiting', 'Onboarding'],
  },
  {
    id: 10,
    name: "James O'Brien",
    department: 'Sales',
    role: 'Sales Lead',
    salary: 82000,
    joined: '2018-05-03',
    status: 'Active',
    score: 84,
    skills: ['Negotiation', 'Leadership'],
  },
  {
    id: 11,
    name: 'Karin Svensson',
    department: 'Design',
    role: 'Lead Designer',
    salary: 86000,
    joined: '2019-12-01',
    status: 'Active',
    score: 92,
    skills: ['Figma', 'Leadership'],
  },
  {
    id: 12,
    name: 'Leo Petit',
    department: 'Engineering',
    role: 'Architect',
    salary: 118000,
    joined: '2016-06-17',
    status: 'Active',
    score: 97,
    skills: ['Architecture', 'TypeScript'],
  },
  {
    id: 13,
    name: 'Mia Nakamura',
    department: 'HR',
    role: 'Recruiter',
    salary: 58000,
    joined: '2022-03-08',
    status: 'Active',
    score: null, // no review yet
    skills: ['Recruiting', 'Sourcing'],
  },
  {
    id: 14,
    name: 'Noel Ferreira',
    department: 'Sales',
    role: 'Account Exec',
    salary: 68000,
    joined: '2021-10-15',
    status: 'Inactive',
    score: 61,
    skills: ['CRM', 'Negotiation'],
  },
  {
    id: 15,
    name: 'Olivia Smith',
    department: 'Product',
    role: 'CPO',
    salary: 145000,
    joined: '2015-01-20',
    status: 'Active',
    score: 99,
    skills: ['Strategy', 'Leadership'],
  },
  {
    id: 16,
    name: 'Paul Werner',
    department: 'Engineering',
    role: 'Senior Dev',
    salary: 96000,
    joined: '2018-09-30',
    status: 'Active',
    score: 88,
    skills: ['React', 'Node.js'],
  },
  {
    id: 17,
    name: 'Qi Zhang',
    department: 'Design',
    role: 'UX Researcher',
    salary: 76000,
    joined: '2020-11-11',
    status: 'Active',
    score: 85,
    skills: ['UX Research', 'Prototyping'],
  },
  {
    id: 18,
    name: 'Rosa García',
    department: 'HR',
    role: 'HR Director',
    salary: 95000,
    joined: '2016-04-25',
    status: 'Active',
    score: 93,
    skills: ['Leadership', 'Onboarding'],
  },
  {
    id: 19,
    name: 'Sam Patel',
    department: 'Engineering',
    role: 'CTO',
    salary: 180000,
    joined: '2014-08-01',
    status: 'Active',
    score: 100,
    skills: ['Architecture', 'Leadership'],
  },
  {
    id: 20,
    name: 'Tanya Volkov',
    department: 'Sales',
    role: 'VP Sales',
    salary: 135000,
    joined: '2015-07-14',
    status: 'Active',
    score: 96,
    skills: ['Leadership', 'Negotiation'],
  },
]

const DEPT_COLORS = {
  Engineering: { bg: '#EAF3DE', color: '#3B6D11' },
  Product: { bg: '#E6F1FB', color: '#185FA5' },
  Design: { bg: '#FBEAF0', color: '#993556' },
  Sales: { bg: '#FAEEDA', color: '#854F0B' },
  HR: { bg: '#EEEDFE', color: '#534AB7' },
}
const STATUS_COLORS = {
  Active: { bg: '#EAF3DE', color: '#3B6D11' },
  Inactive: { bg: '#FCEBEB', color: '#A32D2D' },
}

// 'tier' below is a computed column derived from 'score' (see "Computed columns") purely to
// showcase `compare` — Bronze/Silver/Gold/Platinum has no natural alphabetical order ('Gold' <
// 'Platinum' < 'Silver' alphabetically, nowhere close to the intended rank).
const TIER_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum']
function tierFor(score: number | null): string {
  if (score == null) return ''
  if (score >= 95) return 'Platinum'
  if (score >= 85) return 'Gold'
  if (score >= 75) return 'Silver'
  return 'Bronze'
}
const TIER_COLORS = {
  Platinum: { bg: '#EEEDFE', color: '#534AB7' },
  Gold: { bg: '#FAEEDA', color: '#854F0B' },
  Silver: { bg: '#E6F1FB', color: '#185FA5' },
  Bronze: { bg: '#FBEAF0', color: '#993556' },
}

// A muted "—" placeholder, built the same plain-DOM-node way as badge()/scoreBar() — used by both
// the score and tier columns below for a not-yet-reviewed employee.
function muted(text: string): Node {
  const span = document.createElement('span')
  span.textContent = text
  Object.assign(span.style, { fontSize: '12px', color: 'var(--color-text-tertiary)' })
  return span
}

const COLUMNS: ColumnDef<Employee>[] = [
  // sortable: false + filterable: false — no sort/filter UI; hidden by default via defaultVisibleColumns
  { key: 'id', label: 'ID', type: 'number', width: 60, sortable: false, filterable: false },
  { key: 'name', label: 'Name', type: 'string', width: 160 },
  // groupable + render: a real DOM node badge (this package's ColumnDef.render returns a Node, not
  // JSX — see components/Badge.ts). Unlike React, there's no renderFilterLabel equivalent here
  // (it's a React-only field on top of core's ColumnDefBase) — the filter checklist below shows
  // this column's raw string values even though its cells render a colored badge.
  {
    key: 'department',
    label: 'Department',
    type: 'string',
    width: 130,
    groupable: true,
    render: (v) => badge(String(v), DEPT_COLORS),
  },
  { key: 'role', label: 'Role', type: 'string', width: 140, groupable: true },
  // format: plain string — use this when no custom node is needed; the numeric range filter (2
  // inputs + a slider) is automatic for type: 'number'
  {
    key: 'salary',
    label: 'Salary',
    type: 'number',
    width: 110,
    format: (v) =>
      Number(v).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    aggregate: 'sum',
    // groupValue/groupFormat: a continuous column (near-unique per row) grouped by its exact
    // value would create one group per row — bucketing into $20k ranges makes it groupable
    // meaningfully. cell rendering/sort/filter above are untouched, still reading the real salary.
    groupable: true,
    groupValue: bucketNumericRange(20000),
    groupFormat: formatNumericRange(20000, ' USD'),
  },
  // type: 'date' gets a range filter (2 inputs + a slider) above a Year › Month › Day filter
  // tree, instead of a plain checklist — the range narrows the tree itself. Grouped by year (not
  // the exact join date, which would be one group per row) via the same groupValue/groupFormat
  // bucketing idea, applied to a timestamp instead of a number. defaultSortDir: 'desc' — a first
  // click on this header sorts most-recently-joined first, the more useful direction for a date
  // column like this one; the direction cycle still ends at "none" on the third click either way.
  {
    key: 'joined',
    label: 'Joined',
    type: 'date',
    width: 100,
    defaultSortDir: 'desc',
    groupable: true,
    groupValue: bucketDatePart('year'),
    groupFormat: formatDatePart('year'),
  },
  // computed column: value is a function, so there's no matching 'tenure' property on Employee —
  // sort/filter/group/aggregate all work off the function's return value just like a real column
  {
    key: 'tenure',
    label: 'Tenure (yrs)',
    type: 'number',
    width: 100,
    value: (row) => new Date().getFullYear() - new Date(row.joined).getFullYear(),
    aggregate: 'avg',
    format: (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }),
  },
  // render — badge consistent with the Department column above (no renderFilterLabel here either)
  {
    key: 'status',
    label: 'Status',
    type: 'string',
    width: 90,
    groupable: true,
    render: (v) => badge(String(v), STATUS_COLORS),
  },
  // render returns a DOM node — use render (not format) when the cell isn't plain text.
  // compareMissingLast() (issue #15) keeps a not-yet-reviewed employee's row last in the Score
  // sort regardless of direction — null naturally sorts first ascending / last descending
  // otherwise, flipping depending on the toggle rather than staying put.
  {
    key: 'score',
    label: 'Score',
    type: 'number',
    width: 80,
    compare: compareMissingLast(),
    render: (v) => (v == null ? muted('No review yet') : scoreBar(Number(v))),
  },
  // computed column (value) + compare (issue #15): bucket a continuous score into an ordered
  // enum and sort it by rank, not alphabetically — see TIER_ORDER above. compareMissingLast()
  // wraps that tier ranking so a not-yet-reviewed employee's empty tier ('') still sorts last
  // in both directions, same as the Score column above.
  {
    key: 'tier',
    label: 'Tier',
    value: (row) => tierFor(row.score),
    compare: compareMissingLast(
      (a, b) => TIER_ORDER.indexOf(String(a)) - TIER_ORDER.indexOf(String(b)),
    ),
    groupable: true,
    width: 90,
    render: (v) => (v ? badge(String(v), TIER_COLORS) : muted('—')),
  },
  // array-valued column: filter checklist lists individual skills, grouping fans a row into
  // one group per skill, and cells join the array with ', ' — all automatic, no flag needed.
  // The checklist is also where exclude filters live: click a value once to include it (only
  // rows with that skill), click again to exclude it (rows with that skill are dropped), click
  // a third time to clear it — try excluding "Leadership" to hide everyone who has it.
  // defaultValueSort: a skill checklist reads better "most common first" than alphabetically —
  // the sort-order toggle still cycles through all 4 states from here, this just picks where it
  // starts.
  {
    key: 'skills',
    label: 'Skills',
    width: 180,
    groupable: true,
    defaultValueSort: { by: 'count', dir: 'desc' },
  },
]

// 'id' is hidden by default; users can toggle it back from the Columns menu
const DEFAULT_VISIBLE = [
  'name',
  'department',
  'role',
  'salary',
  'joined',
  'tenure',
  'status',
  'score',
  'tier',
  'skills',
]

// Row selection/click only need a couple of columns to make their point — a narrower
// defaultVisibleColumns keeps each section visually distinct instead of repeating the same
// 10-column table. The persisted table keeps more, since reordering needs several columns to
// be meaningful.
const SELECTION_VISIBLE = ['name', 'department', 'salary']
const CLICK_VISIBLE = ['name', 'department', 'role']
const PERSISTED_VISIBLE = ['name', 'department', 'salary', 'status', 'score']

const SECTIONS = [
  { id: 'full-table', label: 'Full-featured table' },
  { id: 'row-selection', label: 'Row selection' },
  { id: 'row-click', label: 'Row click' },
  { id: 'custom-layout', label: 'Custom layout' },
  { id: 'persisted-table', label: 'Persisted table' },
  { id: 'huge-dataset', label: 'Huge dataset' },
]

// Height of the sticky nav (padding + link line-height + border) — used both as scroll-margin-top
// on each heading (so anchor/scrollspy navigation doesn't leave it hidden behind the nav) and as
// the scrollspy threshold line.
const NAV_OFFSET = 56
// A few px of slack for the scrollspy threshold: scroll-margin-top-driven anchor scrolls can
// land the heading a fraction of a pixel past NAV_OFFSET (subpixel rounding), which a strict
// `<= NAV_OFFSET` comparison would miss.
const SCROLLSPY_TOLERANCE = 4

const LOCALES: Record<string, DataTableLabels> = {
  EN: LABELS_EN,
  FR: LABELS_FR,
  DE: LABELS_DE,
  ES: LABELS_ES,
  PT: LABELS_PT,
}

// Every table on the page persists its own view (sort/filter/group/etc.) independently — each
// gets its own localStorage key and its own URL query param, so the six sections don't clobber
// each other and "Copy share link" round-trips the whole page's state in one URL. Reuses the
// exact same keys as the react/vue/vanilla demos (all served from the same GitHub Pages origin,
// just a different path) so switching between the framework demos doesn't fragment storage.
const VIEW_KEYS: Record<string, { storageKey: string; paramName: string }> = {
  full: { storageKey: 'dt-demo-full-table', paramName: 'full' },
  selection: { storageKey: 'dt-demo-row-selection', paramName: 'sel' },
  click: { storageKey: 'dt-demo-row-click', paramName: 'click' },
  custom: { storageKey: 'dt-demo-custom-layout', paramName: 'custom' },
  persisted: { storageKey: 'dt-demo-persisted-table', paramName: 'persisted' },
  huge: { storageKey: 'dt-demo-huge-dataset', paramName: 'huge' },
}

// Solid's style prop sets each entry via el.style.setProperty(key, value), which — unlike React's
// inline `style` object — only accepts real (kebab-case) CSS property names and string values, so
// every style object in this file is written that way rather than React's camelCase convention.
const VIEW_CONTROL_BTN_STYLE = {
  padding: '4px 10px',
  'border-radius': '6px',
  border: '1px solid var(--color-border-secondary)',
  cursor: 'pointer',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-secondary)',
  'font-size': '13px',
  'font-family': 'inherit',
} as const

// Shared by every section below: "Copy share link" copies the whole page URL (every section's
// state round-trips through its own query param, see VIEW_KEYS); "Reset" clears just this one
// table's own storageKey/paramName via resetView, back to its construction-time defaults.
function ViewControls(props: { onReset: () => void }) {
  const [copied, setCopied] = createSignal(false)
  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ display: 'flex', gap: '8px', 'margin-bottom': '12px' }}>
      <button onClick={copyShareLink} style={VIEW_CONTROL_BTN_STYLE}>
        {copied() ? 'Copied!' : 'Copy share link'}
      </button>
      <button onClick={props.onReset} style={VIEW_CONTROL_BTN_STYLE}>
        Reset
      </button>
    </div>
  )
}

// Cross-links between this demo and the package README. @vates/data-table-solid's own README is
// thinner than react's/vue's (it defers most shared behavior to the root README/CLAUDE.md rather
// than re-documenting it per feature) — so unlike react's demo, this only links to anchors that
// actually exist there, rather than one per concept shown below.
const README_URL = 'https://github.com/vatesfr/data-table/blob/main/packages/solid/README.md'

function DocLink(props: { anchor?: string; children: JSX.Element }) {
  return (
    <a
      href={props.anchor ? `${README_URL}#${props.anchor}` : README_URL}
      target="_blank"
      rel="noopener"
      style={{ color: 'var(--color-text-secondary)', 'text-decoration': 'underline' }}
    >
      {props.children}
    </a>
  )
}

function fmtSalary(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Headless section: createTableState owns the sort/filter logic; you own the render.
// usePersistedView/useUrlView are opt-in helpers — the sort below survives a reload
// (localStorage) and round-trips through "Copy share link" (URL query param).
function EmployeeCards() {
  const table = createTableState(SAMPLE_DATA, COLUMNS)
  usePersistedView(table, VIEW_KEYS.custom.storageKey)
  useUrlView(table, { paramName: VIEW_KEYS.custom.paramName })

  const sortCols = ['name', 'salary', 'score'] as const

  return (
    <>
      <div
        style={{ display: 'flex', gap: '8px', 'margin-bottom': '12px', 'align-items': 'center' }}
      >
        <For each={sortCols}>
          {(col) => (
            <button onClick={() => table.sort.toggle(col)} style={VIEW_CONTROL_BTN_STYLE}>
              {col.charAt(0).toUpperCase() + col.slice(1)} {table.sort.icon(col)}
            </button>
          )}
        </For>
        <div style={{ 'margin-left': 'auto' }}>
          <ViewControls onReset={() => resetView(table, VIEW_KEYS.custom)} />
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '10px',
        }}
      >
        <For each={table.processedData()}>
          {(row) => (
            <div
              style={{
                border: '1px solid var(--color-border-tertiary)',
                'border-radius': '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ 'font-weight': '600', 'margin-bottom': '2px' }}>{row.name}</div>
              <div
                style={{
                  'font-size': '13px',
                  color: 'var(--color-text-secondary)',
                  'margin-bottom': '8px',
                }}
              >
                {row.department} · {row.role}
              </div>
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  'align-items': 'center',
                }}
              >
                <span style={{ 'font-size': '13px' }}>{fmtSalary(row.salary)}</span>
                <Show
                  when={row.score != null}
                  fallback={
                    <span style={{ 'font-size': '12px', color: 'var(--color-text-tertiary)' }}>
                      No review yet
                    </span>
                  }
                >
                  {scoreBar(row.score as number)}
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </>
  )
}

// Same built-in look as <DataTable>, but the caller owns createTableState — so
// usePersistedView/useUrlView can reach it, unlike <DataTable> which builds its own
// internal, unreachable state. Try reordering or hiding columns, then reload the page.
//
// Uses usePersistence — the combined localStorage+URL helper — instead of wiring
// usePersistedView/useUrlView/resetView separately (as the other sections below do): one
// VIEW_KEYS.persisted object feeds all three, so its storageKey/paramName can't drift out of
// sync between them.
function PersistedTable(props: { labels?: Partial<DataTableLabels> }) {
  const table = createTableState(SAMPLE_DATA, COLUMNS, {
    defaultVisibleColumns: PERSISTED_VISIBLE,
    labels: props.labels,
    defaultPageSize: 5,
  })
  const { reset } = usePersistence(table, VIEW_KEYS.persisted)
  return (
    <>
      <ViewControls onReset={reset} />
      <DataTableView table={table} rowKey="id" />
    </>
  )
}

// Full-featured table, wired the same way as PersistedTable above (createTableState +
// DataTableView instead of <DataTable>) purely so this section can also reach
// usePersistedView/useUrlView/resetView — nothing about the table's own features changes.
function FullTable(props: { labels?: Partial<DataTableLabels> }) {
  const table = createTableState(SAMPLE_DATA, COLUMNS, {
    defaultVisibleColumns: DEFAULT_VISIBLE,
    labels: props.labels,
    defaultPageSize: 5,
  })
  usePersistedView(table, VIEW_KEYS.full.storageKey)
  useUrlView(table, { paramName: VIEW_KEYS.full.paramName })
  return (
    <>
      <ViewControls onReset={() => resetView(table, VIEW_KEYS.full)} />
      <DataTableView table={table} rowKey="id" />
    </>
  )
}

function SelectionTable(props: {
  labels?: Partial<DataTableLabels>
  onSelectionChange: (rows: Employee[]) => void
}) {
  const table = createTableState(SAMPLE_DATA, COLUMNS, {
    defaultVisibleColumns: SELECTION_VISIBLE,
    labels: props.labels,
    defaultPageSize: 5,
  })
  usePersistedView(table, VIEW_KEYS.selection.storageKey)
  useUrlView(table, { paramName: VIEW_KEYS.selection.paramName })
  // DataTableViewProps has no onSelectionChange (that convenience only exists on <DataTable>,
  // which never hands `table` back to its caller — see the package README/CLAUDE.md). This
  // section already owns `table` directly, so the same createEffect(on(...)) <DataTable> uses
  // internally works just as well here.
  createEffect(on(table.selection.rows, (rows) => props.onSelectionChange(rows), { defer: true }))
  return (
    <>
      <ViewControls onReset={() => resetView(table, VIEW_KEYS.selection)} />
      <DataTableView table={table} rowKey="id" selectable />
    </>
  )
}

function ClickTable(props: {
  labels?: Partial<DataTableLabels>
  onRowClick: (row: Employee) => void
}) {
  const table = createTableState(SAMPLE_DATA, COLUMNS, {
    defaultVisibleColumns: CLICK_VISIBLE,
    labels: props.labels,
    defaultPageSize: 5,
  })
  usePersistedView(table, VIEW_KEYS.click.storageKey)
  useUrlView(table, { paramName: VIEW_KEYS.click.paramName })
  return (
    <>
      <ViewControls onReset={() => resetView(table, VIEW_KEYS.click)} />
      <DataTableView table={table} rowKey="id" onRowClick={(row) => props.onRowClick(row)} />
    </>
  )
}

// No `labels` prop — matches the huge-dataset table's pre-existing behavior in the other demos of
// always using the default English labels regardless of the page's locale switcher.
function HugeTable() {
  const table = createTableState(HUGE_DATA, HUGE_COLUMNS, { defaultPageSize: 100 })
  usePersistedView(table, VIEW_KEYS.huge.storageKey)
  useUrlView(table, { paramName: VIEW_KEYS.huge.paramName })
  return (
    <>
      <ViewControls onReset={() => resetView(table, VIEW_KEYS.huge)} />
      <DataTableView table={table} rowKey="id" />
    </>
  )
}

const THEME_CYCLE = { '': 'dark', dark: 'light', light: '' } as const
const THEME_LABELS = { '': 'Auto', dark: 'Dark', light: 'Light' }

export default function App() {
  const [localeKey, setLocaleKey] = createSignal('EN')
  const [selected, setSelected] = createSignal<Employee[]>([])
  const [clicked, setClicked] = createSignal<Employee | null>(null)
  const [theme, setTheme] = createSignal<'' | 'dark' | 'light'>('')
  const [activeSection, setActiveSection] = createSignal(SECTIONS[0].id)

  createEffect(() => {
    if (theme()) {
      document.documentElement.dataset.theme = theme()
    } else {
      delete document.documentElement.dataset.theme
    }
  })

  // Highlights the nav link for whichever section the user has scrolled to: on every scroll,
  // finds the last heading (in document order) that's scrolled up to or past a line just below
  // the sticky nav — measuring actual position directly (rather than watching for
  // IntersectionObserver enter/exit events) avoids both getting stuck between headings on a
  // wide observed band and missing a heading entirely on a fast scroll/jump past a narrow one.
  onMount(() => {
    function updateActiveSection() {
      // At the bottom of the page, the last section's heading may never reach the threshold
      // line if its content is shorter than the remaining viewport — force it active instead.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) {
        setActiveSection(SECTIONS[SECTIONS.length - 1].id)
        return
      }
      let active = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET + SCROLLSPY_TOLERANCE) active = s.id
      }
      setActiveSection(active)
    }
    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    onCleanup(() => window.removeEventListener('scroll', updateActiveSection))
  })

  return (
    <div style={{ 'max-width': '1100px', margin: '0 auto', padding: '32px 24px' }}>
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          'margin-bottom': '4px',
        }}
      >
        <h1 style={{ 'font-size': '20px', 'font-weight': '600', margin: '0' }}>
          DataTable — Solid
        </h1>
        <div style={{ display: 'flex', gap: '4px', 'align-items': 'center' }}>
          <div id="i18n" style={{ display: 'flex', gap: '4px' }}>
            <For each={Object.keys(LOCALES)}>
              {(key) => (
                <button
                  onClick={() => setLocaleKey(key)}
                  style={{
                    padding: '2px 8px',
                    'border-radius': '4px',
                    border: '1px solid var(--color-border-secondary)',
                    cursor: 'pointer',
                    'font-size': '13px',
                    'font-weight': localeKey() === key ? '600' : '400',
                    background:
                      localeKey() === key
                        ? 'var(--color-background-secondary)'
                        : 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    'font-family': 'inherit',
                  }}
                >
                  {key}
                </button>
              )}
            </For>
          </div>
          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'var(--color-border-secondary)',
              margin: '0 2px',
            }}
          />
          <div id="theming">
            <button
              onClick={() => setTheme((t) => THEME_CYCLE[t])}
              style={{
                padding: '2px 8px',
                'border-radius': '4px',
                border: '1px solid var(--color-border-secondary)',
                cursor: 'pointer',
                'font-size': '13px',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-secondary)',
                'font-family': 'inherit',
              }}
            >
              {THEME_LABELS[theme()]}
            </button>
          </div>
        </div>
      </div>
      <p style={{ 'font-size': '14px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        @vates/data-table-solid
      </p>
      <p style={{ 'font-size': '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        Every table below persists its own sort/filter/group/etc. to <code>localStorage</code> and
        the URL (<DocLink anchor="view-persistence--sharing">📖 Docs</DocLink>) — reload the page,
        use its "Copy share link" button, or hit "Reset" to clear it back to defaults.
      </p>

      <nav
        style={{
          position: 'sticky',
          top: '0',
          'z-index': '10',
          display: 'flex',
          gap: '4px',
          'flex-wrap': 'wrap',
          padding: '8px 0',
          'margin-bottom': '8px',
          background: 'var(--color-background-primary)',
          'border-bottom': '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <For each={SECTIONS}>
          {(s) => (
            <a
              href={`#${s.id}`}
              style={{
                padding: '4px 10px',
                'border-radius': '6px',
                'font-size': '13px',
                'font-weight': activeSection() === s.id ? '600' : '400',
                color:
                  activeSection() === s.id
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                background:
                  activeSection() === s.id ? 'var(--color-background-secondary)' : 'transparent',
                'text-decoration': 'none',
              }}
            >
              {s.label}
            </a>
          )}
        </For>
      </nav>

      <h2
        id="full-table"
        style={{
          'font-size': '16px',
          'font-weight': '600',
          'margin-top': '24px',
          'margin-bottom': '4px',
          'scroll-margin-top': `${NAV_OFFSET}px`,
        }}
      >
        Full-featured table
      </h2>
      <p style={{ 'font-size': '14px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
        Every feature together: sort, filter, group, aggregate, column reordering, i18n, dark mode.
        Click a column header to sort by it alone (replacing any other sort); shift-click to add it
        to a multi-column sort instead — or use the Sort dropdown for finer control. Try dragging a
        column header, or grouping by Department — groups start collapsed by default (
        <code>defaultGroupsCollapsed</code>). Salary and Joined group into $20k ranges and years
        instead of one group per row — see <code>groupValue</code>/<code>groupFormat</code>.
      </p>
      <p style={{ 'font-size': '12px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        📖 <DocLink anchor="usage">Package docs</DocLink>
      </p>
      {/* <Show ... keyed> remounts this section (a fresh createTableState) whenever the locale
          changes, rather than mutating labels in place: createTableState's `labels` option is
          read once at construction (unlike react/vue's useTableState, re-invoked every render with
          fresh props) — see createTableState.ts. A full remount is the Solid-idiomatic stand-in for
          React's `key` prop here, and usePersistedView/useUrlView re-hydrate synchronously on the
          very same pass, so no visible flash of default state follows the remount. */}
      <Show when={localeKey()} keyed>
        {(locale) => <FullTable labels={LOCALES[locale]} />}
      </Show>

      <h2
        id="row-selection"
        style={{
          'font-size': '16px',
          'font-weight': '600',
          'margin-top': '40px',
          'margin-bottom': '4px',
          'scroll-margin-top': `${NAV_OFFSET}px`,
        }}
      >
        Row selection
      </h2>
      <p
        style={{
          'font-size': '14px',
          color: 'var(--color-text-secondary)',
          'margin-top': '0',
          'margin-bottom': selected().length > 0 ? '8px' : '16px',
        }}
      >
        Pass <code>selectable</code> to show checkboxes; since this section builds its own{' '}
        <code>createTableState</code>, the selection is read straight off{' '}
        <code>table.selection.rows()</code> — no <code>onSelectionChange</code> callback needed
        (that convenience is <code>{'<DataTable>'}</code>-only). Shift-click a checkbox to select
        (or deselect) the whole range since the last-clicked row. Click a row then use ↑/↓/Home/End
        to move focus (↑/↓ cross page boundaries; <kbd>Ctrl</kbd>+Home/End jump to the true
        first/last row across all pages), <kbd>Space</kbd> to select, and Shift+↑/↓/Home/End to
        extend the range from the keyboard.
      </p>
      <Show when={selected().length > 0}>
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '12px',
            padding: '8px 12px',
            'margin-bottom': '12px',
            background: 'var(--color-background-info)',
            border: '0.5px solid var(--color-border-info)',
            'border-radius': '6px',
            'font-size': '13px',
          }}
        >
          <span
            style={{
              color: 'var(--color-text-info)',
              'font-weight': '500',
              'white-space': 'nowrap',
            }}
          >
            {selected().length} selected
          </span>
          <span
            style={{
              color: 'var(--color-text-secondary)',
              flex: '1',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'white-space': 'nowrap',
            }}
          >
            {selected()
              .map((r) => r.name)
              .join(', ')}
          </span>
          <button
            style={{
              padding: '3px 10px',
              'border-radius': '4px',
              border: '0.5px solid var(--color-border-info)',
              background: 'transparent',
              color: 'var(--color-text-info)',
              cursor: 'pointer',
              'font-size': '13px',
              'font-family': 'inherit',
            }}
          >
            Export
          </button>
        </div>
      </Show>
      <Show when={localeKey()} keyed>
        {(locale) => <SelectionTable labels={LOCALES[locale]} onSelectionChange={setSelected} />}
      </Show>

      <h2
        id="row-click"
        style={{
          'font-size': '16px',
          'font-weight': '600',
          'margin-top': '40px',
          'margin-bottom': '4px',
          'scroll-margin-top': `${NAV_OFFSET}px`,
        }}
      >
        Row click
      </h2>
      <p style={{ 'font-size': '14px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        Pass <code>onRowClick</code> to react to a row being clicked — it receives the full row
        object, no key lookup needed. Also fires on <kbd>Enter</kbd> while a row has keyboard focus.
      </p>
      <Show when={clicked()}>
        {(c) => (
          <div
            style={{
              padding: '8px 12px',
              'margin-bottom': '12px',
              background: 'var(--color-background-info)',
              border: '0.5px solid var(--color-border-info)',
              'border-radius': '6px',
              'font-size': '13px',
              color: 'var(--color-text-info)',
            }}
          >
            Last clicked: {c().name} ({c().role})
          </div>
        )}
      </Show>
      <Show when={localeKey()} keyed>
        {(locale) => <ClickTable labels={LOCALES[locale]} onRowClick={setClicked} />}
      </Show>

      <h2
        id="custom-layout"
        style={{
          'font-size': '16px',
          'font-weight': '600',
          'margin-top': '40px',
          'margin-bottom': '4px',
          'scroll-margin-top': `${NAV_OFFSET}px`,
        }}
      >
        Custom layout via createTableState
      </h2>
      <p style={{ 'font-size': '14px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        Same data and sort logic — your own render. Sort here persists across reloads (
        <code>usePersistedView</code>) and is reflected in the URL (<code>useUrlView</code>) —
        reload the page or use "Copy share link" and open it in a new tab.
      </p>
      <EmployeeCards />

      <h2
        id="persisted-table"
        style={{
          'font-size': '16px',
          'font-weight': '600',
          'margin-top': '40px',
          'margin-bottom': '4px',
          'scroll-margin-top': `${NAV_OFFSET}px`,
        }}
      >
        Persisted table via DataTableView
      </h2>
      <p style={{ 'font-size': '14px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        <code>{'<DataTable>'}</code> builds its own <code>createTableState</code> internally, so
        persistence helpers can't reach it. <code>{'<DataTableView>'}</code> renders the same
        built-in UI from a <code>createTableState</code> instance you own instead — reorder or hide
        a column, then reload the page.
      </p>
      <Show when={localeKey()} keyed>
        {(locale) => <PersistedTable labels={LOCALES[locale]} />}
      </Show>

      <h2
        id="huge-dataset"
        style={{
          'font-size': '16px',
          'font-weight': '600',
          'margin-top': '40px',
          'margin-bottom': '4px',
          'scroll-margin-top': `${NAV_OFFSET}px`,
        }}
      >
        Huge dataset
      </h2>
      <p style={{ 'font-size': '14px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        A generated e-commerce order history — {HUGE_ROW_COUNT.toLocaleString()} rows across
        thousands of customers — to demonstrate the table staying responsive at scale: sorting,
        filtering, and grouping all run over the full dataset, while only ~100 rows are ever
        rendered per page. The <code>Customer</code> filter has thousands of distinct values, but
        its checklist only ever mounts the rows scrolled into view. Try grouping by{' '}
        <code>Category</code> and/or <code>Region</code>.
      </p>
      <HugeTable />
    </div>
  )
}
