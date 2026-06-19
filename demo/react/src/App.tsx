import { useState } from 'react'
import {
  DataTable, Badge, ScoreBar, useTableState,
  LABELS_EN, LABELS_FR, LABELS_DE, LABELS_ES, LABELS_PT,
  type ColumnDef, type DataTableLabels,
} from '@vates/flexi-table-react'

interface Employee {
  id: number; name: string; department: string; role: string
  salary: number; joined: string; status: string; score: number
}

const SAMPLE_DATA: Employee[] = [
  { id: 1, name: 'Alice Martin', department: 'Engineering', role: 'Senior Dev', salary: 92000, joined: '2019-03-15', status: 'Active', score: 94 },
  { id: 2, name: 'Bob Chen', department: 'Product', role: 'PM', salary: 85000, joined: '2020-07-01', status: 'Active', score: 87 },
  { id: 3, name: 'Clara Dubois', department: 'Engineering', role: 'Lead Dev', salary: 105000, joined: '2017-11-20', status: 'Active', score: 98 },
  { id: 4, name: 'David Kim', department: 'Design', role: 'UX Designer', salary: 78000, joined: '2021-01-10', status: 'Active', score: 82 },
  { id: 5, name: 'Eva Müller', department: 'Engineering', role: 'Junior Dev', salary: 62000, joined: '2023-04-05', status: 'Active', score: 73 },
  { id: 6, name: 'Frank Rossi', department: 'Sales', role: 'Account Exec', salary: 71000, joined: '2020-09-12', status: 'Inactive', score: 65 },
  { id: 7, name: 'Grace Liu', department: 'Product', role: 'Designer', salary: 74000, joined: '2021-06-28', status: 'Active', score: 89 },
  { id: 8, name: 'Hiro Tanaka', department: 'Engineering', role: 'DevOps', salary: 88000, joined: '2018-02-14', status: 'Active', score: 91 },
  { id: 9, name: 'Isabelle Roy', department: 'HR', role: 'HR Manager', salary: 67000, joined: '2019-08-22', status: 'Active', score: 79 },
  { id: 10, name: "James O'Brien", department: 'Sales', role: 'Sales Lead', salary: 82000, joined: '2018-05-03', status: 'Active', score: 84 },
  { id: 11, name: 'Karin Svensson', department: 'Design', role: 'Lead Designer', salary: 86000, joined: '2019-12-01', status: 'Active', score: 92 },
  { id: 12, name: 'Leo Petit', department: 'Engineering', role: 'Architect', salary: 118000, joined: '2016-06-17', status: 'Active', score: 97 },
  { id: 13, name: 'Mia Nakamura', department: 'HR', role: 'Recruiter', salary: 58000, joined: '2022-03-08', status: 'Active', score: 76 },
  { id: 14, name: 'Noel Ferreira', department: 'Sales', role: 'Account Exec', salary: 68000, joined: '2021-10-15', status: 'Inactive', score: 61 },
  { id: 15, name: 'Olivia Smith', department: 'Product', role: 'CPO', salary: 145000, joined: '2015-01-20', status: 'Active', score: 99 },
  { id: 16, name: 'Paul Werner', department: 'Engineering', role: 'Senior Dev', salary: 96000, joined: '2018-09-30', status: 'Active', score: 88 },
  { id: 17, name: 'Qi Zhang', department: 'Design', role: 'UX Researcher', salary: 76000, joined: '2020-11-11', status: 'Active', score: 85 },
  { id: 18, name: 'Rosa García', department: 'HR', role: 'HR Director', salary: 95000, joined: '2016-04-25', status: 'Active', score: 93 },
  { id: 19, name: 'Sam Patel', department: 'Engineering', role: 'CTO', salary: 180000, joined: '2014-08-01', status: 'Active', score: 100 },
  { id: 20, name: 'Tanya Volkov', department: 'Sales', role: 'VP Sales', salary: 135000, joined: '2015-07-14', status: 'Active', score: 96 },
]

const DEPT_COLORS = {
  Engineering: { bg: '#EAF3DE', color: '#3B6D11' }, Product: { bg: '#E6F1FB', color: '#185FA5' },
  Design: { bg: '#FBEAF0', color: '#993556' }, Sales: { bg: '#FAEEDA', color: '#854F0B' },
  HR: { bg: '#EEEDFE', color: '#534AB7' },
}
const STATUS_COLORS = {
  Active: { bg: '#EAF3DE', color: '#3B6D11' }, Inactive: { bg: '#FCEBEB', color: '#A32D2D' },
}

