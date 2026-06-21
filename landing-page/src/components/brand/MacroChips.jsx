/**
 * MacroChips — fileira de chips de macronutrientes.
 * `color` referencia o token --macro-{color}.
 */
export default function MacroChips({
  items = [
    { label: 'Proteína', value: '68g', color: 'protein' },
    { label: 'Carbo', value: '145g', color: 'carbs' },
    { label: 'Gordura', value: '42g', color: 'fat' },
  ],
}) {
  return (
    <div className="macro-chips">
      {items.map((m) => (
        <div className="macro-chip" key={m.label}>
          <strong style={{ color: `var(--macro-${m.color})` }}>{m.value}</strong>
          <span>{m.label}</span>
        </div>
      ))}
    </div>
  )
}
