import {
  createDataTable,
  persistViewToLocalStorage,
  syncViewToUrl,
  resetView,
  createScoreBar,
  LABELS_EN,
  LABELS_FR,
  LABELS_DE,
  LABELS_ES,
  LABELS_PT,
  type ColumnDef,
  type DataTableLabels,
  type TableViewState,
} from '@vates/data-table-vanilla'
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

const COLUMNS: ColumnDef<Employee>[] = [
  { key: 'id', label: 'ID', type: 'number', width: 60, sortable: false, filterable: false },
  { key: 'name', label: 'Name', type: 'string', width: 160 },
  { key: 'department', label: 'Department', type: 'string', width: 130, groupable: true },
  { key: 'role', label: 'Role', type: 'string', width: 140, groupable: true },
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
  { key: 'status', label: 'Status', type: 'string', width: 90, groupable: true },
  // render returns a DOM node instead of a string, so it can build richer cells (bars, badges,
  // links) than format's escaped-string output allows
  {
    key: 'score',
    label: 'Score',
    type: 'number',
    width: 80,
    render: (v) => createScoreBar(Number(v)),
  },
  // array-valued column: filter checklist lists individual skills, grouping fans a row into
  // one group per skill, and cells join the array with ', ' — all automatic, no flag needed
  { key: 'skills', label: 'Skills', width: 180, groupable: true },
]

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

// Each secondary section only needs a couple of columns to make its point — a narrower
// defaultVisibleColumns keeps each table visually distinct instead of repeating the same
// 9-column table everywhere. The persisted table keeps more, since reordering needs several
// columns to be meaningful.
const SELECTION_VISIBLE = ['name', 'department', 'salary']
const CLICK_VISIBLE = ['name', 'department', 'role']
const PERSISTED_VISIBLE = ['name', 'department', 'salary', 'status', 'score']
const DYNAMIC_VISIBLE = ['name', 'department', 'role', 'score']

