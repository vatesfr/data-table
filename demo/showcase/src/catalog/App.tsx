import { createSignal, For, Show } from 'solid-js'
import {
  createTableState,
  DataTableView,
  numericRangeGroup,
  type ColumnDef,
} from '@vates/data-table-solid'
import { Shell } from '../common/Shell'
import { CATEGORIES, makeProducts, PRODUCT_COUNT, type Product } from './data'
import { colorDot, colorLabel, formatDate, price, marginOf, stars, stockPill, thumb } from './parts'
import { ProductPanel } from './ProductPanel'
import source from './App.tsx?raw'

const CATEGORY_NAMES = Object.keys(CATEGORIES)

const COLUMNS: ColumnDef<Product>[] = [
  {
    key: 'name',
    label: 'Product',
    pinned: true,
    width: 240,
    render: (_, p) => (
      <span class="product">
        {thumb(p)}
        <span class="product-name">{p.name}</span>
      </span>
    ),
  },
  { key: 'sku', label: 'SKU', filterable: false },
  { key: 'brand', label: 'Brand', groupable: true },
  {
    key: 'category',
    label: 'Category',
    groupable: true,
    renderFilterLabel: (v) => <span>{`${CATEGORIES[v]?.emoji ?? ''} ${v}`}</span>,
  },
  {
    key: 'price',
    label: 'Price',
    type: 'number',
    format: price,
    groupable: true,
    keepVisibleWhenGrouped: true,
    // Limit: B38 — numericRangeGroup only appends a unit ("50–100 €", never "€50–€100")
    ...numericRangeGroup(50, ' €'),
  },
  {
    key: 'stock',
    label: 'Stock',
    type: 'number',
    rangePresets: [
      { label: 'out of stock', max: 0 },
      { label: 'low', min: 1, max: 10 },
    ],
    render: (_, p) => stockPill(p.stock),
  },
  {
    key: 'rating',
    label: 'Rating',
    type: 'number',
    defaultSortDir: 'desc',
    render: (_, p) => stars(p.rating),
  },
  {
    key: 'colors',
    label: 'Colors',
    multiMode: 'or',
    groupable: true,
    render: (_, p) => <span class="dots">{p.colors.map(colorDot)}</span>,
    renderFilterLabel: colorLabel,
  },
  {
    key: 'added',
    label: 'Added',
    type: 'date',
    defaultSortDir: 'desc',
    format: formatDate,
  },
  {
    key: 'margin',
    label: 'Margin',
    type: 'number',
    value: marginOf,
    format: (v) => `${v as number}%`,
  },
]

const CARD_SORTS = [
  { label: 'Newest', key: 'added', dir: 'desc' },
  { label: 'Price: low to high', key: 'price', dir: 'asc' },
  { label: 'Price: high to low', key: 'price', dir: 'desc' },
  { label: 'Top rated', key: 'rating', dir: 'desc' },
] as const

