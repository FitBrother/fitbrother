/**
 * DottedChart — grade de 7 colunas representando a aderência da semana.
 * `on=true` pinta o ponto em menta; caso contrário fica apagado.
 */
export default function DottedChart({ days = [true, true, false, true, true, false, true] }) {
  return (
    <div className="dotted-chart" role="img" aria-label="Aderência da semana">
      {days.map((on, i) => (
        <i key={i} className={on ? 'on' : ''} />
      ))}
    </div>
  )
}
