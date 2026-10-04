import { describe, it, expect, vi } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DataTable } from '../DataTable'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
}

const COLS: ColumnDef<Row>[] = [{ key: 'name', label: 'Name' }]
const ROWS: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.dt-tr[data-proc-idx] .dt-td')].map(
    (td) => td.textContent ?? '',
  )
}

describe('DataTable', () => {
  it('names a row checkbox after the first column with text, skipping a picture column', () => {
    const container = document.createElement('div')
    const cols: ColumnDef<Row>[] = [{ key: 'avatar', label: 'Avatar', value: () => null }, ...COLS]
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={cols} rowKey="id" selectable />, container)
      return d
    })
    const names = [...container.querySelectorAll('input[type="checkbox"]')].map((c) =>
      c.getAttribute('aria-label'),
    )
    expect(names).toContain('Select row Alice')
    dispose()
  })

  it('renders the given columns and rows with no createTableState/DataTableView wiring needed', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={COLS} rowKey="id" />, container)
      return d
    })
    expect(container.querySelector('.dt-th')?.textContent).toContain('Name')
    expect(rowNames(container)).toEqual(['Alice', 'Bob'])
    dispose()
  })

  it('moves focus to the search box when a clear button removes itself', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={COLS} rowKey="id" />, container)
      return d
    })
    const search = container.querySelector<HTMLInputElement>('.dt-search-input')!
    const type = (q: string) => {
      search.value = q
      search.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const clickButton = (name: string) => {
      const btn = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent === name || b.getAttribute('aria-label') === name,
      )!
      btn.focus()
      btn.click()
    }
    for (const name of ['× Clear all', 'Clear search', 'Clear search and filters']) {
      type('zzz')
      clickButton(name)
      expect(document.activeElement).toBe(search)
    }
    dispose()
  })

  it('moves focus to the first toolbar button after Clear all when search is hidden', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cols: ColumnDef<Row>[] = [...COLS, { key: 'id', label: 'Id' }]
    const dispose = createRoot((d) => {
      render(
        () => (
          <DataTable
            data={ROWS}
            columns={cols}
            rowKey="id"
            showSearch={false}
            initialViewState={{ sorts: [{ key: 'name', dir: 'asc' }] }}
          />
        ),
        container,
      )
      return d
    })
    const clearAll = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === '× Clear all',
    )!
    clearAll.focus()
    clearAll.click()
    expect(document.activeElement).toBe(container.querySelector('button'))
    dispose()
  })

  it('names the pagination buttons from the labels', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(
        () => (
          <DataTable data={ROWS} columns={COLS} rowKey="id" initialViewState={{ pageSize: 1 }} />
        ),
        container,
      )
      return d
    })
    const names = [...container.querySelectorAll('.dt-page-btn')].map((b) =>
      b.getAttribute('aria-label'),
    )
    expect(names).toEqual(['First page', 'Previous page', 'Next page', 'Last page'])
    dispose()
  })

  it('tracks reactive data/columns props with no manual sync effect from the consumer', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const [rows, setRows] = createSignal(ROWS)
    const dispose = createRoot((d) => {
      render(() => <DataTable data={rows()} columns={COLS} rowKey="id" />, container)
      return d
    })
    expect(rowNames(container)).toEqual(['Alice', 'Bob'])
    setRows([...ROWS, { id: 3, name: 'Clara' }])
    expect(rowNames(container)).toEqual(['Alice', 'Bob', 'Clara'])
    dispose()
  })

  it('fires onSelectionChange, with no need to hold onto a TableState to observe it', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const onSelectionChange = vi.fn()
    const dispose = createRoot((d) => {
      render(
        () => (
          <DataTable
            data={ROWS}
            columns={COLS}
            rowKey="id"
            selectable
            onSelectionChange={onSelectionChange}
          />
        ),
        container,
      )
      return d
    })
    const checkbox = container.querySelector<HTMLInputElement>(
      '.dt-tr[data-proc-idx] input[type="checkbox"]',
    )!
    checkbox.click()
    expect(onSelectionChange).toHaveBeenCalledWith([ROWS[0]])
    dispose()
  })

  it('hides the Sort toolbar button entirely when every column is sortable: false', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cols: ColumnDef<Row>[] = [{ key: 'name', label: 'Name', sortable: false }]
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={cols} rowKey="id" />, container)
      return d
    })
    const sortBtn = [...container.querySelectorAll('.dt-btn')].find(
      (btn) => btn.textContent === 'Sort',
    )
    expect(sortBtn).toBeUndefined()
    dispose()
  })

  it('hides the Filter toolbar button entirely when every column is filterable: false', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cols: ColumnDef<Row>[] = [{ key: 'name', label: 'Name', filterable: false }]
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={cols} rowKey="id" />, container)
      return d
    })
    const filterBtn = [...container.querySelectorAll('.dt-btn')].find(
      (btn) => btn.textContent === 'Filter',
    )
    expect(filterBtn).toBeUndefined()
    dispose()
  })

  it('hides the Columns toolbar button when showColumns is false', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'id', label: 'Id' },
    ]
    const dispose = createRoot((d) => {
      render(
        () => <DataTable data={ROWS} columns={cols} rowKey="id" showColumns={false} />,
        container,
      )
      return d
    })
    const colsBtn = [...container.querySelectorAll('.dt-btn')].find(
      (btn) => btn.textContent === 'Columns',
    )
    expect(colsBtn).toBeUndefined()
    dispose()
  })

  it('hides the Columns toolbar button entirely when there are fewer than 2 columns', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(() => <DataTable data={ROWS} columns={COLS} rowKey="id" />, container)
      return d
    })
    const colsBtn = [...container.querySelectorAll('.dt-btn')].find(
      (btn) => btn.textContent === 'Columns',
    )
    expect(colsBtn).toBeUndefined()
    dispose()
  })

  it('hides the search box when showSearch is false', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(
        () => <DataTable data={ROWS} columns={COLS} rowKey="id" showSearch={false} />,
        container,
      )
      return d
    })
    expect(container.querySelector('.dt-search-input')).toBeNull()
    dispose()
  })

  it('renders toolbarEnd once, as the last child of the toolbar actions row', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let built = 0
    const shareButton = () => {
      built++
      return <button class="share">Share</button>
    }
    const dispose = createRoot((d) => {
      render(
        () => <DataTable data={ROWS} columns={COLS} rowKey="id" toolbarEnd={shareButton()} />,
        container,
      )
      return d
    })
    const end = container.querySelector('.dt-toolbar-actions > .dt-toolbar-end:last-child')
    expect(end?.querySelectorAll('.share')).toHaveLength(1)
    expect(built).toBe(1)
    dispose()
  })

  it('renders no toolbar-end wrapper when toolbarEnd is absent, and follows a reactive one', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const [show, setShow] = createSignal(false)
    const dispose = createRoot((d) => {
      render(
        () => (
          <DataTable
            data={ROWS}
            columns={COLS}
            rowKey="id"
            toolbarEnd={show() ? <button class="share">Share</button> : undefined}
          />
        ),
        container,
      )
      return d
    })
    expect(container.querySelector('.dt-toolbar-end')).toBeNull()
    setShow(true)
    expect(container.querySelector('.dt-toolbar-end .share')).not.toBeNull()
    setShow(false)
    expect(container.querySelector('.dt-toolbar-end')).toBeNull()
    dispose()
  })
})