const SECTIONS = [
  { id: 'full-table', label: 'Full-featured table' },
  { id: 'row-selection', label: 'Row selection' },
  { id: 'row-click', label: 'Row click' },
  { id: 'persisted-table', label: 'View persistence & sharing' },
  { id: 'dynamic-data', label: 'Dynamic data' },
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
const README_URL = 'https://github.com/vatesfr/data-table/blob/main/packages/vanilla/README.md'

function docLink(anchor: string, label: string): string {
  return `<a href="${README_URL}#${anchor}" target="_blank" rel="noopener" style="color:var(--color-text-secondary);text-decoration:underline">${label}</a>`
}

// Every table on the page persists its own view (sort/filter/group/etc.) independently — each
// gets its own localStorage key and its own URL query param, so the six sections don't clobber
// each other and "Copy share link" round-trips the whole page's state in one URL.
const VIEW_KEYS: Record<string, { storageKey: string; paramName: string }> = {
  full: { storageKey: 'dt-demo-full-table', paramName: 'full' },
  selection: { storageKey: 'dt-demo-row-selection', paramName: 'sel' },
  click: { storageKey: 'dt-demo-row-click', paramName: 'click' },
  persisted: { storageKey: 'dt-demo-persisted-table', paramName: 'persisted' },
  dynamic: { storageKey: 'dt-demo-dynamic-data', paramName: 'dyn' },
  huge: { storageKey: 'dt-demo-huge-dataset', paramName: 'huge' },
}

// Explicit background/color (not just a border) — a bare <button> doesn't inherit the page's
// text color in most browsers (UA stylesheets give buttons their own default, often black
// regardless of the page's own color-scheme), so without this the text renders unreadably dark
// on the dark theme's near-black background. Matches the theme/locale toggle buttons' style.
const VIEW_BTN_STYLE =
  'padding:4px 10px;border-radius:6px;border:1px solid var(--color-border-secondary);cursor:pointer;background:var(--color-background-primary);color:var(--color-text-secondary);font-size:13px;font-family:inherit'

// Markup for the "Copy share link" / "Reset" pair shown above every table. Lives outside each
// table's own container div (a table's render() rebuilds its container's innerHTML on every
// change, which would wipe these out) and is wired via one delegated click listener on `app`,
// dispatching on `data-view-copy`/`data-view-reset` — see the bottom of this file.
function renderViewControls(key: string): string {
  return `
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button data-view-copy="${key}" style="${VIEW_BTN_STYLE}">Copy share link</button>
      <button data-view-reset="${key}" style="${VIEW_BTN_STYLE}">Reset</button>
    </div>
  `
}

type ViewStateTable = {
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
  onViewChange(cb: (view: TableViewState) => void): () => void
}

// Wires persistViewToLocalStorage + syncViewToUrl for one table and returns a single unsubscribe
// covering both — called again after every locale-switch recreation (see below), since a fresh
// table instance needs its own fresh subscriptions.
function wireViewPersistence(table: ViewStateTable, key: keyof typeof VIEW_KEYS): () => void {
  const { storageKey, paramName } = VIEW_KEYS[key]
  const unpersist = persistViewToLocalStorage(table, storageKey)
  const unsync = syncViewToUrl(table, { paramName })
  return () => {
    unpersist()
    unsync()
  }
}

// ---- Page scaffold ----

const app = document.getElementById('app')!
app.innerHTML = `
  <div style="max-width:1100px;margin:0 auto;padding:32px 24px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h1 style="font-size:20px;font-weight:600;margin:0">DataTable — Vanilla</h1>
      <div style="display:flex;gap:4px;align-items:center">
        <div id="i18n" style="display:flex;gap:4px">
          <div id="locale-btns" style="display:flex;gap:4px"></div>
        </div>
        <div style="width:1px;height:16px;background:var(--color-border-secondary);margin:0 2px"></div>
        <div id="theming">
          <button id="theme-btn" style="padding:2px 8px;border-radius:4px;border:1px solid var(--color-border-secondary);cursor:pointer;font-size:13px;background:var(--color-background-primary);color:var(--color-text-secondary);font-family:inherit">Auto</button>
        </div>
      </div>
    </div>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:16px">
      @vates/data-table-vanilla
    </p>
    <p style="font-size:13px;color:var(--color-text-secondary);margin-top:0;margin-bottom:16px">
      Every table below persists its own sort/filter/group/etc. to <code>localStorage</code> and the
      URL (${docLink('view-persistence--sharing', '📖 Docs')}) — reload the page, use its "Copy share
      link" button, or hit "Reset" to clear it back to defaults.
    </p>

    <nav style="position:sticky;top:0;z-index:10;display:flex;gap:4px;flex-wrap:wrap;padding:8px 0;
      margin-bottom:8px;background:var(--color-background-primary);border-bottom:0.5px solid var(--color-border-tertiary)">
      ${SECTIONS.map(
        (s) =>
          `<a href="#${s.id}" data-nav-id="${s.id}" style="padding:4px 10px;border-radius:6px;font-size:13px;color:var(--color-text-secondary);text-decoration:none">${s.label}</a>`,
      ).join('')}
    </nav>

    <h2 id="full-table" style="font-size:16px;font-weight:600;margin-top:24px;margin-bottom:4px;scroll-margin-top:56px">Full-featured table</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:4px">
      Every feature together: sort, filter, group, aggregate, column reordering, i18n, dark mode.
      Try dragging a column header, or grouping by Department — groups start collapsed by default
      (<code>defaultGroupsCollapsed</code>).
    </p>
    <p style="font-size:12px;color:var(--color-text-secondary);margin-top:0;margin-bottom:16px">
      📖 ${docLink('column-reordering', 'Column reordering')} ·
      ${docLink('multi-value-array-columns', 'Multi-value columns')} ·
      ${docLink('computed-columns', 'Computed columns')} ·
      ${docLink('cell-customization', 'Cell customization')} ·
      ${docLink('aggregation', 'Aggregation')}
    </p>
    ${renderViewControls('full')}
    <div id="table1"></div>

    <h2 id="row-selection" style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px;scroll-margin-top:56px">Row selection</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:16px">
      Pass <code>selectable</code> to show checkboxes; <code>onSelectionChange</code> receives the updated array.
      Shift-click a checkbox to select (or deselect) the whole range since the last-clicked row.
      Click a row then use ↑/↓/Home/End to move focus (↑/↓ cross page boundaries; <code>Ctrl</code>+Home/End
      jump to the true first/last row across all pages), <code>Space</code> to select, and Shift+↑/↓/Home/End
      to extend the range from the keyboard.
      ${docLink('row-selection', '📖 Docs')}
    </p>
    <div id="selection-banner" style="display:none;align-items:center;gap:12px;padding:8px 12px;margin-bottom:12px;
      background:var(--color-background-info);border:0.5px solid var(--color-border-info);
      border-radius:6px;font-size:13px"></div>
    ${renderViewControls('selection')}
    <div id="table2"></div>

    <h2 id="row-click" style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px;scroll-margin-top:56px">Row click</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:8px">
      Pass <code>onRowClick</code> to react to a row being clicked — it receives the full row object, no key lookup needed.
      Also fires on <code>Enter</code> while a row has keyboard focus.
      ${docLink('row-click', '📖 Docs')}
    </p>
    <div id="click-banner" style="display:none;padding:8px 12px;margin-bottom:12px;
      background:var(--color-background-info);border:0.5px solid var(--color-border-info);
      border-radius:6px;font-size:13px;color:var(--color-text-info)"></div>
    ${renderViewControls('click')}
    <div id="table-click"></div>

    <h2 id="persisted-table" style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px;scroll-margin-top:56px">View persistence &amp; sharing</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:12px">
      <code>persistViewToLocalStorage</code> saves sort/filter/group/etc. across reloads;
      <code>syncViewToUrl</code> reflects them in the URL — reload the page or use "Copy share link"
      and open it in a new tab.
      ${docLink('view-persistence--sharing', '📖 Docs')}
    </p>
    ${renderViewControls('persisted')}
    <div id="table-persist"></div>

    <h2 id="dynamic-data" style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px;scroll-margin-top:56px">Dynamic data</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:12px">
      Call <code>table.setData()</code> to push new rows at any time. This table's sort/filter/group
      state persists too, independently of the data itself.
    </p>
    <button id="add-row-btn" style="padding:4px 10px;border-radius:6px;border:1px solid var(--color-border-secondary);
      background:var(--color-background-primary);color:var(--color-text-secondary);cursor:pointer;font-size:13px;font-family:inherit;margin-bottom:12px">+ Add random row</button>
    ${renderViewControls('dynamic')}
    <div id="table3"></div>

    <h2 id="huge-dataset" style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px;scroll-margin-top:56px">Huge dataset</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:16px">
      A generated e-commerce order history — ${HUGE_ROW_COUNT.toLocaleString()} rows across
      thousands of customers — to demonstrate the table staying responsive at scale: sorting,
      filtering, and grouping all run over the full dataset, while only ~100 rows are ever
      rendered per page. The <code>Customer</code> filter has thousands of distinct values, but
      its checklist only ever mounts the rows scrolled into view. Try grouping by
      <code>Category</code> and/or <code>Region</code>.
    </p>
    ${renderViewControls('huge')}
    <div id="table-huge"></div>
  </div>
`

// ---- Scrollspy: highlight the active nav link ----
//
// Highlights the nav link for whichever section the user has scrolled to: on every scroll,
// finds the last heading (in document order) that's scrolled up to or past a line just below
// the sticky nav — measuring actual position directly (rather than watching for
// IntersectionObserver enter/exit events) avoids both getting stuck between headings on a wide
// observed band and missing a heading entirely on a fast scroll/jump past a narrow one.

const navLinks = new Map(
  SECTIONS.map((s) => [
    s.id,
    document.querySelector<HTMLAnchorElement>(`a[data-nav-id="${s.id}"]`)!,
  ]),
)

function setActiveNavLink(id: string) {
  for (const [sectionId, link] of navLinks) {
    const active = sectionId === id
    link.style.fontWeight = active ? '600' : '400'
    link.style.color = active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
    link.style.background = active ? 'var(--color-background-secondary)' : 'transparent'
  }
}

function updateActiveSection() {
  // At the bottom of the page, the last section's heading may never reach the threshold
  // line if its content is shorter than the remaining viewport — force it active instead.
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  if (atBottom) {
    setActiveNavLink(SECTIONS[SECTIONS.length - 1].id)
    return
  }
  let active = SECTIONS[0].id
  for (const s of SECTIONS) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top <= NAV_OFFSET + SCROLLSPY_TOLERANCE) active = s.id
  }
  setActiveNavLink(active)
}
window.addEventListener('scroll', updateActiveSection, { passive: true })

