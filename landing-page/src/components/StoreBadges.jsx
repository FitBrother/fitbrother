/**
 * StoreBadges.jsx — Badges de download das lojas (App Store / Google Play).
 *
 * Links placeholder (href="#") até a publicação do app.
 * Logos preenchidos inline (não combinam com o set de ícones de linha).
 */

const AppleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.54c-.02-2.06 1.68-3.05 1.76-3.1-0.96-1.4-2.46-1.6-2.99-1.62-1.27-.13-2.48.75-3.13.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.39 2.05-1.44 2.5-.37 6.2 1.03 8.23.69.99 1.51 2.1 2.58 2.06 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.7.65 1.12-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.27 1.13-2.33-.02-.01-2.17-.83-2.19-3.3zM15 6.84c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.4 1.23-.53.61-.99 1.59-.87 2.52.91.07 1.85-.46 2.42-1.15z" />
  </svg>
)

const GooglePlayLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#06D59F" d="M3.6 2.6c-.25.27-.4.68-.4 1.2v16.4c0 .52.15.93.4 1.2l9-9.6-9-9.2z" />
    <path fill="currentColor" d="M16.5 8.9l-3.3-1.9-2.9 3.1 2.9 3.1 3.3-1.9c1-.6 1-1.9 0-2.5z" />
    <path fill="currentColor" opacity=".85" d="M3.6 2.6l9 9.2 2.9-3.1L5.6 1.9c-.8-.46-1.6-.36-2 .7z" />
    <path fill="currentColor" opacity=".7" d="M3.6 21.4l9-9.6 2.9 3.1-9.9 5.7c-.8.46-1.6.36-2-.7z" />
  </svg>
)

export default function StoreBadges({ className = '' }) {
  return (
    <div className={`store-badges ${className}`}>
      {/* TODO: link real da loja */}
      <a href="#" className="store-badge" aria-label="Baixar na App Store">
        <AppleLogo />
        <span>
          <small>Baixar na</small>
          <strong>App Store</strong>
        </span>
      </a>
      {/* TODO: link real da loja */}
      <a href="#" className="store-badge" aria-label="Disponível no Google Play">
        <GooglePlayLogo />
        <span>
          <small>Disponível no</small>
          <strong>Google Play</strong>
        </span>
      </a>
    </div>
  )
}
