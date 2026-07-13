import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderThemeCss } from '@vates/data-table-core'
import App from './App'

// Defines the --color-* tokens DataTableView reads — see the "Theming" section in the README
// for how a real consumer would do this in their own stylesheet instead.
const themeStyle = document.createElement('style')
themeStyle.textContent = renderThemeCss()
document.head.prepend(themeStyle)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