// ---- Locale switcher ----

let currentLocale = 'EN'
const localeBtns = document.getElementById('locale-btns')!

function renderLocaleBtns() {
  localeBtns.innerHTML = Object.keys(LOCALES)
    .map(
      (key) => `
    <button data-locale="${key}" style="padding:2px 8px;border-radius:4px;border:1px solid var(--color-border-secondary);cursor:pointer;font-size:13px;font-family:inherit;
      font-weight:${currentLocale === key ? 600 : 400};background:${currentLocale === key ? 'var(--color-background-secondary)' : 'var(--color-background-primary)'};color:var(--color-text-primary)">
      ${key}
    </button>
  `,
    )
    .join('')
}

renderLocaleBtns()

// ---- Theme toggle ----

type Theme = '' | 'dark' | 'light'
const THEME_CYCLE: Record<Theme, Theme> = { '': 'dark', dark: 'light', light: '' }
const THEME_LABELS: Record<Theme, string> = { '': 'Auto', dark: 'Dark', light: 'Light' }
let currentTheme: Theme = ''
const themeBtn = document.getElementById('theme-btn')!

themeBtn.addEventListener('click', () => {
  currentTheme = THEME_CYCLE[currentTheme]
  if (currentTheme) {
    document.documentElement.dataset.theme = currentTheme
  } else {
    delete document.documentElement.dataset.theme
  }
  themeBtn.textContent = THEME_LABELS[currentTheme]
})

