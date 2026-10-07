import { DataTable, LABELS_FR, type DataTableProps } from '@vates/data-table-vue'
import { renderThemeCss } from '@vates/data-table-vue/theme'

type Row = { id: number; name: string }

export const props: DataTableProps<Row> = {
  data: [],
  columns: [{ key: 'name', label: 'Name' }],
  labels: LABELS_FR,
}
// @ts-expect-error columns must be typed, not `any`
export const bad: DataTableProps<Row> = { data: [], columns: 'name' }
export const component: unknown = DataTable
export const css: string = renderThemeCss()
