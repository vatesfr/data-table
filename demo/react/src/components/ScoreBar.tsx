export interface ScoreBarProps {
  value: number
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

export function ScoreBar({ value, max = 100, thresholds = DEFAULT_THRESHOLDS }: ScoreBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = resolveColor(pct, thresholds)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: '#F1EFE8',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, minWidth: 26, color }}>{value}</span>
    </div>
  )
}
