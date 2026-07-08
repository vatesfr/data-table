<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  DataTable,
  Badge,
  ScoreBar,
  useTableState,
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
  // filterable: false — no filter UI for this column
  { key: 'joined', label: 'Joined', type: 'date', width: 100, filterable: false },
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
  'status',
  'score',
  'skills',
]

const LOCALES: Record<string, DataTableLabels> = {
  EN: LABELS_EN,
  FR: LABELS_FR,
  DE: LABELS_DE,
  ES: LABELS_ES,
  PT: LABELS_PT,
}

const localeKey = ref('EN')
const currentLocale = computed(() => LOCALES[localeKey.value])

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

// Headless section: useTableState owns the sort/filter logic; you own the render.
const { processedData, getSortIcon, toggleSort } = useTableState(SAMPLE_DATA, COLUMNS)

const SORT_COLS = ['name', 'salary', 'score'] as const

function fmtSalary(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
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
        <div
          style="width: 1px; height: 16px; background: var(--color-border-secondary); margin: 0 2px"
        />
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
    <p
      style="
        font-size: 14px;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 24px;
      "
    >
      @vates/data-table-vue
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
    <h2 style="font-size: 16px; font-weight: 600; margin-top: 40px; margin-bottom: 4px">
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
      the updated rows array.
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
      :default-visible-columns="DEFAULT_VISIBLE"
      :default-page-size="5"
      :selectable="true"
      @selection-change="selected = $event"
    >
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #cell-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
      <template #cell-score="{ value }">
        <ScoreBar :value="Number(value)" />
      </template>
      <template #filter-department="{ value }">
        <Badge :value="value" :color-map="DEPT_COLORS" />
      </template>
      <template #filter-status="{ value }">
        <Badge :value="value" :color-map="STATUS_COLORS" />
      </template>
    </DataTable>

    <!-- Row click section -->
    <h2 style="font-size: 16px; font-weight: 600; margin-top: 40px; margin-bottom: 4px">
      Row click
    </h2>
    <p
      style="font-size: 14px; color: var(--color-text-secondary); margin-top: 0; margin-bottom: 8px"
    >
      Listen to <code>@row-click</code> to react to a row being clicked — it receives the full row
      object, no key lookup needed.
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
      :default-visible-columns="DEFAULT_VISIBLE"
      :default-page-size="5"
      @row-click="clicked = $event"
    >
      <template #cell-department="{ value }">
        <Badge :value="String(value)" :color-map="DEPT_COLORS" />
      </template>
      <template #cell-status="{ value }">
        <Badge :value="String(value)" :color-map="STATUS_COLORS" />
      </template>
      <template #cell-score="{ value }">
        <ScoreBar :value="Number(value)" />
      </template>
    </DataTable>

    <!-- Headless section -->
    <h2 style="font-size: 16px; font-weight: 600; margin-top: 40px; margin-bottom: 4px">
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
      Same data and sort logic — your own render.
    </p>

    <!-- Sort controls -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px">
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
  </div>
</template>
