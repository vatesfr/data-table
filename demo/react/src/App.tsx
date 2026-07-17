import { useState, useEffect, type ReactNode } from 'react'
import {
  DataTable,
  DataTableView,
  Badge,
  ScoreBar,
  useTableState,
  usePersistedView,
  useUrlView,
  LABELS_EN,
  LABELS_FR,
  LABELS_DE,
  LABELS_ES,
  LABELS_PT,
  type ColumnDef,
  type DataTableLabels,
} from '@vates/data-table-react'
import { HUGE_DATA, HUGE_COLUMNS, HUGE_ROW_COUNT } from './hugeData'

interface Employee {
  id: number
  name: string
  department: string
  role: string
  salary: number
  joined: string
  status: string
  score: number
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
    score: 73,
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
    score: 76,
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

const COLUMNS: ColumnDef<Employee>[] = [
  // sortable: false + filterable: false — no sort/filter UI; hidden by default via defaultVisibleColumns
  { key: 'id', label: 'ID', type: 'number', width: 60, sortable: false, filterable: false },
  { key: 'name', label: 'Name', type: 'string', width: 160 },
  // groupable + render: JSX cell; renderFilterLabel: custom chip in filter dropdown
  {
    key: 'department',
    label: 'Department',
    type: 'string',
    width: 130,
    groupable: true,
    render: (v) => <Badge value={String(v)} colorMap={DEPT_COLORS} />,
    renderFilterLabel: (v) => <Badge value={v} colorMap={DEPT_COLORS} />,
  },
  { key: 'role', label: 'Role', type: 'string', width: 140, groupable: true },
  // format: plain string — use this when no JSX is needed; numeric range filter is automatic
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
  },
  // type: 'date' gets a Year › Month › Day filter tree instead of a checklist/range
  { key: 'joined', label: 'Joined', type: 'date', width: 100 },
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
  // render + renderFilterLabel — badge consistent in cells and filter dropdown
  {
    key: 'status',
    label: 'Status',
    type: 'string',
    width: 90,
    groupable: true,
    render: (v) => <Badge value={String(v)} colorMap={STATUS_COLORS} />,
    renderFilterLabel: (v) => <Badge value={v} colorMap={STATUS_COLORS} />,
  },
  // render returns JSX — use render (not format) when the cell isn't plain text
  {
    key: 'score',
    label: 'Score',
    type: 'number',
    width: 80,
    render: (v) => <ScoreBar value={Number(v)} />,
  },
  // array-valued column: filter checklist lists individual skills, grouping fans a row into
  // one group per skill, and cells join the array with ', ' — all automatic, no flag needed
  { key: 'skills', label: 'Skills', width: 180, groupable: true },
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
  'skills',
]

// Row selection/click only need a couple of columns to make their point — a narrower
// defaultVisibleColumns keeps each section visually distinct instead of repeating the same
// 9-column table. The persisted table keeps more, since reordering needs several columns to
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

// Cross-links between this demo and the package README: each README concept the demo
// showcases gets a link straight to the section that demonstrates it, and vice versa.
const README_URL = 'https://github.com/vatesfr/data-table/blob/main/packages/react/README.md'

