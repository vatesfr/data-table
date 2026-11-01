import { mulberry32 } from '../../../shared/hugeData'

export type Position = 'GK' | 'DF' | 'MF' | 'FW'

export interface Team {
  name: string
  code: string
  color: string
}

export interface Player {
  id: string
  name: string
  team: string
  position: Position
  age: number
  games: number
  minutes: number
  goals: number
  assists: number
  shots: number
  passPct: number
  yellow: number
  red: number
  /** Team's last five results, oldest first, e.g. `WWDLW` */
  form: string
}

// Fictional clubs: any resemblance to a real one is accidental
export const TEAMS: Team[] = [
  { name: 'Harbor City', code: 'HBC', color: '#0369a1' },
  { name: 'Northgate Rovers', code: 'NGR', color: '#dc2626' },
  { name: 'Ashford Athletic', code: 'ASH', color: '#166534' },
  { name: 'Redmoor United', code: 'RMU', color: '#b91c1c' },
  { name: 'Silverbrook', code: 'SVB', color: '#6b7280' },
  { name: 'Kingsfield Town', code: 'KFT', color: '#7c3aed' },
  { name: 'Lowmarsh Wanderers', code: 'LMW', color: '#c2410c' },
  { name: 'Eastvale Albion', code: 'EVA', color: '#2563eb' },
  { name: 'Coppergate', code: 'CPG', color: '#9a3412' },
  { name: 'Blackwater FC', code: 'BWF', color: '#334155' },
  { name: 'Thornbury City', code: 'THC', color: '#0e7490' },
  { name: 'Westcliff Rangers', code: 'WCR', color: '#15803d' },
  { name: 'Ironbridge', code: 'IRB', color: '#57534e' },
  { name: 'Fairhaven Sporting', code: 'FHS', color: '#db2777' },
  { name: 'Oakdale Borough', code: 'OKB', color: '#a16207' },
  { name: 'Stonecross', code: 'STX', color: '#4f46e5' },
  { name: 'Millbank Athletic', code: 'MBA', color: '#047857' },
  { name: 'Greywick', code: 'GRW', color: '#64748b' },
  { name: 'Riverside Dynamo', code: 'RSD', color: '#e11d48' },
  { name: 'Hollowmere', code: 'HLM', color: '#0f766e' },
]

export const TEAM_BY_NAME = new Map(TEAMS.map((t) => [t.name, t]))

const FIRST = [
  'Alex',
  'Bruno',
  'Caio',
  'Dario',
  'Emil',
  'Felix',
  'Goran',
  'Hugo',
  'Ivo',
  'Jonas',
  'Kofi',
  'Luca',
  'Marek',
  'Nils',
  'Oscar',
  'Pavel',
  'Quinn',
  'Rafa',
  'Sami',
  'Tomas',
  'Umar',
  'Viktor',
  'Wes',
  'Yann',
  'Zeno',
]
const LAST = [
  'Arlo',
  'Brenn',
  'Castell',
  'Duvane',
  'Eskell',
  'Ferro',
  'Galt',
  'Holm',
  'Idris',
  'Jaster',
  'Kovan',
  'Lindqvist',
  'Marlow',
  'Novak',
  'Orsini',
  'Pell',
  'Quarry',
  'Rook',
  'Stellan',
  'Tavor',
  'Ulric',
  'Varga',
  'Wendt',
  'Yarrow',
  'Zoric',
]

// Squad shape per club: 3 keepers, 8 defenders, 8 midfielders, 6 forwards
const SQUAD: Position[] = [
  ...Array<Position>(3).fill('GK'),
  ...Array<Position>(8).fill('DF'),
  ...Array<Position>(8).fill('MF'),
  ...Array<Position>(6).fill('FW'),
]

// Goals and assists per 90 minutes for a typical player of each position
const RATES: Record<Position, { goals: number; assists: number; shots: number }> = {
  GK: { goals: 0, assists: 0.01, shots: 0.02 },
  DF: { goals: 0.05, assists: 0.08, shots: 0.6 },
  MF: { goals: 0.17, assists: 0.22, shots: 1.4 },
  FW: { goals: 0.45, assists: 0.18, shots: 3 },
}

export const SEASON_GAMES = 34

export function makePlayers(): Player[] {
  const rand = mulberry32(19)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  // Poisson-ish count: a mean scaled by a per-player talent factor
  const count = (mean: number) => Math.max(0, Math.round(mean * (0.4 + rand() * 1.4)))
  return TEAMS.flatMap((team, ti) => {
    const form = Array.from({ length: 5 }, () => {
      const r = rand()
      return r < 0.45 ? 'W' : r < 0.7 ? 'D' : 'L'
    }).join('')
    return SQUAD.map((position, si): Player => {
      // A squad's first keeper plays every game, the others rarely
      const starter = position === 'GK' ? si === 0 : rand() < 0.6
      const games = starter
        ? 22 + Math.floor(rand() * 13)
        : 2 + Math.floor(rand() * (position === 'GK' ? 5 : 20))
      const minutes = Math.round(games * (starter ? 72 + rand() * 18 : 25 + rand() * 40))
      const per90 = minutes / 90
      const rate = RATES[position]
      const goals = count(rate.goals * per90)
      return {
        id: `p-${ti}-${si}`,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        team: team.name,
        position,
        age: 17 + Math.floor(rand() * 19),
        games,
        minutes,
        goals,
        assists: count(rate.assists * per90),
        // Every goal is a shot on target
        shots: goals + count(rate.shots * per90),
        passPct: Math.round(position === 'GK' ? 55 + rand() * 25 : 68 + rand() * 24),
        yellow: count(0.12 * per90 * (position === 'DF' ? 1.6 : 1)),
        red: rand() < 0.06 ? 1 : 0,
        form,
      }
    })
  })
}
