// jsdom has no matchMedia: report a fixed match for every query; returns the restore function
export function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}
