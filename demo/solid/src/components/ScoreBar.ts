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

/** Same plain-DOM-node convention as `badge()` above — see its own doc comment for why. */
export function scoreBar(value: number, options: ScoreBarOptions = {}): Node {
  const { max = 100, thresholds = DEFAULT_THRESHOLDS } = options
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = resolveColor(pct, thresholds)

  const wrap = document.createElement('div')
  Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '6px' })

  const track = document.createElement('div')
  Object.assign(track.style, {
    flex: '1',
    height: '6px',
    background: '#F1EFE8',
    borderRadius: '3px',
    overflow: 'hidden',
  })
  const fill = document.createElement('div')
  Object.assign(fill.style, {
    width: `${pct}%`,
    height: '100%',
    background: color,
    borderRadius: '3px',
  })
  track.appendChild(fill)

  const label = document.createElement('span')
  Object.assign(label.style, { fontSize: '12px', minWidth: '26px', color })
  label.textContent = String(value)

  wrap.append(track, label)
  return wrap
}
