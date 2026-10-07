import { describe, it, expect } from 'vitest'
import {
  checklistBulkState,
  clickChecklistValue,
  clickDateTreeNode,
  toggleChecklistExclude,
  exclusionChip,
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
    expect(exclusionChip(excluded, ALL, true)).toEqual({
      kept: true,
      values: new Set(['Engineering']),
    })
  })

  it('names the hidden values otherwise', () => {
    const excluded = new Set(['HR'])
    expect(exclusionChip(excluded, ALL, true)).toEqual({ kept: false, values: excluded })
  })

  it('keeps naming hidden values when nothing is left, or on a multi-value column', () => {
    expect(exclusionChip(new Set(ALL), ALL, true).kept).toBe(false)
    expect(exclusionChip(new Set(['Design', 'HR', 'Product', 'Sales']), ALL, false).kept).toBe(
      false,
    )
  })
})

describe('isExcludeOnlyColumn', () => {
  it('is true for a plain string column only', () => {
    const data = [{ dept: 'Eng', skills: ['TS'], n: 1 }]
    expect(isExcludeOnlyColumn(data, { key: 'dept', label: 'Dept' })).toBe(true)
    expect(isExcludeOnlyColumn(data, { key: 'skills', label: 'Skills' })).toBe(false)
    expect(isExcludeOnlyColumn(data, { key: 'n', label: 'N', type: 'number' })).toBe(false)
  })
})