function DocLink({ anchor, children }: { anchor: string; children: ReactNode }) {
  return (
    <a
      href={`${README_URL}#${anchor}`}
      target="_blank"
      rel="noopener"
      style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

function fmtSalary(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Headless section: useTableState owns the sort/filter logic; you own the render.
// usePersistedView/useUrlView are opt-in helpers — the sort below survives a reload
// (localStorage) and round-trips through "Copy share link" (URL query param).
function EmployeeCards() {
  const table = useTableState(SAMPLE_DATA, COLUMNS)
  const { processedData, getSortIcon, toggleSort } = table
  usePersistedView(table, 'data-table-demo-view')
  useUrlView(table)
  const [copied, setCopied] = useState(false)

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {(['name', 'salary', 'score'] as const).map((col) => (
          <button
            key={col}
            onClick={() => toggleSort(col)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              cursor: 'pointer',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            {col.charAt(0).toUpperCase() + col.slice(1)} {getSortIcon(col)}
          </button>
        ))}
        <button
          onClick={copyShareLink}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--color-border-secondary)',
            cursor: 'pointer',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            fontFamily: 'inherit',
            marginLeft: 'auto',
          }}
        >
          {copied ? 'Copied!' : 'Copy share link'}
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {processedData.map((row) => (
          <div
            key={row.id}
            style={{
              border: '1px solid var(--color-border-tertiary)',
              borderRadius: 8,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{row.name}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              {row.department} · {row.role}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>{fmtSalary(row.salary)}</span>
              <ScoreBar value={row.score} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// Same built-in look as <DataTable>, but the caller owns useTableState — so
// usePersistedView/useUrlView can reach it, unlike <DataTable> which builds its own
// internal, unreachable state. Try reordering or hiding columns, then reload the page.
function PersistedTable({ labels }: { labels?: Partial<DataTableLabels> }) {
  const table = useTableState(SAMPLE_DATA, COLUMNS, PERSISTED_VISIBLE, labels, 5)
  usePersistedView(table, 'data-table-demo-persisted-view')
  useUrlView(table, { paramName: 'pview' })
  return <DataTableView table={table} data={SAMPLE_DATA} columns={COLUMNS} rowKey="id" />
}

const THEME_CYCLE = { '': 'dark', dark: 'light', light: '' } as const
const THEME_LABELS = { '': 'Auto', dark: 'Dark', light: 'Light' }

export default function App() {
  const [localeKey, setLocaleKey] = useState('EN')
  const [selected, setSelected] = useState<Employee[]>([])
  const [clicked, setClicked] = useState<Employee | null>(null)
  const [theme, setTheme] = useState<'' | 'dark' | 'light'>('')
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme
    } else {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  // Highlights the nav link for whichever section the user has scrolled to: on every scroll,
  // finds the last heading (in document order) that's scrolled up to or past a line just below
  // the sticky nav — measuring actual position directly (rather than watching for
  // IntersectionObserver enter/exit events) avoids both getting stuck between headings on a
  // wide observed band and missing a heading entirely on a fast scroll/jump past a narrow one.
  useEffect(() => {
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
    return () => window.removeEventListener('scroll', updateActiveSection)
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>DataTable — React</h1>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div id="i18n" style={{ display: 'flex', gap: 4 }}>
            {Object.keys(LOCALES).map((key) => (
              <button
                key={key}
                onClick={() => setLocaleKey(key)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: localeKey === key ? 600 : 400,
                  background:
                    localeKey === key
                      ? 'var(--color-background-secondary)'
                      : 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                }}
              >
                {key}
              </button>
            ))}
          </div>
          <div
            style={{
              width: 1,
              height: 16,
              background: 'var(--color-border-secondary)',
              margin: '0 2px',
            }}
          />
          <div id="theming">
            <button
              onClick={() => setTheme((t) => THEME_CYCLE[t])}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              {THEME_LABELS[theme]}
            </button>
          </div>
        </div>
      </div>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        @vates/data-table-react
      </p>

      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          padding: '8px 0',
          marginBottom: 8,
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: activeSection === s.id ? 600 : 400,
              color:
                activeSection === s.id
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
              background:
                activeSection === s.id ? 'var(--color-background-secondary)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            {s.label}
          </a>
        ))}
      </nav>

      <h2
        id="full-table"
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginTop: 24,
          marginBottom: 4,
          scrollMarginTop: NAV_OFFSET,
        }}
      >
        Full-featured table
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 4,
        }}
      >
        Every feature together: sort, filter, group, aggregate, column reordering, i18n, dark mode.
        Try dragging a column header, or grouping by Department — groups start collapsed by default
        (<code>defaultGroupsCollapsed</code>).
      </p>
      <p
        style={{
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        📖 <DocLink anchor="column-reordering">Column reordering</DocLink>
        {' · '}
        <DocLink anchor="multi-value-array-columns">Multi-value columns</DocLink>
        {' · '}
        <DocLink anchor="computed-columns">Computed columns</DocLink>
        {' · '}
        <DocLink anchor="custom-rendering">Custom rendering</DocLink>
        {' · '}
        <DocLink anchor="aggregation">Aggregation</DocLink>
      </p>
      <DataTable
        data={SAMPLE_DATA}
        columns={COLUMNS}
        rowKey="id"
        labels={LOCALES[localeKey]}
        defaultVisibleColumns={DEFAULT_VISIBLE}
        defaultPageSize={5}
      />

      <h2
        id="row-selection"
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginTop: 40,
          marginBottom: 4,
          scrollMarginTop: NAV_OFFSET,
        }}
      >
        Row selection
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: selected.length > 0 ? 8 : 16,
        }}
      >
        Pass <code>selectable</code> to show checkboxes; <code>onSelectionChange</code> receives the
        updated array of selected rows. Shift-click a checkbox to select (or deselect) the whole
        range since the last-clicked row. Click a row then use ↑/↓/Home/End to move focus (↑/↓ cross
        page boundaries; <kbd>Ctrl</kbd>+Home/End jump to the true first/last row across all pages),{' '}
        <kbd>Space</kbd> to select, and Shift+↑/↓/Home/End to extend the range from the keyboard.{' '}
        <DocLink anchor="row-selection">📖 Docs</DocLink>
      </p>
      {selected.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            marginBottom: 12,
            background: 'var(--color-background-info)',
            border: '0.5px solid var(--color-border-info)',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--color-text-info)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {selected.length} selected
          </span>
          <span
            style={{
              color: 'var(--color-text-secondary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selected.map((r) => r.name).join(', ')}
          </span>
          <button
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: '0.5px solid var(--color-border-info)',
              background: 'transparent',
              color: 'var(--color-text-info)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            Export
          </button>
        </div>
      )}
      <DataTable
        data={SAMPLE_DATA}
        columns={COLUMNS}
        rowKey="id"
        labels={LOCALES[localeKey]}
        defaultVisibleColumns={SELECTION_VISIBLE}
        defaultPageSize={5}
        selectable
        onSelectionChange={setSelected}
      />

      <h2
        id="row-click"
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginTop: 40,
          marginBottom: 4,
          scrollMarginTop: NAV_OFFSET,
        }}
      >
        Row click
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 8,
        }}
      >
        Pass <code>onRowClick</code> to react to a row being clicked — it receives the full row
        object, no key lookup needed. Also fires on <kbd>Enter</kbd> while a row has keyboard focus.{' '}
        <DocLink anchor="row-click">📖 Docs</DocLink>
      </p>
      {clicked && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            background: 'var(--color-background-info)',
            border: '0.5px solid var(--color-border-info)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--color-text-info)',
          }}
        >
          Last clicked: {clicked.name} ({clicked.role})
        </div>
      )}
      <DataTable
        data={SAMPLE_DATA}
        columns={COLUMNS}
        rowKey="id"
        labels={LOCALES[localeKey]}
        defaultVisibleColumns={CLICK_VISIBLE}
        defaultPageSize={5}
        onRowClick={setClicked}
      />

      <h2
        id="custom-layout"
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginTop: 40,
          marginBottom: 4,
          scrollMarginTop: NAV_OFFSET,
        }}
      >
        Custom layout via useTableState
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        Same data and sort logic — your own render. Sort here persists across reloads (
        <code>usePersistedView</code>) and is reflected in the URL (<code>useUrlView</code>) —
        reload the page or use "Copy share link" and open it in a new tab.
      </p>
      <EmployeeCards />

      <h2
        id="persisted-table"
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginTop: 40,
          marginBottom: 4,
          scrollMarginTop: NAV_OFFSET,
        }}
      >
        Persisted table via DataTableView
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        <code>DataTable</code> builds its own <code>useTableState</code> internally, so persistence
        helpers can't reach it. <code>DataTableView</code> renders the same built-in UI from a{' '}
        <code>useTableState</code> instance you own instead — reorder or hide a column, then reload
        the page. <DocLink anchor="view-persistence--sharing">📖 Docs</DocLink>
      </p>
      <PersistedTable labels={LOCALES[localeKey]} />

      <h2
        id="huge-dataset"
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginTop: 40,
          marginBottom: 4,
          scrollMarginTop: NAV_OFFSET,
        }}
      >
        Huge dataset
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        A generated dataset of {HUGE_ROW_COUNT.toLocaleString()} rows, to demonstrate the table
        staying responsive at scale — sorting, filtering (with faceted per-value counts), and
        grouping all run over the full dataset, while only ~100 rows are ever rendered per page.
      </p>
      <DataTable data={HUGE_DATA} columns={HUGE_COLUMNS} rowKey="id" defaultPageSize={100} />
    </div>
  )
}
