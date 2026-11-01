import { mulberry32 } from '../../../shared/hugeData'

export type Level = 'debug' | 'info' | 'warn' | 'error'

export interface LogEvent {
  id: number
  /** Local ISO date-time, e.g. `2026-10-31T23:59:58.120` */
  timestamp: string
  level: Level
  service: string
  host: string
  status: number
  durationMs: number
  message: string
}

export const LEVELS: Level[] = ['debug', 'info', 'warn', 'error']

const SERVICES = [
  'api-gateway',
  'auth',
  'billing',
  'checkout',
  'search',
  'inventory',
  'notifications',
  'media',
  'scheduler',
  'ingest',
]
const REGIONS = ['fra', 'ams', 'iad', 'sin']
const HOSTS = Array.from(
  { length: 320 },
  (_, i) => `${REGIONS[i % 4]}-node-${String(i + 1).padStart(3, '0')}`,
)
const PATHS = ['/v1/orders', '/v1/cart', '/v1/users/me', '/v1/search', '/v1/payments', '/healthz']
const METHODS = ['GET', 'GET', 'GET', 'POST', 'PUT', 'DELETE']
const STATUS_BY_LEVEL: Record<Level, number[]> = {
  debug: [200, 200, 204, 304],
  info: [200, 200, 200, 201, 204, 301, 304],
  warn: [400, 401, 403, 404, 404, 409, 429, 429],
  error: [500, 500, 502, 503, 503, 504],
}

export const EVENT_COUNT = 100_000
// Newest event; older ones step back ~6 s on average, so the log spans about a week
const NEWEST = new Date('2026-10-31T23:59:59').getTime()

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function localIso(t: number): string {
  const d = new Date(t)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  )
}

export function makeEvents(): LogEvent[] {
  const rand = mulberry32(1337)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const hex = (len: number) =>
    Math.floor(rand() * 16 ** len)
      .toString(16)
      .padStart(len, '0')

  function message(level: Level, service: string, status: number, ms: number): string {
    const req = `req=${hex(8)}`
    const path = pick(PATHS)
    switch (level) {
      case 'debug':
        return pick([
          `cache hit key=user:${Math.floor(rand() * 90000)} ttl=${pick([30, 60, 300])}s ${req}`,
          `db query on ${pick(['orders', 'users', 'items'])} returned ${Math.floor(rand() * 500)} rows in ${ms}ms`,
          `feature flag ${pick(['new-checkout', 'dark-mode', 'v2-search'])} evaluated to ${rand() < 0.5}`,
        ])
      case 'info':
        return rand() < 0.7
          ? `${pick(METHODS)} ${path} ${status} ${ms}ms ${req} ua="Mozilla/5.0"`
          : pick([
              `job ${service}.sync-${hex(4)} completed in ${ms}ms`,
              `user ${Math.floor(rand() * 90000)} signed in from ${pick(REGIONS)}`,
            ])
      case 'warn':
        return pick([
          `${pick(METHODS)} ${path} ${status} — client error ${req}`,
          `slow query on orders (${ms} ms), consider an index on (customer_id, created_at)`,
          `retrying upstream ${pick(SERVICES)} (attempt 2/3) after ${status} ${req}`,
          `rate limit at 90% for api key ak_${hex(6)}`,
        ])
      case 'error':
        return pick([
          `upstream ${pick(SERVICES)} timed out after ${ms}ms ${req} trace=${hex(16)}`,
          `connection refused: postgres://db-${pick(REGIONS)}-${Math.floor(rand() * 4)}:5432/main (pool exhausted, 64/64 in use)`,
          `unhandled TypeError: Cannot read properties of undefined (reading 'amount') at ${service}/handler.ts:${Math.floor(rand() * 400)}`,
          `${pick(METHODS)} ${path} ${status} ${ms}ms ${req}: internal error, see trace=${hex(16)}`,
        ])
    }
  }

  const events: LogEvent[] = new Array(EVENT_COUNT)
  let t = NEWEST
  for (let i = 0; i < EVENT_COUNT; i++) {
    t -= Math.round(-Math.log(1 - rand()) * 6000)
    const r = rand()
    const level: Level = r < 0.28 ? 'debug' : r < 0.84 ? 'info' : r < 0.95 ? 'warn' : 'error'
    const service = pick(SERVICES)
    // Skewed: a few hot hosts log most of the traffic; stepping by 97 (coprime with 320) scatters them
    const host = HOSTS[(Math.floor(rand() ** 2.5 * HOSTS.length) * 97) % HOSTS.length]
    const status = pick(STATUS_BY_LEVEL[level])
    // Log-normal latency, errors slower (timeouts)
    const gauss = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
    const durationMs = Math.max(
      1,
      Math.round(Math.exp(3.2 + 1.1 * gauss + (level === 'error' ? 2 : 0))),
    )
    events[i] = {
      id: i,
      timestamp: localIso(t),
      level,
      service,
      host,
      status,
      durationMs,
      message: message(level, service, status, durationMs),
    }
  }
  return events
}
