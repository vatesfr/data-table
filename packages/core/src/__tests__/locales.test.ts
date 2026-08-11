import { describe, it, expect } from 'vitest'
import { LABELS_EN, LABELS_FR, LABELS_ES, LABELS_DE, LABELS_PT } from '../locales'

describe('LABELS_EN', () => {
  describe('rowCount', () => {
    it('uses !== 1: 0 total is plural', () => {
      expect(LABELS_EN.rowCount(0, 0)).toBe('0 / 0 rows')
    })
    it('singular when total is 1', () => {
      expect(LABELS_EN.rowCount(1, 1)).toBe('1 / 1 row')
    })
    it('plural when total > 1', () => {
      expect(LABELS_EN.rowCount(3, 10)).toBe('3 / 10 rows')
    })
  })
  describe('groupCount', () => {
    it('singular', () => expect(LABELS_EN.groupCount(1)).toBe(' · 1 group'))
    it('plural', () => expect(LABELS_EN.groupCount(2)).toBe(' · 2 groups'))
  })
  describe('groupLabel', () => {
    it('formats index', () => expect(LABELS_EN.groupLabel(3)).toBe('Group 3'))
  })
  describe('rowsInGroup', () => {
    it('singular', () => expect(LABELS_EN.rowsInGroup(1)).toBe('1 row'))
    it('plural', () => expect(LABELS_EN.rowsInGroup(5)).toBe('5 rows'))
  })
  describe('pageOf', () => {
    it('formats page and total', () => expect(LABELS_EN.pageOf(2, 10)).toBe('Page 2 of 10'))
  })
  describe('moreValues', () => {
    it('formats the hidden count', () => expect(LABELS_EN.moreValues(12)).toBe('+12 more'))
  })
  describe('static labels', () => {
    it('activeSortsSection', () => expect(LABELS_EN.activeSortsSection).toBe('Active sorts'))
    it('clearSorts has no leading "× "', () => expect(LABELS_EN.clearSorts).toBe('Clear sorts'))
    it('activeGroupsSection', () => expect(LABELS_EN.activeGroupsSection).toBe('Active groups'))
    it('clearGroups has no leading "× "', () => expect(LABELS_EN.clearGroups).toBe('Clear groups'))
    it('clearFilters has no leading "× "', () =>
      expect(LABELS_EN.clearFilters).toBe('Clear filters'))
    it('clearSearch', () => expect(LABELS_EN.clearSearch).toBe('Clear search'))
  })
})

// FR uses > 1 instead of !== 1: 0 total is singular (unlike EN where 0 is plural)
describe('LABELS_FR', () => {
  describe('rowCount', () => {
    it('uses > 1: 0 total is singular', () => {
      expect(LABELS_FR.rowCount(0, 0)).toBe('0 / 0 ligne')
    })
    it('singular when total is 1', () => {
      expect(LABELS_FR.rowCount(1, 1)).toBe('1 / 1 ligne')
    })
    it('plural when total > 1', () => {
      expect(LABELS_FR.rowCount(3, 10)).toBe('3 / 10 lignes')
    })
  })
  describe('groupCount', () => {
    it('singular', () => expect(LABELS_FR.groupCount(1)).toBe(' · 1 groupe'))
    it('plural', () => expect(LABELS_FR.groupCount(2)).toBe(' · 2 groupes'))
  })
  describe('groupLabel', () => {
    it('formats index', () => expect(LABELS_FR.groupLabel(3)).toBe('Groupe 3'))
  })
  describe('rowsInGroup', () => {
    it('singular', () => expect(LABELS_FR.rowsInGroup(1)).toBe('1 ligne'))
    it('plural', () => expect(LABELS_FR.rowsInGroup(5)).toBe('5 lignes'))
  })
  describe('pageOf', () => {
    it('uses "sur"', () => expect(LABELS_FR.pageOf(2, 10)).toBe('Page 2 sur 10'))
  })
  describe('moreValues', () => {
    it('formats the hidden count', () => expect(LABELS_FR.moreValues(12)).toBe('+12 de plus'))
  })
  describe('static labels', () => {
    it('activeSortsSection', () => expect(LABELS_FR.activeSortsSection).toBe('Tris actifs'))
    it('clearSorts has no leading "× "', () =>
      expect(LABELS_FR.clearSorts).toBe('Effacer les tris'))
    it('activeGroupsSection', () => expect(LABELS_FR.activeGroupsSection).toBe('Groupes actifs'))
    it('clearGroups has no leading "× "', () =>
      expect(LABELS_FR.clearGroups).toBe('Effacer les groupes'))
    it('clearFilters has no leading "× "', () =>
      expect(LABELS_FR.clearFilters).toBe('Effacer les filtres'))
    it('clearSearch', () => expect(LABELS_FR.clearSearch).toBe('Effacer la recherche'))
  })
})