export function App() {
  const products = makeProducts()
  const table = createTableState(products, COLUMNS, {
    getRowId: (p) => p.sku,
    initialViewState: { sorts: [{ key: 'added', dir: 'desc' }], pageSize: 25 },
  })
  const [view, setView] = createSignal<'table' | 'cards'>('table')
  const [current, setCurrent] = createSignal<Product | null>(null)
  let main!: HTMLDivElement
  let panel!: HTMLElement
  let opener: HTMLElement | undefined

  const open = (p: Product, card?: HTMLElement) => {
    opener = card
    setCurrent(p)
    // Stacked below the list on narrow screens: bring it into view
    if (panel.offsetTop > main.offsetTop)
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // Give focus back to what opened the panel: the card, or the table row
  const close = () => {
    const p = current()!
    setCurrent(null)
    if (opener?.isConnected) opener.focus()
    else table.focus.moveTo(p, { focus: true })
  }

  // Limit: B39 — no API for per-value counts under the current search, so chips show totals
  const totals = Object.fromEntries(
    CATEGORY_NAMES.map((c) => [c, products.filter((p) => p.category === c).length]),
  )

  // The chips pick the categories to show; the table's Filter dropdown ticks the same ones
  const shown = () => table.filter.include().category ?? new Set<string>()
  const allShown = () => shown().size === 0
  const showAll = () => table.filter.clearColumn('category', 'include')
  const toggleCategory = (cat: string) =>
    table.filter.setValues('category', [cat], !shown().has(cat))

  // Filters set from the table's own dropdowns also apply to the cards
  const otherFilters = () => table.filter.activeCount() - (allShown() ? 0 : 1)

  const cardSort = () => {
    const s = table.sort.entries()[0]
    const value = s ? `${s.key}:${s.dir}` : ''
    return CARD_SORTS.some((c) => `${c.key}:${c.dir}` === value) ? value : ''
  }
  const setCardSort = (value: string) => {
    const c = CARD_SORTS.find((c) => `${c.key}:${c.dir}` === value)
    if (c) table.sort.replace(c.key, c.dir)
  }

  return (
    <Shell
      title="Product catalog"
      context="A store back office with 300 products. The page's own search and category chips drive the table; click a product to open its details. Switch to cards for a visual browse of the same results."
      source={source}
    >
      <section class="hero">
        <label class="hero-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search products, SKUs, brands…"
            value={table.search.query()}
            onInput={(e) => table.search.setQuery(e.currentTarget.value)}
          />
        </label>
        <div class="chips" role="group" aria-label="Categories">
          <button class="chip" aria-pressed={allShown()} onClick={showAll}>
            All <span class="chip-count">{PRODUCT_COUNT}</span>
          </button>
          <For each={CATEGORY_NAMES}>
            {(cat) => (
              <button
                class="chip"
                aria-pressed={shown().has(cat)}
                onClick={() => toggleCategory(cat)}
              >
                {CATEGORIES[cat].emoji} {cat} <span class="chip-count">{totals[cat]}</span>
              </button>
            )}
          </For>
        </div>
      </section>

      <div class="bar">
        <span class="result-count">
          {table.processedData().length} of {PRODUCT_COUNT} products
        </span>
        <div class="view-toggle" role="group" aria-label="Layout">
          <button aria-pressed={view() === 'table'} onClick={() => setView('table')}>
            Table
          </button>
          <button aria-pressed={view() === 'cards'} onClick={() => setView('cards')}>
            Cards
          </button>
        </div>
      </div>

      <div
        class="layout"
        classList={{ 'layout--panel': current() != null }}
        // Dropdowns handle their own Escape first
        onKeyDown={(e) => e.key === 'Escape' && !e.defaultPrevented && current() && close()}
      >
        <div class="main" ref={(el) => (main = el)}>
          <Show
            when={view() === 'table'}
            fallback={
              // Limit: B41 — the built-in Sort/Filter toolbar can't render without the table body
              <div class="cards-view">
                <div class="cards-tools">
                  <label>
                    Sort by{' '}
                    <select value={cardSort()} onChange={(e) => setCardSort(e.currentTarget.value)}>
                      <option value="" disabled>
                        Custom (set in table)
                      </option>
                      <For each={CARD_SORTS}>
                        {(s) => <option value={`${s.key}:${s.dir}`}>{s.label}</option>}
                      </For>
                    </select>
                  </label>
                  <Show when={otherFilters() > 0}>
                    <span class="note">+ filters set in the table view</span>
                  </Show>
                </div>
                <ul class="cards">
                  <For each={table.processedData()}>
                    {(p) => (
                      <li>
                        <button
                          class="card"
                          aria-current={current() === p ? 'true' : undefined}
                          onClick={(e) => open(p, e.currentTarget)}
                        >
                          {thumb(p, 'lg')}
                          <span class="card-name">{p.name}</span>
                          <span class="card-brand">{p.brand}</span>
                          <span class="card-row">
                            <strong>{price(p.price)}</strong>
                            {stockPill(p.stock)}
                          </span>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            }
          >
            <div class="table-card">
              <DataTableView
                table={table}
                showSearch={false}
                onRowClick={(p) => open(p)}
                currentRow={current()}
              />
            </div>
          </Show>
        </div>

        <ProductPanel product={current()} onClose={close} ref={(el) => (panel = el)} />
      </div>
    </Shell>
  )
}
