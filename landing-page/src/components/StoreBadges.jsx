/**
 * StoreBadges.jsx — Nota de "em breve" para App Store / Google Play.
 *
 * Publicação nas lojas ainda não saiu. Em vez de badges de loja
 * acinzentados, um texto simples avisa que estão a caminho — o CTA
 * que funciona hoje é o app web (/app).
 */

export default function StoreBadges({ className = '' }) {
  return <p className={`store-note ${className}`}>App Store e Google Play em breve.</p>
}
