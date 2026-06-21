/**
 * CalorieRing — anel de calorias com número central.
 * O percentual preenchido é calculado de value/total.
 */
export default function CalorieRing({ value = 1247, total = 2000, size = 160 }) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  return (
    <div className="cring" style={{ width: size, height: size, '--pct': pct + '%' }}>
      <div className="cring__inner">
        <strong>{value.toLocaleString('pt-BR')}</strong>
        <span>kcal · {Math.max(0, total - value)} restantes</span>
      </div>
    </div>
  )
}
