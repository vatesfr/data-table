import { resolve } from 'node:path'

// A reused dev server may belong to another checkout (a parallel session's worktree): the tests
// would then pass or fail on its code. The demos import the packages from source, outside their
// root, so Vite serves those imports as `/@fs/<checkout>/packages/…`.
const root = resolve(__dirname, '..')
const PROBES = ['http://localhost:58983/src/App.tsx', 'http://localhost:58985/src/ledger/App.tsx']

export default async function globalSetup() {
  for (const url of PROBES) {
    const code = await (await fetch(url)).text()
    if (!code.includes(`/@fs${root}/packages/`))
      throw new Error(
        `${new URL(url).host} serves another checkout than ${root}: stop that dev server, or run the tests from its checkout`,
      )
  }
}
