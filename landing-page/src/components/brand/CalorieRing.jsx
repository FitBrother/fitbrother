/**
 * CalorieRing — anel de calorias com número central.
 * Arco SVG (stroke-dasharray) preenchido de acordo com value/total.
 */
export default function CalorieRing({ value = 1247, total = 2000, size = 160 }) {
  const pct = Math.min(1, value / total)
  const strokeWidth = size >= 120 ? 14 : 10
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r

  return (
    <div className="cring" style={{ width: size, height: size }}>
      <svg className="cring__svg" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mist-2)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--menta-500)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="cring__inner">
        <strong>{value.toLocaleString('pt-BR')}</strong>
        <span>kcal · {Math.max(0, total - value)} restantes</span>
      </div>
    </div>
  )
}