const COLUMNS: ColumnDef<Employee>[] = [
  // sortable: false + filterable: false — no sort/filter UI; hidden by default via defaultVisibleColumns
  { key: 'id', label: 'ID', type: 'number', width: 60, sortable: false, filterable: false },
  { key: 'name', label: 'Name', type: 'string', width: 160 },
  // groupable + render: JSX cell; renderFilterLabel: custom chip in filter dropdown
  { key: 'department', label: 'Department', type: 'string', width: 130, groupable: true,
    render: v => <Badge value={String(v)} colorMap={DEPT_COLORS} />,
    renderFilterLabel: v => <Badge value={v} colorMap={DEPT_COLORS} /> },
  { key: 'role', label: 'Role', type: 'string', width: 140, groupable: true },
  // format: plain string — use this when no JSX is needed; numeric range filter is automatic
  { key: 'salary', label: 'Salary', type: 'number', width: 110,
    format: v => Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) },
  // filterable: false — no filter UI for this column
  { key: 'joined', label: 'Joined', type: 'date', width: 100, filterable: false },
  // render + renderFilterLabel — badge consistent in cells and filter dropdown
  { key: 'status', label: 'Status', type: 'string', width: 90, groupable: true,
    render: v => <Badge value={String(v)} colorMap={STATUS_COLORS} />,
    renderFilterLabel: v => <Badge value={v} colorMap={STATUS_COLORS} /> },
  // render returns JSX — use render (not format) when the cell isn't plain text
  { key: 'score', label: 'Score', type: 'number', width: 80,
    render: v => <ScoreBar value={Number(v)} /> },
]

// 'id' is hidden by default; users can toggle it back from the Columns menu
const DEFAULT_VISIBLE = ['name', 'department', 'role', 'salary', 'joined', 'status', 'score']

const LOCALES: Record<string, DataTableLabels> = {
  EN: LABELS_EN, FR: LABELS_FR, DE: LABELS_DE, ES: LABELS_ES, PT: LABELS_PT,
}

function fmtSalary(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Headless section: useTableState owns the sort/filter logic; you own the render.
function EmployeeCards() {
  const { processedData, getSortIcon, toggleSort } = useTableState(SAMPLE_DATA, COLUMNS)
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['name', 'salary', 'score'] as const).map(col => (
          <button key={col} onClick={() => toggleSort(col)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', background: 'white', fontSize: 13 }}>
            {col.charAt(0).toUpperCase() + col.slice(1)} {getSortIcon(col)}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {processedData.map(row => (
          <div key={row.id} style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{row.name}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{row.department} · {row.role}</div>
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

export default function App() {
  const [localeKey, setLocaleKey] = useState('EN')
  const [selected, setSelected] = useState<Employee[]>([])
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>FlexiTable — React</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.keys(LOCALES).map(key => (
            <button key={key} onClick={() => setLocaleKey(key)}
              style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13,
                fontWeight: localeKey === key ? 600 : 400,
                background: localeKey === key ? '#f0f0f0' : 'white' }}>
              {key}
            </button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 24 }}>
        @vates/flexi-table-react
      </p>
      <DataTable
        data={SAMPLE_DATA}
        columns={COLUMNS}
        rowKey="id"
        labels={LOCALES[localeKey]}
        defaultVisibleColumns={DEFAULT_VISIBLE}
        defaultPageSize={5}
      />

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 40, marginBottom: 4 }}>Row selection</h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: selected.length > 0 ? 8 : 16 }}>
        Pass <code>selectable</code> to show checkboxes; <code>onSelectionChange</code> receives the updated array of selected rows.
      </p>
      {selected.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 12,
          background: 'var(--color-background-info)', border: '0.5px solid var(--color-border-info)',
          borderRadius: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--color-text-info)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {selected.length} selected
          </span>
          <span style={{ color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.map(r => r.name).join(', ')}
          </span>
          <button style={{ padding: '3px 10px', borderRadius: 4, border: '0.5px solid var(--color-border-info)',
            background: 'transparent', color: 'var(--color-text-info)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Export
          </button>
        </div>
      )}
      <DataTable
        data={SAMPLE_DATA}
        columns={COLUMNS}
        rowKey="id"
        defaultVisibleColumns={DEFAULT_VISIBLE}
        defaultPageSize={5}
        selectable
        onSelectionChange={setSelected}
      />

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 40, marginBottom: 4 }}>
        Custom layout via useTableState
      </h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 16 }}>
        Same data and sort logic — your own render.
      </p>
      <EmployeeCards />
    </div>
  )
}
