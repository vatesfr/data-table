export const LIGHT_THEME: Record<string, string> = {
  'color-background-primary': '#fff',
  'color-background-secondary': '#f7f6f3',
  'color-background-tertiary': '#eae9e5',
  'color-background-info': '#e6f1fb',
  'color-background-warning': '#faeeda',
  'color-background-danger': '#fbe9e9',
  'color-text-primary': '#1a1916',
  'color-text-secondary': '#6b6a66',
  'color-text-tertiary': '#9b9a96',
  'color-text-info': '#185fa5',
  'color-text-warning': '#854f0b',
  'color-text-danger': '#a5182f',
  'color-border-secondary': '#dddcd8',
  'color-border-tertiary': '#eeedea',
  'color-border-info': '#b8d6f5',
  'color-border-warning': '#f0d4a8',
  'color-border-danger': '#f2c2c2',
}

export const DARK_THEME: Record<string, string> = {
  'color-background-primary': '#141413',
  'color-background-secondary': '#2b2a26',
  'color-background-tertiary': '#3a3830',
  'color-background-info': '#0d2640',
  'color-background-warning': '#2a1900',
  'color-background-danger': '#3a1414',
  'color-text-primary': '#e8e7e4',
  'color-text-secondary': '#9b9a96',
  'color-text-tertiary': '#86847e',
  'color-text-info': '#5b9fe0',
  'color-text-warning': '#e8a040',
  'color-text-danger': '#e2726f',
  'color-border-secondary': '#504d46',
  'color-border-tertiary': '#333029',
  'color-border-info': '#1a4070',
  'color-border-warning': '#4a2c00',
  'color-border-danger': '#5a2020',
}

function toCssVars(theme: Record<string, string>): string {
  return Object.entries(theme)
    .map(([key, value]) => `--${key}:${value}`)
    .join(';')
}

/**
 * Renders the light/dark token set as a CSS string: a `:root` block for
 * light, `@media (prefers-color-scheme: dark)` + `[data-theme]` overrides
 * for dark — the single source consumed by the vanilla adapter's injected
 * stylesheet and by app shells that define these tokens themselves.
 */
export function renderThemeCss(): string {
  const light = toCssVars(LIGHT_THEME)
  const dark = toCssVars(DARK_THEME)
  return `:root{${light}}@media(prefers-color-scheme:dark){:root{${dark}}}[data-theme=dark]{${dark}}[data-theme=light]{${light}}`
}