describe('DataTable — filter values through the column format', () => {
  interface Item {
    id: number
    code: string
    price: number
  }
  const ITEM_COLS: ColumnDef<Item>[] = [
    { key: 'code', label: 'Code', format: (v) => String(v).toUpperCase() },
    {
      key: 'price',
      label: 'Price',
      type: 'number',
      format: (v) => `$${Number(v).toLocaleString('en-US')}`,
    },
  ]
  const ITEMS: Item[] = [
    { id: 1, code: 'ab', price: 1500 },
    { id: 2, code: 'cd', price: 90000 },
  ]

  it('shows chips and checklist values as the column formats them', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = createRoot((d) => {
      render(
        () => (
          <DataTable
            data={ITEMS}
            columns={ITEM_COLS}
            rowKey="id"
            initialViewState={{
              filters: { code: ['ab'] },
              rangeFilters: { price: { min: '1000', max: '' } },
            }}
          />
        ),
        container,
      )
      return d
    })
    const chips = [...container.querySelectorAll('.dt-chip-body')].map((b) => b.textContent)
    expect(chips).toContain('Code: AB')
    expect(chips).toContain('Price: $1,000–')
    const filterBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Filter',
    )!
    filterBtn.click()
    const codeCol = container.querySelector<HTMLElement>('[data-filter-col-key="code"]')!
    codeCol.click()
    const labels = [...container.querySelectorAll('.dt-filter-list .dt-flex1')].map(
      (s) => s.textContent,
    )
    expect(labels).toEqual(['AB', 'CD'])
    dispose()
    container.remove()
  })

  describe('checklist chip in All mode', () => {
    interface GameRow {
      id: number
      tags: string[]
    }
    const TAG_COLS: ColumnDef<GameRow>[] = [{ key: 'tags', label: 'Tags' }]
    const TAG_ROWS: GameRow[] = [
      { id: 1, tags: ['Action', 'RPG'] },
      { id: 2, tags: ['Action'] },
    ]
    const view = (filterModes?: Record<string, 'and' | 'or'>) => ({
      filters: { tags: ['Action', 'RPG'] },
      filterModes,
    })
    function chipText(filterModes?: Record<string, 'and' | 'or'>): string | undefined {
      const container = document.createElement('div')
      const dispose = createRoot((d) => {
        render(
          () => (
            <DataTable
              data={TAG_ROWS}
              columns={TAG_COLS}
              rowKey="id"
              initialViewState={view(filterModes)}
            />
          ),
          container,
        )
        return d
      })
      const text = [...container.querySelectorAll('.dt-chip-body')]
        .map((b) => b.textContent)
        .find((t) => t?.startsWith('Tags:'))
      dispose()
      return text
    }

    it('joins the values with & in All mode, with a comma in Any mode', () => {
      expect(chipText({ tags: 'and' })).toBe('Tags: Action & RPG')
      expect(chipText()).toBe('Tags: Action, RPG')
    })
  })
})
