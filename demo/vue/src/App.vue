<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
} from '@vates/data-table-vue'

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
  // groupable: true — slot #cell-department / #filter-department / #group-department override rendering
  {
    key: 'department',
    label: 'Department',
    type: 'string',
    width: 130,
    groupable: true,
    format: (v) => String(v),
  },
  { key: 'role', label: 'Role', type: 'string', width: 140, groupable: true },
  // format: plain string — numeric range filter is automatic for type: 'number'
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
  },
  // slot #cell-status / #filter-status / #group-status override rendering
  { key: 'status', label: 'Status', type: 'string', width: 90, groupable: true },
  // slot #cell-score overrides rendering
  { key: 'score', label: 'Score', type: 'number', width: 80 },
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

const localeKey = ref('EN')
const currentLocale = computed(() => LOCALES[localeKey.value])

// Cross-links between this demo and the package README: each README concept the demo
// showcases gets a link straight to the section that demonstrates it, and vice versa. Returned
// as an HTML string (rendered via v-html below) since Vue templates can't interpolate raw
// markup through {{ }}.
const README_URL = 'https://github.com/vatesfr/data-table/blob/main/packages/vue/README.md'
function docLink(anchor: string, label: string): string {
  return `<a href="${README_URL}#${anchor}" target="_blank" rel="noopener" style="color:var(--color-text-secondary);text-decoration:underline">${label}</a>`
}

const selected = ref<Employee[]>([])
const clicked = ref<Employee | null>(null)

type Theme = '' | 'dark' | 'light'
const THEME_CYCLE: Record<Theme, Theme> = { '': 'dark', dark: 'light', light: '' }
const THEME_LABELS: Record<Theme, string> = { '': 'Auto', dark: 'Dark', light: 'Light' }
const theme = ref<Theme>('')
function cycleTheme() {
  theme.value = THEME_CYCLE[theme.value]
  if (theme.value) {
    document.documentElement.dataset.theme = theme.value
  } else {
    delete document.documentElement.dataset.theme
  }
}

// Highlights the nav link for whichever section the user has scrolled to: on every scroll,
// finds the last heading (in document order) that's scrolled up to or past a line just below
// the sticky nav — measuring actual position directly (rather than watching for
// IntersectionObserver enter/exit events) avoids both getting stuck between headings on a wide
// observed band and missing a heading entirely on a fast scroll/jump past a narrow one.
const activeSection = ref(SECTIONS[0].id)

function updateActiveSection() {
  // At the bottom of the page, the last section's heading may never reach the threshold
  // line if its content is shorter than the remaining viewport — force it active instead.
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  if (atBottom) {
    activeSection.value = SECTIONS[SECTIONS.length - 1].id
    return
  }
  let active = SECTIONS[0].id
  for (const s of SECTIONS) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top <= NAV_OFFSET + SCROLLSPY_TOLERANCE) active = s.id
  }
  activeSection.value = active
}

onMounted(() => {
  updateActiveSection()
  window.addEventListener('scroll', updateActiveSection, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateActiveSection)
})

// Headless section: useTableState owns the sort/filter logic; you own the render.
// usePersistedView/useUrlView are opt-in helpers — the sort below survives a reload
// (localStorage) and round-trips through "Copy share link" (URL query param).
const table = useTableState(SAMPLE_DATA, COLUMNS)
const { processedData, getSortIcon, toggleSort } = table
usePersistedView(table, 'data-table-demo-view')
useUrlView(table)

// Same built-in look as <DataTable>, but the caller owns useTableState — so
// usePersistedView/useUrlView can reach it, unlike <DataTable> which builds its own
// internal, unreachable state. Try reordering or hiding columns, then reload the page.
const persistedTable = useTableState(SAMPLE_DATA, COLUMNS, () => ({
  defaultVisibleColumns: PERSISTED_VISIBLE,
  defaultPageSize: 5,
  labels: currentLocale.value,
}))
usePersistedView(persistedTable, 'data-table-demo-persisted-view')
useUrlView(persistedTable, { paramName: 'pview' })

const SORT_COLS = ['name', 'salary', 'score'] as const

