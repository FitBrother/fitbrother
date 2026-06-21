/**
 * Icon.jsx — Conjunto de ícones SVG inline (line icons).
 *
 * Cor herdada via currentColor; tamanho e espessura configuráveis.
 * Logos preenchidos das lojas (Apple / Google Play) NÃO ficam aqui —
 * eles vivem inline no StoreBadges, pois são preenchidos, não de linha.
 */
const PATHS = {
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 7V4M9 13h.01M15 13h.01" />
    </>
  ),
  whatsapp: <path d="M3 21l1.6-4.5A8 8 0 1 1 12 20a8 8 0 0 1-4-1.1L3 21z" />,
  flame: (
    <path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .2 1 .8 1.5 1.5 1.5C10.5 9 9 7 12 3z" />
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  check: <path d="M20 6L9 17l-5-5" />,
}

export default function Icon({ name, size = 24, stroke = 2, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  )
}
