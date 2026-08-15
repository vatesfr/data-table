export interface BadgeColorEntry {
  bg: string
  color: string
}

export interface BadgeProps {
  value: string
  colorMap?: Record<string, BadgeColorEntry>
}

export function Badge({ value, colorMap }: BadgeProps) {
  const c = colorMap?.[value]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        background: c?.bg ?? '#F1EFE8',
        color: c?.color ?? '#444441',
      }}
    >
      {value}
    </span>
  )
}