describe('LABELS_ES', () => {
  describe('rowCount', () => {
    it('uses !== 1: 0 total is plural', () => {
      expect(LABELS_ES.rowCount(0, 0)).toBe('0 / 0 filas')
    })
    it('singular when total is 1', () => {
      expect(LABELS_ES.rowCount(1, 1)).toBe('1 / 1 fila')
    })
    it('plural when total > 1', () => {
      expect(LABELS_ES.rowCount(3, 10)).toBe('3 / 10 filas')
    })
  })
  describe('groupCount', () => {
    it('singular', () => expect(LABELS_ES.groupCount(1)).toBe(' · 1 grupo'))
    it('plural', () => expect(LABELS_ES.groupCount(2)).toBe(' · 2 grupos'))
  })
  describe('groupLabel', () => {
    it('formats index', () => expect(LABELS_ES.groupLabel(3)).toBe('Grupo 3'))
  })
  describe('rowsInGroup', () => {
    it('singular', () => expect(LABELS_ES.rowsInGroup(1)).toBe('1 fila'))
    it('plural', () => expect(LABELS_ES.rowsInGroup(5)).toBe('5 filas'))
  })
  describe('pageOf', () => {
    it('uses "de"', () => expect(LABELS_ES.pageOf(2, 10)).toBe('Página 2 de 10'))
  })
  describe('moreValues', () => {
    it('formats the hidden count', () => expect(LABELS_ES.moreValues(12)).toBe('+12 más'))
  })
  describe('static labels', () => {
    it('activeSortsSection', () => expect(LABELS_ES.activeSortsSection).toBe('Orden activo'))
    it('clearSorts has no leading "× "', () => expect(LABELS_ES.clearSorts).toBe('Borrar orden'))
    it('activeGroupsSection', () => expect(LABELS_ES.activeGroupsSection).toBe('Grupos activos'))
    it('clearGroups has no leading "× "', () => expect(LABELS_ES.clearGroups).toBe('Borrar grupos'))
    it('clearFilters has no leading "× "', () =>
      expect(LABELS_ES.clearFilters).toBe('Borrar filtros'))
    it('clearSearch', () => expect(LABELS_ES.clearSearch).toBe('Borrar búsqueda'))
  })
})

