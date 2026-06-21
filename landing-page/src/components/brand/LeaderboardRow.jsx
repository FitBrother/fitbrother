/**
 * LeaderboardRow — linha do ranking de amigos.
 * `you` destaca a linha do próprio usuário.
 */
export default function LeaderboardRow({ rank, name, value, you = false }) {
  return (
    <div className={`lb-row${you ? ' lb-row--you' : ''}`}>
      <span className="lb-rank">{rank}</span>
      <span className="lb-name">
        {name}
        {you && <em> · você</em>}
      </span>
      <span className="lb-value">{value}</span>
    </div>
  )
}