// ---- Table 1: full-featured ----

function createTable1() {
  return createDataTable<Employee>(document.getElementById('table1')!, {
    data: SAMPLE_DATA,
    columns: COLUMNS,
    rowKey: 'id',
    defaultVisibleColumns: DEFAULT_VISIBLE,
    defaultPageSize: 5,
    labels: LOCALES[currentLocale],
  })
}
let table1 = createTable1()
let unwireTable1 = wireViewPersistence(table1, 'full')

// ---- Table 2: selectable ----

const banner = document.getElementById('selection-banner')!

function createTable2() {
  return createDataTable<Employee>(document.getElementById('table2')!, {
    data: SAMPLE_DATA,
    columns: COLUMNS,
    rowKey: 'id',
    defaultVisibleColumns: SELECTION_VISIBLE,
    defaultPageSize: 5,
    labels: LOCALES[currentLocale],
    selectable: true,
    onSelectionChange(rows) {
      if (rows.length === 0) {
        banner.style.display = 'none'
      } else {
        banner.style.display = 'flex'
        banner.innerHTML = `
          <span style="color:var(--color-text-info);font-weight:500;white-space:nowrap">${rows.length} selected</span>
          <span style="color:var(--color-text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${rows.map((r) => r.name).join(', ')}
          </span>
        `
      }
    },
  })
}
let table2 = createTable2()
let unwireTable2 = wireViewPersistence(table2, 'selection')

// ---- Table: row click ----

const clickBanner = document.getElementById('click-banner')!

function createTableClick() {
  return createDataTable<Employee>(document.getElementById('table-click')!, {
    data: SAMPLE_DATA,
    columns: COLUMNS,
    rowKey: 'id',
    defaultVisibleColumns: CLICK_VISIBLE,
    defaultPageSize: 5,
    labels: LOCALES[currentLocale],
    onRowClick(row) {
      clickBanner.style.display = 'block'
      clickBanner.textContent = `Last clicked: ${row.name} (${row.role})`
    },
  })
}
let tableClick = createTableClick()
let unwireTableClick = wireViewPersistence(tableClick, 'click')

// ---- Table: view persistence & sharing ----

function createTablePersist() {
  return createDataTable<Employee>(document.getElementById('table-persist')!, {
    data: SAMPLE_DATA,
    columns: COLUMNS,
    rowKey: 'id',
    defaultVisibleColumns: PERSISTED_VISIBLE,
    defaultPageSize: 5,
    labels: LOCALES[currentLocale],
  })
}
let tablePersist = createTablePersist()
let unwireTablePersist = wireViewPersistence(tablePersist, 'persisted')

// ---- Table 3: dynamic data ----

let dynamicData = SAMPLE_DATA.slice(0, 5)

function createTable3() {
  return createDataTable<Employee>(document.getElementById('table3')!, {
    data: dynamicData,
    columns: COLUMNS,
    rowKey: 'id',
    defaultVisibleColumns: DYNAMIC_VISIBLE,
    labels: LOCALES[currentLocale],
  })
}
let table3 = createTable3()
let unwireTable3 = wireViewPersistence(table3, 'dynamic')