describe('LABELS_DE', () => {
  describe('rowCount', () => {
    it('uses !== 1: 0 total is plural', () => {
      expect(LABELS_DE.rowCount(0, 0)).toBe('0 / 0 Zeilen')
    })
    it('singular when total is 1', () => {
      expect(LABELS_DE.rowCount(1, 1)).toBe('1 / 1 Zeile')
    })
    it('plural when total > 1', () => {
      expect(LABELS_DE.rowCount(3, 10)).toBe('3 / 10 Zeilen')
    })
  })
  describe('groupCount', () => {
    it('singular', () => expect(LABELS_DE.groupCount(1)).toBe(' · 1 Gruppe'))
    it('plural', () => expect(LABELS_DE.groupCount(2)).toBe(' · 2 Gruppen'))
  })
  describe('groupLabel', () => {
    it('formats index', () => expect(LABELS_DE.groupLabel(3)).toBe('Gruppe 3'))
  })
  describe('rowsInGroup', () => {
    it('singular', () => expect(LABELS_DE.rowsInGroup(1)).toBe('1 Zeile'))
    it('plural', () => expect(LABELS_DE.rowsInGroup(5)).toBe('5 Zeilen'))
  })
  describe('pageOf', () => {
    it('uses "von"', () => expect(LABELS_DE.pageOf(2, 10)).toBe('Seite 2 von 10'))
  })
  describe('moreValues', () => {
    it('formats the hidden count', () => expect(LABELS_DE.moreValues(12)).toBe('+12 weitere'))
  })
  describe('static labels', () => {
    it('activeSortsSection', () => expect(LABELS_DE.activeSortsSection).toBe('Aktive Sortierungen'))
    it('clearSorts has no leading "× "', () =>
      expect(LABELS_DE.clearSorts).toBe('Sortierung löschen'))
    it('activeGroupsSection', () =>
      expect(LABELS_DE.activeGroupsSection).toBe('Aktive Gruppierungen'))
    it('clearGroups has no leading "× "', () =>
      expect(LABELS_DE.clearGroups).toBe('Gruppen löschen'))
    it('clearFilters has no leading "× "', () =>
      expect(LABELS_DE.clearFilters).toBe('Filter löschen'))
    it('clearSearch', () => expect(LABELS_DE.clearSearch).toBe('Suche löschen'))
  })
})

describe('LABELS_PT', () => {
  describe('rowCount', () => {
    it('uses !== 1: 0 total is plural', () => {
      expect(LABELS_PT.rowCount(0, 0)).toBe('0 / 0 linhas')
    })
    it('singular when total is 1', () => {
      expect(LABELS_PT.rowCount(1, 1)).toBe('1 / 1 linha')
    })
    it('plural when total > 1', () => {
      expect(LABELS_PT.rowCount(3, 10)).toBe('3 / 10 linhas')
    })
  })
  describe('groupCount', () => {
    it('singular', () => expect(LABELS_PT.groupCount(1)).toBe(' · 1 grupo'))
    it('plural', () => expect(LABELS_PT.groupCount(2)).toBe(' · 2 grupos'))
  })
  describe('groupLabel', () => {
    it('formats index', () => expect(LABELS_PT.groupLabel(3)).toBe('Grupo 3'))
  })
  describe('rowsInGroup', () => {
    it('singular', () => expect(LABELS_PT.rowsInGroup(1)).toBe('1 linha'))
    it('plural', () => expect(LABELS_PT.rowsInGroup(5)).toBe('5 linhas'))
  })
  describe('pageOf', () => {
    it('uses "de"', () => expect(LABELS_PT.pageOf(2, 10)).toBe('Página 2 de 10'))
  })
  describe('moreValues', () => {
    it('formats the hidden count', () => expect(LABELS_PT.moreValues(12)).toBe('+12 mais'))
  })
  describe('static labels', () => {
    it('activeSortsSection', () => expect(LABELS_PT.activeSortsSection).toBe('Ordenações ativas'))
    it('clearSorts has no leading "× "', () =>
      expect(LABELS_PT.clearSorts).toBe('Limpar ordenação'))
    it('activeGroupsSection', () => expect(LABELS_PT.activeGroupsSection).toBe('Grupos ativos'))
    it('clearGroups has no leading "× "', () => expect(LABELS_PT.clearGroups).toBe('Limpar grupos'))
    it('clearFilters has no leading "× "', () =>
      expect(LABELS_PT.clearFilters).toBe('Limpar filtros'))
    it('clearSearch', () => expect(LABELS_PT.clearSearch).toBe('Limpar pesquisa'))
  })
})
