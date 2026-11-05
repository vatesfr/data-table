/**
 * Keeps `--dt-wrap-width` on the table's scroll container at its visible width, so a sticky group
 * label wraps within it instead of running past the edge (docs/columns.md). Returns the cleanup.
 */
export function trackWrapWidth(wrap: HTMLElement): () => void {
  const observer =
    typeof ResizeObserver == 'undefined'
      ? undefined
      : new ResizeObserver(() => wrap.style.setProperty('--dt-wrap-width', wrap.clientWidth + 'px'))
  observer?.observe(wrap)
  return () => observer?.disconnect()
}