function fmtSalary(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const copied = ref(false)
function copyShareLink() {
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div style="max-width: 1100px; margin: 0 auto; padding: 32px 24px">
    <!-- Header with locale + theme switcher -->
    <div
      style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px"
    >
      <h1 style="font-size: 20px; font-weight: 600; margin: 0">DataTable — Vue</h1>
      <div style="display: flex; gap: 4px; align-items: center">
        <div id="i18n" style="display: flex; gap: 4px">
          <button
            v-for="key in Object.keys(LOCALES)"
            :key="key"
            @click="localeKey = key"
            :style="{
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid var(--color-border-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: localeKey === key ? '600' : '400',
              background:
                localeKey === key
                  ? 'var(--color-background-secondary)'
                  : 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
            }"
          >
            {{ key }}
          </button>
        </div>
        <div
          style="width: 1px; height: 16px; background: var(--color-border-secondary); margin: 0 2px"
        />
        <div id="theming">
          <button
            @click="cycleTheme"
            :style="{
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid var(--color-border-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'inherit',
            }"
          >
            {{ THEME_LABELS[theme] }}
          </button>
        </div>
      </div>
    </div>
    <p
      style="
        font-size: 14px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 16px;
      "
    >
      @vates/data-table-vue
    </p>

    <nav
      style="
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        padding: 8px 0;
        margin-bottom: 8px;
        background: var(--color-background-primary);
        border-bottom: 0.5px solid var(--color-border-tertiary);
      "
    >
      <a
        v-for="s in SECTIONS"
        :key="s.id"
        :href="`#${s.id}`"
        :style="{
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: activeSection === s.id ? '600' : '400',
          color:
            activeSection === s.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          background: activeSection === s.id ? 'var(--color-background-secondary)' : 'transparent',
          textDecoration: 'none',
        }"
      >
        {{ s.label }}
      </a>
    </nav>

    <h2
      id="full-table"
      style="
        font-size: 16px;
        font-weight: 600;
        margin-top: 24px;
        margin-bottom: 4px;
        scroll-margin-top: 56px;
      "
    >
      Full-featured table
    </h2>
    <p
      style="font-size: 14px; color: var(--color-text-secondary); margin-top: 0; margin-bottom: 4px"
    >
      Every feature together: sort, filter, group, aggregate, column reordering, i18n, dark mode.
      Try dragging a column header, or grouping by Department.
    </p>
    <p
      style="
        font-size: 12px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 16px;
      "
    >
      📖
      <span v-html="docLink('column-reordering', 'Column reordering')" />
      ·
      <span v-html="docLink('multi-value-array-columns', 'Multi-value columns')" />
      ·
      <span v-html="docLink('computed-columns', 'Computed columns')" />
      ·
      <span v-html="docLink('custom-rendering', 'Custom rendering')" />
      ·
      <span v-html="docLink('aggregation', 'Aggregation')" />
    </p>
    <DataTable
      :data="SAMPLE_DATA"
      :columns="COLUMNS"
      row-key="id"
      :labels="currentLocale"
      :default-visible-columns="DEFAULT_VISIBLE"
      :default-page-size="5"
    >
      <!-- Custom cell rendering via named slots -->
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #cell-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
      <template #cell-score="{ value }">
        <ScoreBar :value="Number(value)" />
      </template>

      <!-- Custom filter labels -->
      <template #filter-department="{ value }">
        <Badge :value="value" :color-map="DEPT_COLORS" />
      </template>
      <template #filter-status="{ value }">
        <Badge :value="value" :color-map="STATUS_COLORS" />
      </template>

      <!-- Custom group header values -->
      <template #group-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #group-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
    </DataTable>

    <!-- Row selection section -->
    <h2
      id="row-selection"
      style="
        font-size: 16px;
        font-weight: 600;
        margin-top: 40px;
        margin-bottom: 4px;
        scroll-margin-top: 56px;
      "
    >
      Row selection
    </h2>
    <p
      :style="{
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
        marginTop: 0,
        marginBottom: selected.length > 0 ? '8px' : '16px',
      }"
    >
      Pass <code>selectable</code> to show checkboxes; listen to <code>@selection-change</code> for
      the updated rows array. Shift-click a checkbox to select (or deselect) the whole range since
      the last-clicked row. Click a row then use ↑/↓/Home/End to move focus (↑/↓ cross page
      boundaries; <kbd>Ctrl</kbd>+Home/End jump to the true first/last row across all pages),
      <kbd>Space</kbd> to select, and Shift+↑/↓/Home/End to extend the range from the keyboard.
      <span v-html="docLink('row-selection', '📖 Docs')" />
    </p>
    <div
      v-if="selected.length > 0"
      style="
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        margin-bottom: 12px;
        background: var(--color-background-info);
        border: 0.5px solid var(--color-border-info);
        border-radius: 6px;
        font-size: 13px;
      "
    >
      <span style="color: var(--color-text-info); font-weight: 500; white-space: nowrap">
        {{ selected.length }} selected
      </span>
      <span
        style="
          color: var(--color-text-secondary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        "
      >
        {{ selected.map((r) => r.name).join(', ') }}
      </span>
      <button
        style="
          padding: 3px 10px;
          border-radius: 4px;
          border: 0.5px solid var(--color-border-info);
          background: transparent;
          color: var(--color-text-info);
          cursor: pointer;
          font-size: 13px;
        "
      >
        Export
      </button>
    </div>
    <DataTable
      :data="SAMPLE_DATA"
      :columns="COLUMNS"
      row-key="id"
      :labels="currentLocale"
      :default-visible-columns="SELECTION_VISIBLE"
      :default-page-size="5"
      :selectable="true"
      @selection-change="selected = $event"
    >
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #filter-department="{ value }">
        <Badge :value="value" :color-map="DEPT_COLORS" />
      </template>
    </DataTable>

    <!-- Row click section -->
    <h2
      id="row-click"
      style="
        font-size: 16px;
        font-weight: 600;
        margin-top: 40px;
        margin-bottom: 4px;
        scroll-margin-top: 56px;
      "
    >
      Row click
    </h2>
    <p
      style="font-size: 14px; color: var(--color-text-secondary); margin-top: 0; margin-bottom: 8px"
    >
      Listen to <code>@row-click</code> to react to a row being clicked — it receives the full row
      object, no key lookup needed. Also fires on <kbd>Enter</kbd> while a row has keyboard focus.
      <span v-html="docLink('row-click', '📖 Docs')" />
    </p>
    <div
      v-if="clicked"
      style="
        padding: 8px 12px;
        margin-bottom: 12px;
        background: var(--color-background-info);
        border: 0.5px solid var(--color-border-info);
        border-radius: 6px;
        font-size: 13px;
        color: var(--color-text-info);
      "
    >
      Last clicked: {{ clicked.name }} ({{ clicked.role }})
    </div>
    <DataTable
      :data="SAMPLE_DATA"
      :columns="COLUMNS"
      row-key="id"
      :labels="currentLocale"
      :default-visible-columns="CLICK_VISIBLE"
      :default-page-size="5"
      @row-click="clicked = $event"
    >
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
    </DataTable>

    <!-- Headless section -->
    <h2
      id="custom-layout"
      style="
        font-size: 16px;
        font-weight: 600;
        margin-top: 40px;
        margin-bottom: 4px;
        scroll-margin-top: 56px;
      "
    >
      Custom layout via useTableState
    </h2>
    <p
      style="
        font-size: 14px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 16px;
      "
    >
      Same data and sort logic — your own render. Sort here persists across reloads
      (<code>usePersistedView</code>) and is reflected in the URL (<code>useUrlView</code>) — reload
      the page or use "Copy share link" and open it in a new tab.
    </p>

    <!-- Sort controls -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center">
      <button
        v-for="col in SORT_COLS"
        :key="col"
        @click="toggleSort(col)"
        style="
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--color-border-secondary);
          cursor: pointer;
          background: var(--color-background-primary);
          color: var(--color-text-primary);
          font-size: 13px;
          font-family: inherit;
        "
      >
        {{ col.charAt(0).toUpperCase() + col.slice(1) }} {{ getSortIcon(col) }}
      </button>
      <button
        @click="copyShareLink"
        style="
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--color-border-secondary);
          cursor: pointer;
          background: var(--color-background-primary);
          color: var(--color-text-secondary);
          font-size: 13px;
          font-family: inherit;
          margin-left: auto;
        "
      >
        {{ copied ? 'Copied!' : 'Copy share link' }}
      </button>
    </div>

    <!-- Card grid -->
    <div
      style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px"
    >
      <div
        v-for="row in processedData"
        :key="row.id"
        style="
          border: 1px solid var(--color-border-tertiary);
          border-radius: 8px;
          padding: 12px 14px;
        "
      >
        <div style="font-weight: 600; margin-bottom: 2px">{{ row.name }}</div>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px">
          {{ row.department }} · {{ row.role }}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 13px">{{ fmtSalary(row.salary) }}</span>
          <ScoreBar :value="row.score" />
        </div>
      </div>
    </div>

    <h2
      id="persisted-table"
      style="
        font-size: 16px;
        font-weight: 600;
        margin-top: 40px;
        margin-bottom: 4px;
        scroll-margin-top: 56px;
      "
    >
      Persisted table via DataTableView
    </h2>
    <p
      style="
        font-size: 14px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 16px;
      "
    >
      <code>DataTable</code> builds its own <code>useTableState</code> internally, so persistence
      helpers can't reach it. <code>DataTableView</code> renders the same built-in UI from a
      <code>useTableState</code> instance you own instead — reorder or hide a column, then reload
      the page. <span v-html="docLink('view-persistence--sharing', '📖 Docs')" />
    </p>
    <DataTableView :table="persistedTable" :data="SAMPLE_DATA" :columns="COLUMNS" row-key="id">
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #cell-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
      <template #cell-score="{ value }">
        <ScoreBar :value="Number(value)" />
      </template>
    </DataTableView>
  </div>
</template>
