// Resolves the panel before `mutate()` (which may remove `el`), then refocuses `selector` in it
export function withPanelRefocus(el: HTMLElement, selector: string, mutate: () => void): void {
  const panel = el.closest('.dt-dd')
  mutate()
  panel?.querySelector<HTMLElement>(selector)?.focus()
}
