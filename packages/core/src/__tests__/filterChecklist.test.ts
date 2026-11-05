import { describe, it, expect } from 'vitest'
import {
  checklistBulkState,
  checklistNavIndex,
  checklistValues,
  clickChecklistValue,
  clickDateTreeNode,
  toggleChecklistExclude,
  exclusionChip,
  exclusionValueKeys,
  exclusionValues,
  isExcludeOnlyColumn,
  toggleChecklistValues,
  type ChecklistFilterActions,
} from '../filterChecklist'
import type { DateTreeNode } from '../types'

function recorder() {
  const calls: unknown[][] = []
  const rec =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push([name, ...args])
  const filter: ChecklistFilterActions = {
    toggleAll: rec('toggleAll'),
    setValues: rec('setValues'),
    clearExcludeValues: rec('clearExcludeValues'),
    setExcludeValues: rec('setExcludeValues'),
    toggleExcludeAll: rec('toggleExcludeAll'),
  }
  return { filter, calls }
}

const VALUES = ['a', 'b', 'c', 'd']

describe('checklistBulkState', () => {
  it('is checked when nothing is excluded, for an exclude-only column', () => {
    expect(checklistBulkState(VALUES, new Set(), true)).toEqual({
      checked: true,
      indeterminate: false,
    })
    expect(checklistBulkState(VALUES, new Set(['b']), true)).toEqual({
      checked: false,
      indeterminate: true,
    })
  })

  it('is checked when everything is included, otherwise', () => {
    expect(checklistBulkState(VALUES, undefined, false)).toEqual({
      checked: false,
      indeterminate: false,
    })
    expect(checklistBulkState(VALUES, new Set(VALUES), false)).toEqual({
      checked: true,
      indeterminate: false,
    })
  })
})

describe('toggleChecklistValues', () => {
  it('toggles exclusions or inclusions, and ignores an empty list', () => {
    const { filter, calls } = recorder()
    toggleChecklistValues(filter, 'k', ['a'], true)
    toggleChecklistValues(filter, 'k', ['a'], false)
    toggleChecklistValues(filter, 'k', [], false)
    expect(calls).toEqual([
      ['toggleExcludeAll', 'k', ['a']],
      ['toggleAll', 'k', ['a']],
    ])
  })
})

describe('clickChecklistValue', () => {
  const ctx = { anchor: 'a', values: VALUES, include: undefined, exclude: undefined }

  it('flips a value, or a shift-range in its direction, for an exclude-only column', () => {
    const { filter, calls } = recorder()
    clickChecklistValue(filter, 'k', 'c', false, { ...ctx, excludeOnly: true })
    clickChecklistValue(filter, 'k', 'c', true, {
      ...ctx,
      exclude: new Set(['c']),
      excludeOnly: true,
    })
    expect(calls).toEqual([
      ['setExcludeValues', 'k', ['c'], true],
      ['setExcludeValues', 'k', ['a', 'b', 'c'], false],
    ])
  })

  it('includes a value, or a shift-range, clearing its exclusions', () => {
    const { filter, calls } = recorder()
    clickChecklistValue(filter, 'k', 'c', false, {
      ...ctx,
      exclude: new Set(['c']),
      excludeOnly: false,
    })
    clickChecklistValue(filter, 'k', 'c', true, { ...ctx, excludeOnly: false })
    expect(calls).toEqual([
      ['setValues', 'k', ['c'], true],
      ['clearExcludeValues', 'k', ['c']],
      ['setValues', 'k', ['a', 'b', 'c'], true],
      ['clearExcludeValues', 'k', ['a', 'b', 'c']],
    ])
  })

  it('un-includes an included value on a plain click', () => {
    const { filter, calls } = recorder()
    clickChecklistValue(filter, 'k', 'c', false, {
      ...ctx,
      include: new Set(['c']),
      excludeOnly: false,
    })
    expect(calls).toEqual([['setValues', 'k', ['c'], false]])
  })

  it('un-includes a shift-range from an included value without touching exclusions', () => {
    const { filter, calls } = recorder()
    clickChecklistValue(filter, 'k', 'c', true, {
      ...ctx,
      include: new Set(['c']),
      excludeOnly: false,
    })
    expect(calls).toEqual([['setValues', 'k', ['a', 'b', 'c'], false]])
  })
})

describe('toggleChecklistExclude', () => {
  it('excludes a value, dropping its inclusion, or clears its exclusion', () => {
    const { filter, calls } = recorder()
    toggleChecklistExclude(filter, 'k', 'c', undefined)
    toggleChecklistExclude(filter, 'k', 'c', new Set(['c']))
    expect(calls).toEqual([
      ['setExcludeValues', 'k', ['c'], true],
      ['setValues', 'k', ['c'], false],
      ['setExcludeValues', 'k', ['c'], false],
    ])
  })
})

describe('clickDateTreeNode', () => {
  const day = (path: string): DateTreeNode => ({ key: path, path, values: [path], children: [] })
  const tree = [day('2024-01-01'), day('2024-01-02'), day('2024-01-03')]
  const values = ['2024-01-01', '2024-01-02', '2024-01-03']

  it('toggles the node without shift or anchor', () => {
    const { filter, calls } = recorder()
    clickDateTreeNode(filter, 'k', tree[1], true, {
      anchorPath: null,
      tree,
      values,
      include: undefined,
    })
    expect(calls).toEqual([['toggleAll', 'k', ['2024-01-02']]])
  })

  it('includes the range from the anchor node on shift', () => {
    const { filter, calls } = recorder()
    clickDateTreeNode(filter, 'k', tree[2], true, {
      anchorPath: '2024-01-01',
      tree,
      values,
      include: undefined,
    })
    expect(calls).toEqual([
      ['setValues', 'k', values, true],
      ['clearExcludeValues', 'k', values],
    ])
  })
})

