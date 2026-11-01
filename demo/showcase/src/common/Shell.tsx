import type { JSX } from 'solid-js'
import './shell.css'

// The page's folder, from its URL (/infra/ or /data-table/showcase/infra/ on Pages)
const page = location.pathname.split('/').filter(Boolean).pop()
const dir = `demo/showcase/src/${page}`

// Page frame shared by every showcase page; the page's own stylesheet themes it
export function Shell(props: {
  title: string
  context: string
  /** The page's own source, imported with `?raw` so it can't drift from what runs */
  source: string
  children: JSX.Element
}) {
  return (
    <div class="sc-shell">
      <header class="sc-header">
        <a class="sc-back" href="../">
          ← All demos
        </a>
        <h1>{props.title}</h1>
        <p class="sc-context">{props.context}</p>
      </header>
      <main>{props.children}</main>
      <details class="sc-source">
        <summary>View source</summary>
        <p class="sc-source-path">
          <code>{dir}/App.tsx</code> ·{' '}
          <a href={`https://github.com/vatesfr/data-table/tree/main/${dir}`}>
            whole page on GitHub
          </a>
        </p>
        <pre>
          <code>{props.source}</code>
        </pre>
      </details>
    </div>
  )
}
