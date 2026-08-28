<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  DataTableView,
  useTableState,
  usePersistedView,
  useUrlView,
  resetView,
  usePersistence,
  numericRangeGroup,
  datePartGroup,
  compareMissingLast,
  LABELS_EN,
  LABELS_FR,
  LABELS_DE,
  LABELS_ES,
  LABELS_PT,
  type ColumnDef,
  type DataTableLabels,
} from '@vates/data-table-vue'
import Badge from './components/Badge.vue'
import ScoreBar from './components/ScoreBar.vue'
import { HUGE_DATA, HUGE_COLUMNS, HUGE_ROW_COUNT } from './hugeData'
import ViewControls from './ViewControls.vue'

interface Employee {
  id: number
  name: string
  department: string
  role: string
  salary: number | null // null: payroll hasn't been finalized yet — bucketNumericRange/numericRangeGroup group these under their own "(none)" bucket instead of miscounting them as $0 (issue #18)
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
    salary: null, // just joined, payroll not finalized yet
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

const COLUMNS: ColumnDef<Employee>[] = [
  // sortable: false + filterable: false — no sort/filter UI; hidden by default via initialViewState.visibleCols
  { key: 'id', label: 'ID', type: 'number', width: 60, sortable: false, filterable: false },
  { key: 'name', label: 'Name', type: 'string', width: 160 },
  // category: groups this column under a named section in the Columns/Sort/Group dropdowns'
  // column lists (a submenu) and the Filter dropdown's left pane (a collapsible section) — useful
  // once a table has enough columns that a flat list is hard to scan. Department/Role/Salary/
  // Joined are grouped under "Work" below, Score/Tier/Skills under "Performance"; Name/Tenure/
  // Status are left uncategorized and render as plain rows alongside the category entries.
  //
  // groupable: true — slot #cell-department / #filter-department / #group-department override rendering
  {
    key: 'department',
    label: 'Department',
    type: 'string',
    width: 130,
    groupable: true,
    category: 'Work',
    format: (v) => String(v),
  },
  { key: 'role', label: 'Role', type: 'string', width: 140, groupable: true, category: 'Work' },
  // format: plain string — the numeric range filter (2 inputs + a slider) is automatic for
  // type: 'number'
  {
    key: 'salary',
    label: 'Salary',
    type: 'number',
    width: 110,
    format: (v) =>
      v == null
        ? '—'
        : Number(v).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }),
    aggregate: 'sum',
    // groupValue/groupFormat: a continuous column (near-unique per row) grouped by its exact
    // value would create one group per row — bucketing into $20k ranges makes it groupable
    // meaningfully. cell rendering/sort/filter above are untouched, still reading the real salary.
    // numericRangeGroup bundles both from one call instead of passing `20000`/`' USD'` twice
    // (issue #18); a null salary (Eva, just joined) lands in its own "(none)" group instead of
    // being miscounted as $0.
    groupable: true,
    category: 'Work',
    // header shows only the $20k bucket, not the exact salary — keep the column visible
    // when grouped so the real value stays visible on each row.
    keepVisibleWhenGrouped: true,
    ...numericRangeGroup(20000, ' USD'),
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
    category: 'Work',
    // header shows only the year, not the exact join date — keep the column visible when
    // grouped so the real date stays visible on each row.
    keepVisibleWhenGrouped: true,
    ...datePartGroup('year'),
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
  // slot #cell-status / #filter-status / #group-status override rendering
  { key: 'status', label: 'Status', type: 'string', width: 90, groupable: true },
  // slot #cell-score overrides rendering. compareMissingLast() (issue #15) keeps a not-yet-
  // reviewed employee's row last in the Score sort regardless of direction — null naturally
  // sorts first ascending / last descending otherwise, flipping depending on the toggle rather
  // than staying put.
  {
    key: 'score',
    label: 'Score',
    type: 'number',
    width: 80,
    category: 'Performance',
    compare: compareMissingLast(),
  },
  // computed column (value) + compare (issue #15): bucket a continuous score into an ordered
  // enum and sort it by rank, not alphabetically — see TIER_ORDER above, wrapped in
  // compareMissingLast() so a not-yet-reviewed employee's empty tier ('') still sorts last in
  // both directions, same as the Score column above. slot #cell-tier overrides rendering.
  {
    key: 'tier',
    label: 'Tier',
    value: (row) => tierFor(row.score),
    compare: compareMissingLast(
      (a, b) => TIER_ORDER.indexOf(String(a)) - TIER_ORDER.indexOf(String(b)),
    ),
    groupable: true,
    category: 'Performance',
    width: 90,
  },
  // array-valued column: filter checklist lists individual skills, grouping fans a row into
  // one group per skill, and cells join the array with ', ' — all automatic. keepVisibleWhenGrouped
  // keeps the column visible while grouped so a row's other skills stay visible from within any
  // one group's expansion. The checklist is also where exclude filters live: click a value once
  // to include it (only rows with that skill), click again to exclude it (rows with that skill
  // are dropped), click a third time to clear it — try excluding "Leadership" to hide everyone
  // who has it. defaultValueSort: a skill checklist reads better "most common first" than
  // alphabetically — the sort-order toggle still cycles through all 4 states from here, this
  // just picks where it starts. Because Skills is array-valued, its checklist also gets an
  // Any/All match-mode button (next to the sort toggle): "Any" matches a row with at least one
  // selected skill (union, the default), "All" requires every selected skill to be present
  // (intersection) — try selecting "Leadership" + "Mentoring" and toggling to All.
  {
    key: 'skills',
    label: 'Skills',
    width: 180,
    groupable: true,
    category: 'Performance',
    keepVisibleWhenGrouped: true,
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
// initialViewState.visibleCols keeps each section visually distinct instead of repeating the same
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

const localeKey = ref('EN')
const currentLocale = computed(() => LOCALES[localeKey.value])

// Every table on the page persists its own view (sort/filter/group/etc.) independently — each
// gets its own localStorage key and its own URL query param, so the six sections don't clobber
// each other and "Copy share link" round-trips the whole page's state in one URL.
const VIEW_KEYS: Record<string, { storageKey: string; paramName: string }> = {
  full: { storageKey: 'dt-demo-full-table', paramName: 'full' },
  selection: { storageKey: 'dt-demo-row-selection', paramName: 'sel' },
  click: { storageKey: 'dt-demo-row-click', paramName: 'click' },
  custom: { storageKey: 'dt-demo-custom-layout', paramName: 'custom' },
  persisted: { storageKey: 'dt-demo-persisted-table', paramName: 'persisted' },
  huge: { storageKey: 'dt-demo-huge-dataset', paramName: 'huge' },
}

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
const { processedData } = table
const { icon: getSortIcon, toggle: toggleSort } = table.sort
usePersistedView(table, VIEW_KEYS.custom.storageKey)
useUrlView(table, { paramName: VIEW_KEYS.custom.paramName })

// Same built-in look as <DataTable>, but the caller owns useTableState — so
// usePersistedView/useUrlView can reach it, unlike <DataTable> which builds its own
// internal, unreachable state. Try reordering or hiding columns, then reload the page.
//
// Uses usePersistence — the combined localStorage+URL helper — instead of wiring
// usePersistedView/useUrlView/resetView separately (as the other sections do): one
// VIEW_KEYS.persisted object feeds all three, so its storageKey/paramName can't drift out of
// sync between them.
const persistedTable = useTableState(SAMPLE_DATA, COLUMNS, () => ({
  initialViewState: { visibleCols: PERSISTED_VISIBLE, pageSize: 5 },
  labels: currentLocale.value,
}))
const { reset: resetPersistedTable } = usePersistence(persistedTable, VIEW_KEYS.persisted)

// The remaining sections below (full-featured, row-selection, row-click, huge-dataset) are
// wired the same way — useTableState + DataTableView instead of <DataTable> — purely so each
// can also reach usePersistedView/useUrlView/resetView; nothing about their own features changes.
const fullTable = useTableState(SAMPLE_DATA, COLUMNS, () => ({
  initialViewState: { visibleCols: DEFAULT_VISIBLE, pageSize: 5 },
  labels: currentLocale.value,
}))
usePersistedView(fullTable, VIEW_KEYS.full.storageKey)
useUrlView(fullTable, { paramName: VIEW_KEYS.full.paramName })

const selectionTable = useTableState(SAMPLE_DATA, COLUMNS, () => ({
  initialViewState: { visibleCols: SELECTION_VISIBLE, pageSize: 5 },
  labels: currentLocale.value,
}))
usePersistedView(selectionTable, VIEW_KEYS.selection.storageKey)
useUrlView(selectionTable, { paramName: VIEW_KEYS.selection.paramName })

const clickTable = useTableState(SAMPLE_DATA, COLUMNS, () => ({
  initialViewState: { visibleCols: CLICK_VISIBLE, pageSize: 5 },
  labels: currentLocale.value,
}))
usePersistedView(clickTable, VIEW_KEYS.click.storageKey)
useUrlView(clickTable, { paramName: VIEW_KEYS.click.paramName })

// No `labels` option — matches the huge-dataset table's pre-existing behavior of always using
// the default English labels regardless of the page's locale switcher.
const hugeTable = useTableState(HUGE_DATA, HUGE_COLUMNS, () => ({
  initialViewState: { pageSize: 100 },
}))
usePersistedView(hugeTable, VIEW_KEYS.huge.storageKey)
useUrlView(hugeTable, { paramName: VIEW_KEYS.huge.paramName })

const SORT_COLS = ['name', 'salary', 'score'] as const

function fmtSalary(n: number | null) {
  return n == null
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
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
    <p
      style="
        font-size: 13px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 16px;
      "
    >
      Every table below persists its own sort/filter/group/etc. to <code>localStorage</code> and the
      URL (<span v-html="docLink('view-persistence--sharing', '📖 Docs')" />) — reload the page, use
      its "Copy share link" button, or hit "Reset" to clear it back to defaults.
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
      Click a column header to sort by it alone (replacing any other sort); shift-click to add it to
      a multi-column sort instead — or use the Sort dropdown for finer control. Try dragging a
      column header, or grouping by Department — groups start collapsed by default
      (<code>default-groups-collapsed</code>). Salary and Joined group into $20k ranges and years
      instead of one group per row — see <code>groupValue</code>/<code>groupFormat</code>.
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
      ·
      <span v-html="docLink('grouped-columns', 'Bucketed grouping')" />
    </p>
    <ViewControls @reset="resetView(fullTable, VIEW_KEYS.full)" />
    <DataTableView :table="fullTable" :data="SAMPLE_DATA" :columns="COLUMNS" row-key="id">
      <!-- Custom cell rendering via named slots -->
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #cell-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
      <template #cell-score="{ value }">
        <span v-if="value == null" style="font-size: 12px; color: var(--color-text-tertiary)">
          No review yet
        </span>
        <ScoreBar v-else :value="Number(value)" />
      </template>
      <template #cell-tier="{ value }">
        <Badge v-if="value" :value="String(value)" :color-map="TIER_COLORS" />
        <span v-else style="font-size: 12px; color: var(--color-text-tertiary)">—</span>
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
      <template #group-tier="{ value }">
        <Badge v-if="value" :value="String(value)" :color-map="TIER_COLORS" />
        <span v-else style="font-size: 12px; color: var(--color-text-tertiary)">—</span>
      </template>
    </DataTableView>

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
    <ViewControls @reset="resetView(selectionTable, VIEW_KEYS.selection)" />
    <DataTableView
      :table="selectionTable"
      :data="SAMPLE_DATA"
      :columns="COLUMNS"
      row-key="id"
      :selectable="true"
      @selection-change="selected = $event"
    >
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #filter-department="{ value }">
        <Badge :value="value" :color-map="DEPT_COLORS" />
      </template>
    </DataTableView>

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
    <ViewControls @reset="resetView(clickTable, VIEW_KEYS.click)" />
    <DataTableView
      :table="clickTable"
      :data="SAMPLE_DATA"
      :columns="COLUMNS"
      row-key="id"
      @row-click="clicked = $event"
    >
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
    </DataTableView>

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
      <div style="margin-left: auto">
        <ViewControls @reset="resetView(table, VIEW_KEYS.custom)" />
      </div>
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
          <span v-if="row.score == null" style="font-size: 12px; color: var(--color-text-tertiary)">
            No review yet
          </span>
          <ScoreBar v-else :value="row.score" />
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
    <ViewControls @reset="resetPersistedTable" />
    <DataTableView :table="persistedTable" :data="SAMPLE_DATA" :columns="COLUMNS" row-key="id">
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #cell-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
      <template #cell-score="{ value }">
        <span v-if="value == null" style="font-size: 12px; color: var(--color-text-tertiary)">
          No review yet
        </span>
        <ScoreBar v-else :value="Number(value)" />
      </template>
    </DataTableView>

    <!-- Huge dataset section -->
    <h2
      id="huge-dataset"
      style="
        font-size: 16px;
        font-weight: 600;
        margin-top: 40px;
        margin-bottom: 4px;
        scroll-margin-top: 56px;
      "
    >
      Huge dataset
    </h2>
    <p
      style="
        font-size: 14px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 16px;
      "
    >
      A generated e-commerce order history — {{ HUGE_ROW_COUNT.toLocaleString() }} rows across
      thousands of customers — to demonstrate the table staying responsive at scale: sorting,
      filtering, and grouping all run over the full dataset, while only ~100 rows are ever rendered
      per page. The <code>Customer</code> filter has thousands of distinct values, but its checklist
      only ever mounts the rows scrolled into view. Try grouping by <code>Category</code> and/or
      <code>Region</code>.
    </p>
    <ViewControls @reset="resetView(hugeTable, VIEW_KEYS.huge)" />
    <DataTableView :table="hugeTable" :data="HUGE_DATA" :columns="HUGE_COLUMNS" row-key="id" />
  </div>
</template>