describe('exclusionChip', () => {
  const ALL = ['Design', 'Engineering', 'HR', 'Product', 'Sales']

  it('names the kept values when fewer are kept than hidden', () => {
    const excluded = new Set(['Design', 'HR', 'Product', 'Sales'])
    expect(exclusionChip(excluded, ALL)).toEqual({
      kept: true,
      values: new Set(['Engineering']),
    })
  })

  it('names the hidden values otherwise', () => {
    const excluded = new Set(['HR'])
    expect(exclusionChip(excluded, ALL)).toEqual({ kept: false, values: excluded })
  })

  it('keeps naming hidden values when nothing is left, or without a value list', () => {
    expect(exclusionChip(new Set(ALL), ALL).kept).toBe(false)
    expect(exclusionChip(new Set(['Design', 'HR', 'Product', 'Sales']), undefined).kept).toBe(false)
  })
})

describe('exclusionValueKeys', () => {
  const rows = [{ dept: 'HR', tags: ['a'], age: 1, note: 'x' }]
  const cols = [
    { key: 'dept', label: 'Dept' },
    { key: 'tags', label: 'Tags' },
    { key: 'age', label: 'Age', type: 'number' as const },
    { key: 'note', label: 'Note', filterable: false },
    { key: 'other', label: 'Other' },
  ]
  const ex = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, new Set(['v'])]))

  it('keeps only filterable exclude-only columns with an active exclusion', () => {
    const exclude = { ...ex('dept', 'tags', 'age', 'note', 'other'), other: new Set<string>() }
    expect(exclusionValueKeys(rows, cols, {}, exclude)).toBe('dept')
  })

  it('skips a column with an include filter, whose checklist uses the include model', () => {
    expect(exclusionValueKeys(rows, cols, { dept: new Set(['HR']) }, ex('dept'))).toBe('')
  })

  it('feeds exclusionValues the value lists of those columns only', () => {
    const keys = exclusionValueKeys(rows, cols, {}, ex('dept', 'other'))
    expect(exclusionValues(rows, cols, keys, '(none)')).toEqual({ dept: ['HR'], other: [''] })
  })
})

describe('isExcludeOnlyColumn', () => {
  it('is true for a plain string column only', () => {
    const data = [{ dept: 'Eng', skills: ['TS'], n: 1 }]
    expect(isExcludeOnlyColumn(data, { key: 'dept', label: 'Dept' }, {})).toBe(true)
    expect(isExcludeOnlyColumn(data, { key: 'skills', label: 'Skills' }, {})).toBe(false)
    expect(isExcludeOnlyColumn(data, { key: 'n', label: 'N', type: 'number' }, {})).toBe(false)
  })

  it('is false while the column has an include filter', () => {
    const data = [{ dept: 'Eng' }]
    const col = { key: 'dept', label: 'Dept' }
    expect(isExcludeOnlyColumn(data, col, { dept: new Set(['Eng']) })).toBe(false)
    expect(isExcludeOnlyColumn(data, col, { dept: new Set() })).toBe(true)
  })
})

describe('checklistNavIndex', () => {
  const values = ['a', 'b', 'c']

  it('steps ↑/↓ from the focused value, staying put (out of range) past the last', () => {
    expect(checklistNavIndex('ArrowDown', values, 'a')).toBe(1)
    expect(checklistNavIndex('ArrowUp', values, 'c')).toBe(1)
    expect(checklistNavIndex('ArrowDown', values, 'c')).toBe(3)
  })

  it('Home/End reach the logical first/last value from anywhere', () => {
    expect(checklistNavIndex('Home', values, 'c')).toBe(0)
    expect(checklistNavIndex('End', values, undefined)).toBe(2)
  })

  it('leaves ↑ off the first value, the search box and other keys to DOM-order nav', () => {
    expect(checklistNavIndex('ArrowUp', values, 'a')).toBeNull()
    expect(checklistNavIndex('ArrowDown', values, undefined)).toBeNull()
    expect(checklistNavIndex('Enter', values, 'a')).toBeNull()
  })
})

describe('checklistValues', () => {
  const col = { key: 'f', label: 'F' }
  const counts = new Map([
    ['apple', 2],
    ['banana', 0],
    ['cherry', 5],
  ])
  const all = ['banana', 'cherry', 'apple']
  const sort = { by: 'alpha', dir: 'asc' } as const

  it('drops 0-count values unless touched, then sorts', () => {
    expect(checklistValues(col, all, counts, undefined, undefined, '', sort)).toEqual([
      ['apple', 'cherry'],
      [],
    ])
    expect(checklistValues(col, all, counts, new Set(['banana']), undefined, '', sort)[0]).toEqual([
      'apple',
      'banana',
      'cherry',
    ])
  })

  it('lists what the value search hides as others', () => {
    expect(checklistValues(col, all, counts, undefined, undefined, 'ch', sort)).toEqual([
      ['cherry'],
      ['apple'],
    ])
  })

  it('narrows a date column by its range', () => {
    const dates = ['2024-01-01', '2024-06-01']
    const dateCounts = new Map(dates.map((d) => [d, 1]))
    const range = { min: '2024-03-01', max: '' }
    const dateCol = { key: 'd', label: 'D', type: 'date' as const }
    expect(checklistValues(dateCol, dates, dateCounts, undefined, range, '', sort)[0]).toEqual([
      '2024-06-01',
    ])
  })
})
