import { render } from 'solid-js/web'
import App from './App'

// No manual theme injection needed here (unlike the react/vue demos' own main.tsx/main.ts) —
// @vates/data-table-solid's own <DataTableView> already calls injectStyles() itself on mount,
// the same self-injected stylesheet (--color-* tokens included) @vates/data-table-vanilla bundles
// and injects. See demo/vanilla's own index.html for the identical reasoning.
render(() => <App />, document.getElementById('root')!)
