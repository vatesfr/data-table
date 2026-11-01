import { mulberry32 } from '../../../shared/hugeData'

export interface Transaction {
  id: string
  /** As a French bank export writes it: `JJ/MM/AAAA` */
  date: string
  libelle: string
  categorie: string
  compte: string
  /** Signed: negative for a debit */
  montant: number
  pointe: boolean
}

export const COURANT = 'Courant ••0412'
export const LIVRET = 'Livret A ••7731'
export const CARTE = 'Visa ••5508'
export const INTERNAL = 'Virement interne'

const GROCERIES = ['CARREFOUR MARKET', 'MONOPRIX', 'BIOCOOP', 'LIDL', 'PICARD']
const FOOD_OUT = ['LE PETIT ZINC', 'BOULANGERIE PAUL', 'SUSHI SHOP', 'CAFE DE FLORE']
// Day-to-day card spending (frequent ones listed twice): payees and a [min, max] debit range
const DAILY: [categorie: string, payees: string[], min: number, max: number][] = [
  ['Alimentation', GROCERIES, 3, 90],
  ['Alimentation', GROCERIES, 3, 90],
  ['Restaurants', FOOD_OUT, 2, 45],
  ['Restaurants', FOOD_OUT, 2, 45],
  ['Transports', ['SNCF CONNECT', 'TOTALENERGIES', 'UBER', 'INDIGO PARKING'], 2, 70],
  ['Loisirs', ['FNAC', 'CINEMA UGC', 'DECATHLON', 'LIBRAIRIE GALLIMARD'], 5, 90],
  ['Santé', ['PHARMACIE DU MARCHE', 'CABINET DR LEROY', 'OPTIQUE KRYS'], 3, 60],
]
const HOME = ['LEROY MERLIN', 'IKEA', 'CASTORAMA', 'DARTY']

// Once a month on a fixed day: [day, categorie, libelle, compte, amount]
const MONTHLY: [number, string, string, string, number][] = [
  [1, 'Logement', 'PRLV SEPA FONCIA LOYER', COURANT, -1150],
  [4, 'Énergie', 'PRLV SEPA EDF', COURANT, -86.4],
  [6, 'Télécom', 'PRLV SEPA FREE MOBILE', COURANT, -19.99],
  [6, 'Télécom', 'PRLV SEPA ORANGE INTERNET', COURANT, -39.99],
  [10, 'Assurances', 'PRLV SEPA MAIF', COURANT, -64.12],
  [12, 'Abonnements', 'NETFLIX.COM', CARTE, -13.49],
  [15, 'Impôts', 'PRLV DGFIP PRELEVEMENT A LA SOURCE', COURANT, -412],
  [28, 'Salaires', 'VIR SEPA ACME SAS SALAIRE', COURANT, 3120],
  [28, 'Salaires', 'VIR SEPA MAIRIE DE PARIS TRAITEMENT', COURANT, 2650],
]

const START = new Date(2024, 10, 1)
const DAYS = 730
/** The export's date: recent lines aren't reconciled with the bank statement yet */
export const AS_OF = new Date(2026, 9, 31)

const pad = (n: number) => String(n).padStart(2, '0')
const toFr = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
const cents = (n: number) => Math.round(n * 100) / 100

export function parseFrDate(value: string): number {
  const [d, m, y] = value.split('/').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function makeTransactions(): Transaction[] {
  const rand = mulberry32(1789)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const out: Transaction[] = []
  const add = (day: Date, categorie: string, libelle: string, compte: string, montant: number) => {
    const age = (AS_OF.getTime() - day.getTime()) / 86_400_000
    out.push({
      id: `tx-${out.length}`,
      date: toFr(day),
      libelle,
      categorie,
      compte,
      montant: cents(montant),
      pointe: age > 25 ? rand() < 0.98 : rand() < 0.3,
    })
  }
  for (let i = 0; i < DAYS; i++) {
    const day = new Date(START.getFullYear(), START.getMonth(), START.getDate() + i)
    for (const [d, categorie, libelle, compte, amount] of MONTHLY)
      if (day.getDate() === d) add(day, categorie, libelle, compte, amount * (0.97 + rand() * 0.06))
    if (day.getDate() === 29) {
      // Savings sweep: the same money leaves one account and lands in the other
      const amount = 100 * (2 + Math.floor(rand() * 6))
      add(day, INTERNAL, `VIR INTERNE VERS ${LIVRET}`, COURANT, -amount)
      add(day, INTERNAL, `VIR INTERNE DE ${COURANT}`, LIVRET, amount)
    }
    if (rand() < 0.04) add(day, 'Remboursements', 'VIR CPAM PARIS', COURANT, 10 + rand() * 90)
    if (rand() < 0.02) add(day, 'Ventes', 'VIR LEBONCOIN', COURANT, 20 + rand() * 1400)
    if (rand() < 0.03) add(day, 'Maison', `CB ${pick(HOME)}`, CARTE, -(30 + rand() * 570))
    const n = 2 + Math.floor(rand() * 10)
    for (let k = 0; k < n; k++) {
      const [categorie, payees, min, max] = pick(DAILY)
      // Mostly small tickets, a few large ones
      const amount = min + (max - min) * rand() ** 3
      add(day, categorie, `CB ${pick(payees)}`, rand() < 0.7 ? CARTE : COURANT, -amount)
    }
  }
  return out
}