let nextId = 100
document.getElementById('add-row-btn')!.addEventListener('click', () => {
  const depts = ['Engineering', 'Product', 'Design', 'Sales', 'HR']
  const roles = ['Engineer', 'Manager', 'Designer', 'Analyst', 'Director']
  const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey']
  const allSkills = ['TypeScript', 'React', 'Leadership', 'Figma', 'Negotiation', 'Analytics']
  dynamicData = [
    ...dynamicData,
    {
      id: nextId++,
      name: `${names[nextId % names.length]} #${nextId}`,
      department: depts[nextId % depts.length],
      role: roles[nextId % roles.length],
      salary: 60000 + ((nextId * 1234) % 80000),
      joined: '2024-01-01',
      status: nextId % 5 === 0 ? 'Inactive' : 'Active',
      score: 60 + ((nextId * 7) % 40),
      skills: [allSkills[nextId % allSkills.length], allSkills[(nextId + 3) % allSkills.length]],
    },
  ]
  table3.setData(dynamicData)
})

// ---- Table: huge dataset ----

function createTableHuge() {
  return createDataTable(document.getElementById('table-huge')!, {
    data: HUGE_DATA,
    columns: HUGE_COLUMNS,
    rowKey: 'id',
    defaultPageSize: 100,
    labels: LOCALES[currentLocale],
  })
}
let tableHuge = createTableHuge()
let unwireTableHuge = wireViewPersistence(tableHuge, 'huge')

// ---- Reset / copy-share-link buttons: one delegated listener for every table's controls ----
//
// RESET_TARGETS' arrow functions close over the `let` instance variables above and read them at
// call time, so they always resolve to whichever table is currently live — important since the
// locale switcher below destroys and recreates every table.
const RESET_TARGETS: Record<string, () => ViewStateTable> = {
  full: () => table1,
  selection: () => table2,
  click: () => tableClick,
  persisted: () => tablePersist,
  dynamic: () => table3,
  huge: () => tableHuge,
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const copyBtn = target.closest<HTMLButtonElement>('[data-view-copy]')
  if (copyBtn) {
    navigator.clipboard.writeText(window.location.href)
    copyBtn.textContent = 'Copied!'
    setTimeout(() => (copyBtn.textContent = 'Copy share link'), 1500)
    return
  }
  const resetBtn = target.closest<HTMLButtonElement>('[data-view-reset]')
  if (resetBtn) {
    const key = resetBtn.dataset.viewReset!
    resetView(RESET_TARGETS[key](), VIEW_KEYS[key])
  }
})

// ---- Locale switcher: recreate every table with the new locale ----
//
// Labels are set at creation time, so changing locale means destroying and recreating each
// table — there's no other way to change them after the fact. Registered here (rather than in
// the "Locale switcher" section above) because it needs every table's create-factory and
// instance variable, all defined further down the file: function declarations hoist, but the
// `let` bindings for those instances don't exist yet at that point in the script's execution —
// harmless here since this only runs later, in response to a click, by which time everything
// below has finished initializing.

localeBtns.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-locale]') as HTMLElement | null
  if (!btn) return
  currentLocale = btn.dataset.locale!
  renderLocaleBtns()

  unwireTable1()
  table1.destroy()
  table1 = createTable1()
  unwireTable1 = wireViewPersistence(table1, 'full')

  unwireTable2()
  table2.destroy()
  table2 = createTable2()
  unwireTable2 = wireViewPersistence(table2, 'selection')
  banner.style.display = 'none' // the new table starts with an empty selection

  unwireTableClick()
  tableClick.destroy()
  tableClick = createTableClick()
  unwireTableClick = wireViewPersistence(tableClick, 'click')

  unwireTablePersist()
  tablePersist.destroy()
  tablePersist = createTablePersist()
  unwireTablePersist = wireViewPersistence(tablePersist, 'persisted')

  unwireTable3()
  table3.destroy()
  table3 = createTable3()
  unwireTable3 = wireViewPersistence(table3, 'dynamic')

  unwireTableHuge()
  tableHuge.destroy()
  tableHuge = createTableHuge()
  unwireTableHuge = wireViewPersistence(tableHuge, 'huge')
})

// All tables are populated by this point, so the page has its real (final) height —
// safe to run the initial scrollspy check now (see the scrollspy block above: running it
// earlier, while the table containers are still empty, made the page look shorter than the
// viewport and falsely triggered the "at the bottom of the page" fallback).
updateActiveSection()
