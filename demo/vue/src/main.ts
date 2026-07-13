import { createApp } from 'vue'
import { renderThemeCss } from '@vates/data-table-core'
import App from './App.vue'

// Defines the --color-* tokens DataTableView reads — see the "Theming" section in the README
// for how a real consumer would do this in their own stylesheet instead.
const themeStyle = document.createElement('style')
themeStyle.textContent = renderThemeCss()
document.head.prepend(themeStyle)

createApp(App).mount('#app')
