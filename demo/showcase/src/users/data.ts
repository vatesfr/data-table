import { mulberry32 } from '../../../shared/hugeData'

export type Role = 'Owner' | 'Admin' | 'Member' | 'Billing' | 'Viewer'
export type Status = 'active' | 'invited' | 'suspended'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  team: string
  groups: string[]
  status: Status
  mfa: 'Yes' | 'No'
  /** ISO date; null when the user never signed in */
  lastLogin: string | null
  created: string
  /** ISO date of the last invitation e-mail, for invited users */
  invitedAt: string | null
}

export const ROLES: Role[] = ['Owner', 'Admin', 'Member', 'Billing', 'Viewer']
const TEAMS = ['Engineering', 'Design', 'Product', 'Sales', 'Support', 'Finance', 'Marketing']
const GROUPS = ['on-call', 'beta-testers', 'eu-region', 'us-region', 'sso', 'contractors']
const FIRST = [
  'Ada', 'Bruno', 'Chloé', 'Dmitri', 'Elena', 'Farid', 'Grace', 'Hugo', 'Ines', 'Jonas', 'Keiko',
  'Lucas', 'Maya', 'Nadia', 'Omar', 'Priya', 'Quentin', 'Rosa', 'Sven', 'Tariq', 'Uma', 'Victor',
  'Wen', 'Yara', 'Zoé',
] // prettier-ignore
const LAST = [
  'Almeida', 'Becker', 'Costa', 'Dubois', 'Eriksen', 'Fischer', 'García', 'Haddad', 'Ito', 'Jansen',
  'Kowalski', 'Laurent', 'Moreau', 'Novak', 'Okafor', 'Petrov', 'Rossi', 'Silva', 'Tanaka', 'Weber',
] // prettier-ignore

/** The app's "today": fixed so the demo renders the same every day */
export const TODAY = '2026-10-30'
const DAY = 86_400_000

export const USER_COUNT = 150

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function makeUsers(): User[] {
  const rand = mulberry32(11)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const base = new Date(`${TODAY}T12:00:00`).getTime()
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  return Array.from({ length: USER_COUNT }, (_, i) => {
    const first = pick(FIRST)
    const last = pick(LAST)
    const r = rand()
    const status: Status = r < 0.76 ? 'active' : r < 0.9 ? 'invited' : 'suspended'
    const age = 2 + rand() * 3 * 365 // days since the account was created
    return {
      id: `u-${i}`,
      name: `${first} ${last}`,
      email: `${slug(first)}.${slug(last)}${i}@tessel.example`,
      role: i === 0 ? 'Owner' : pick(['Admin', 'Member', 'Member', 'Member', 'Billing', 'Viewer']),
      team: pick(TEAMS),
      groups: GROUPS.filter(() => rand() < 0.22),
      status,
      mfa: status === 'active' && rand() < 0.65 ? 'Yes' : 'No',
      // Invited users never signed in, some active ones neither (SSO-only, API tokens)
      lastLogin:
        status === 'invited' || (status === 'active' && rand() < 0.12)
          ? null
          : iso(base - rand() * Math.min(age, status === 'suspended' ? 300 : 60) * DAY),
      created: iso(base - age * DAY),
      invitedAt: status === 'invited' ? iso(base - rand() * Math.min(age, 20) * DAY) : null,
    }
  })
}
