import { createMemo, onCleanup } from 'solid-js'
import {
  bucketDatePart,
  createTableState,
  DataTableView,
  LABELS_FR,
  type ColumnDef,
} from '@vates/data-table-solid'
import { Shell } from '../common/Shell'
import { AS_OF, INTERNAL, makeTransactions, parseFrDate, type Transaction } from './data'
import source from './App.tsx?raw'

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const longDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

function amount(v: number) {
  return (
    <span class={v < 0 ? 'amount amount--neg' : 'amount'}>{euros.format(v)}</span>
  ) as HTMLElement
}

const COLUMNS: ColumnDef<Transaction>[] = [
  {
    key: 'date',
    label: 'Date',
    type: 'date',
    width: 110,
    parseDate: parseFrDate,
    defaultSortDir: 'desc',
    groupable: true,
    // The month is the group; each line still shows its own day
    keepVisibleWhenGrouped: true,
    groupValue: bucketDatePart('month', parseFrDate),
    // Limit: B33 — datePartGroup('month') names months in the browser's locale, not the table's
    groupFormat: (key) => {
      const label = monthYear.format(new Date(`${key}T00:00`))
      return label[0].toUpperCase() + label.slice(1)
    },
  },
  { key: 'libelle', label: 'Libellé', width: 280 },
  // Right after Libellé, so a phone shows amounts without scrolling sideways
  {
    key: 'montant',
    label: 'Montant',
    type: 'number',
    width: 130,
    aggregate: 'sum',
    format: (v) => euros.format(Number(v)),
    render: (v) => amount(Number(v)),
    rangePresets: [
      { label: 'Dépenses', max: 0 },
      { label: 'Recettes', min: 0 },
      { label: 'Plus de 1 000 €', min: 1000 },
    ],
  },
  { key: 'categorie', label: 'Catégorie', groupable: true, width: 150 },
  { key: 'compte', label: 'Compte', groupable: true, width: 150 },
  {
    key: 'pointe',
    label: 'Pointé',
    width: 80,
    groupable: true,
    format: (v) => (v ? 'Oui' : 'Non'),
    render: (v) => (<span class="check">{v ? '✓' : '—'}</span>) as HTMLElement,
  },
]

export function App() {
  const table = createTableState(makeTransactions(), COLUMNS, {
    labels: LABELS_FR,
    defaultGroupsCollapsed: false,
    initialViewState: {
      groupBy: ['date'],
      sorts: [{ key: 'date', dir: 'desc' }],
      // Transfers between one's own accounts cancel out: leave them out of the report by default
      excludeFilters: { categorie: [INTERNAL] },
      pageSize: 100,
    },
  })

  // Totals over everything the search and filters keep, not just this page
  const totals = createMemo(() => {
    let credit = 0
    let debit = 0
    for (const tx of table.processedData())
      if (tx.montant < 0) debit += tx.montant
      else credit += tx.montant
    return { credit, debit, count: table.processedData().length }
  })

  // Paper gets the whole report, not just the page on screen (button or Ctrl+P alike)
  let restore: (() => void) | undefined
  const beforePrint = () => {
    const { page, pageSize, setPage, setPageSize } = table.pagination
    const [prevPage, prevSize] = [page(), pageSize()]
    restore = () => {
      setPageSize(prevSize)
      setPage(prevPage)
    }
    setPageSize(0)
  }
  const afterPrint = () => restore?.()
  window.addEventListener('beforeprint', beforePrint)
  window.addEventListener('afterprint', afterPrint)
  onCleanup(() => {
    window.removeEventListener('beforeprint', beforePrint)
    window.removeEventListener('afterprint', afterPrint)
  })
  const print = () => window.print()

  return (
    <Shell
      title="Grand livre"
      context="Deux ans de relevés bancaires, environ 5 000 écritures sur trois comptes, présentées comme un état imprimable : regroupées par mois avec leur solde, virements internes exclus. Les filtres « Dépenses », « Recettes » et « Plus de 1 000 € » sont sous Montant ; un « — » dans la colonne Pointé signale une écriture pas encore parue sur un relevé."
      source={source}
    >
      <section class="report">
        <header class="report-head">
          <div>
            <p class="report-kicker">État des comptes · arrêté au {longDate.format(AS_OF)}</p>
            <dl class="report-totals">
              <div>
                <dt>Recettes</dt>
                <dd>{amount(totals().credit)}</dd>
              </div>
              <div>
                <dt>Dépenses</dt>
                <dd>{amount(totals().debit)}</dd>
              </div>
              <div>
                <dt>Solde</dt>
                <dd class="report-balance">{amount(totals().credit + totals().debit)}</dd>
              </div>
            </dl>
          </div>
          <p class="report-count">{totals().count.toLocaleString('fr-FR')} écritures retenues</p>
        </header>
        <DataTableView
          table={table}
          rowKey="id"
          toolbarEnd={
            <button class="print" onClick={print}>
              Imprimer
            </button>
          }
        />
      </section>
    </Shell>
  )
}
