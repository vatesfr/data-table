export interface ScoreBarOptions {
  max?: number
  /** Custom color thresholds as [minPct, color] pairs, sorted ascending by minPct */
  thresholds?: Array<[number, string]>
}

const DEFAULT_THRESHOLDS: Array<[number, string]> = [
  [90, '#3B6D11'],
  [75, '#185FA5'],
  [0, '#A32D2D'],
]

function resolveColor(pct: number, thresholds: Array<[number, string]>): string {
  for (const [min, color] of thresholds) {
    if (pct >= min) return color
  }
  return thresholds[thresholds.length - 1][1]
}

/** Builds a colored score bar DOM node — for use as a column's `render(value, row)`. */
export function createScoreBar(value: number, options: ScoreBarOptions = {}): HTMLElement {
  const { max = 100, thresholds = DEFAULT_THRESHOLDS } = options
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = resolveColor(pct, thresholds)

  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px'

  const track = document.createElement('div')
  track.style.cssText = 'flex:1;height:6px;background:#F1EFE8;border-radius:3px;overflow:hidden'

  const fill = document.createElement('div')
  fill.style.cssText = `width:${pct}%;height:100%;background:${color};border-radius:3px`
  track.appendChild(fill)

  const label = document.createElement('span')
  label.style.cssText = `font-size:12px;min-width:26px;color:${color}`
  label.textContent = String(value)

  wrap.append(track, label)
  return wrap
}
