import { createDataTable, LABELS_FR, type DataTableOptions } from '@vates/data-table-vanilla'
import { renderThemeCss } from '@vates/data-table-vanilla/theme'

type Row = { id: number; name: string }

export const options: DataTableOptions<Row> = {
  data: [],
  columns: [{ key: 'name', label: 'Name' }],
  labels: LABELS_FR,
}
// @ts-expect-error columns must be typed, not `any`
export const bad: DataTableOptions<Row> = { data: [], columns: 'name' }
export const create: (container: HTMLElement, options: DataTableOptions<Row>) => unknown =
  createDataTable
export const css: string = renderThemeCss()
