import { mulberry32 } from '../../../shared/hugeData'

export type Power = 'Running' | 'Paused' | 'Halted'

export interface Vm {
  id: string
  name: string
  power: Power
  pool: string
  host: string
  os: string
  vcpus: number
  ramGiB: number
  diskGiB: number
  cpu: number | null
  tags: string[]
  lastBoot: string
}

const POOLS = ['par-prod', 'par-staging', 'lyo-prod', 'lab']
const ROLES = ['web', 'db', 'cache', 'ci', 'mail', 'dns', 'proxy', 'backup', 'k8s', 'vpn']
const OSES = ['Debian 12', 'Debian 11', 'Ubuntu 24.04', 'Rocky 9', 'Windows 2022', 'Alpine 3.20']
const TAGS = ['critical', 'backup', 'gpu', 'public', 'legacy', 'monitored', 'customer-a']

export const VM_COUNT = 1500

export function makeVms(): Vm[] {
  const rand = mulberry32(7)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const base = new Date('2026-10-30T12:00:00').getTime()
  return Array.from({ length: VM_COUNT }, (_, i) => {
    const pool = pick(POOLS)
    const r = rand()
    const power: Power = r < 0.78 ? 'Running' : r < 0.85 ? 'Paused' : 'Halted'
    const role = pick(ROLES)
    return {
      id: `vm-${i}`,
      name: `${role}-${pool.split('-')[0]}-${String(i).padStart(4, '0')}`,
      power,
      pool,
      host: `${pool}-h${1 + Math.floor(rand() * 8)}`,
      os: pick(OSES),
      vcpus: 2 ** Math.floor(rand() * 5),
      ramGiB: 2 ** (1 + Math.floor(rand() * 6)),
      // Right-skewed: most disks are small, a few are huge
      diskGiB: Math.round(10 * Math.exp(rand() * 6)),
      cpu: power === 'Running' ? Math.round(rand() * 100) : null,
      tags: TAGS.filter(() => rand() < 0.2),
      lastBoot: new Date(base - rand() * 400 * 86_400_000).toISOString().slice(0, 10),
    }
  })
}

const tickRand = mulberry32(1)

/** Next sample of the live CPU metric: running VMs drift, others report nothing */
export function tick(vms: Vm[]): Vm[] {
  return vms.map((vm) =>
    vm.power === 'Running'
      ? {
          ...vm,
          cpu: Math.max(0, Math.min(100, Math.round((vm.cpu ?? 0) + (tickRand() - 0.5) * 20))),
        }
      : vm,
  )
}
