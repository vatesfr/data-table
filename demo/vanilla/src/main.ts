import {
  createFlexiTable,
  LABELS_EN,
  LABELS_FR,
  LABELS_DE,
  LABELS_ES,
  LABELS_PT,
  type ColumnDef,
  type DataTableLabels,
} from '@vates/flexi-table-vanilla'

interface Employee {
  id: number
  name: string
  department: string
  role: string
  salary: number
  joined: string
  status: string
  score: number
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
  { key: 'joined', label: 'Joined', type: 'date', width: 100, filterable: false },
  { key: 'status', label: 'Status', type: 'string', width: 90, groupable: true },
  { key: 'score', label: 'Score', type: 'number', width: 80 },
]

const DEFAULT_VISIBLE = ['name', 'department', 'role', 'salary', 'joined', 'status', 'score']

const LOCALES: Record<string, DataTableLabels> = {
  EN: LABELS_EN,
  FR: LABELS_FR,
  DE: LABELS_DE,
  ES: LABELS_ES,
  PT: LABELS_PT,
}

// ---- Page scaffold ----

const app = document.getElementById('app')!
app.innerHTML = `
  <div style="max-width:1100px;margin:0 auto;padding:32px 24px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h1 style="font-size:20px;font-weight:600;margin:0">FlexiTable — Vanilla</h1>
      <div id="locale-btns" style="display:flex;gap:4px"></div>
    </div>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:24px">
      @vates/flexi-table-vanilla
    </p>
    <div id="table1"></div>

    <h2 style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px">Row selection</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:16px">
      Pass <code>selectable</code> to show checkboxes; <code>onSelectionChange</code> receives the updated array.
    </p>
    <div id="selection-banner" style="display:none;align-items:center;gap:12px;padding:8px 12px;margin-bottom:12px;
      background:var(--color-background-info);border:0.5px solid var(--color-border-info);
      border-radius:6px;font-size:13px"></div>
    <div id="table2"></div>

    <h2 style="font-size:16px;font-weight:600;margin-top:40px;margin-bottom:4px">Dynamic data</h2>
    <p style="font-size:14px;color:var(--color-text-secondary);margin-top:0;margin-bottom:12px">
      Call <code>table.setData()</code> to push new rows at any time.
    </p>
    <button id="add-row-btn" style="padding:5px 12px;border-radius:6px;border:0.5px solid var(--color-border-secondary);
      background:none;cursor:pointer;font-size:13px;font-family:inherit">+ Add random row</button>
    <div id="table3" style="margin-top:12px"></div>
  </div>
`

// ---- Locale switcher ----

let currentLocale = 'EN'
const localeBtns = document.getElementById('locale-btns')!

function renderLocaleBtns() {
  localeBtns.innerHTML = Object.keys(LOCALES)
    .map(
      (key) => `
    <button data-locale="${key}" style="padding:2px 8px;border-radius:4px;border:1px solid #ddd;cursor:pointer;font-size:13px;
      font-weight:${currentLocale === key ? 600 : 400};background:${currentLocale === key ? '#f0f0f0' : 'white'}">
      ${key}
    </button>
  `,
    )
    .join('')
}

renderLocaleBtns()

localeBtns.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-locale]') as HTMLElement | null
  if (!btn) return
  currentLocale = btn.dataset.locale!
  renderLocaleBtns()
  table1.setColumns(COLUMNS) // triggers a re-render with updated locale... but locale is captured at creation
  // Labels are set at creation time; to change locale we recreate the table
  table1.destroy()
  table1 = createFlexiTable(document.getElementById('table1')!, {
    data: SAMPLE_DATA,
    columns: COLUMNS,
    rowKey: 'id',
    defaultVisibleColumns: DEFAULT_VISIBLE,
    defaultPageSize: 5,
    labels: LOCALES[currentLocale],
  })
})

// ---- Table 1: full-featured ----

let table1 = createFlexiTable<Employee>(document.getElementById('table1')!, {
  data: SAMPLE_DATA,
  columns: COLUMNS,
  rowKey: 'id',
  defaultVisibleColumns: DEFAULT_VISIBLE,
  defaultPageSize: 5,
  labels: LOCALES[currentLocale],
})

// ---- Table 2: selectable ----

const banner = document.getElementById('selection-banner')!

createFlexiTable<Employee>(document.getElementById('table2')!, {
  data: SAMPLE_DATA,
  columns: COLUMNS,
  rowKey: 'id',
  defaultVisibleColumns: DEFAULT_VISIBLE,
  defaultPageSize: 5,
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

// ---- Table 3: dynamic data ----

let dynamicData = SAMPLE_DATA.slice(0, 5)
const table3 = createFlexiTable<Employee>(document.getElementById('table3')!, {
  data: dynamicData,
  columns: COLUMNS,
  rowKey: 'id',
  defaultVisibleColumns: DEFAULT_VISIBLE,
})

let nextId = 100
document.getElementById('add-row-btn')!.addEventListener('click', () => {
  const depts = ['Engineering', 'Product', 'Design', 'Sales', 'HR']
  const roles = ['Engineer', 'Manager', 'Designer', 'Analyst', 'Director']
  const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey']
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
    },
  ]
  table3.setData(dynamicData)
})
