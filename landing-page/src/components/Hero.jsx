/**
 * Hero.jsx — Seção principal (banner) da landing page
 * 
 * Esta é a primeira seção que o visitante vê. Contém:
 * - Background escuro com gradiente e orbes decorativas
 * - Título impactante com texto em gradiente
 * - Subtítulo descritivo do app
 * - Botões de ação: "Instalar App" e "Ver no GitHub"
 * - Métricas de destaque (IA, WhatsApp, Streaks)
 * - Imagem/mockup do app com animação flutuante
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 8 do index.css.
 */

/**
 * Componente Hero
 * @param {Object} props
 * @param {Function} props.onInstallClick — Callback para abrir o modal de instalação
 */
const Hero = ({ onInstallClick }) => {
  return (
    /* Seção hero — ocupa toda a viewport com gradiente escuro */
    <section className="hero" id="hero">

      {/* === Orbes decorativas — brilhos ambientais no fundo === */}
      {/* Orbe primário — teal, canto superior direito */}
      <div className="hero__orb hero__orb--primary"></div>
      {/* Orbe secundário — roxo, canto inferior esquerdo */}
      <div className="hero__orb hero__orb--secondary"></div>
      {/* Orbe terciário — teal pulsante no centro */}
      <div className="hero__orb hero__orb--accent"></div>

      {/* Grid principal — duas colunas: texto + imagem */}
      <div className="container hero__grid">

        {/* === Coluna esquerda — conteúdo textual === */}
        <div className="hero__content">

          {/* Badge decorativo acima do título */}
          <div className="hero__badge">
            🍏 App de nutrição com IA
          </div>

          {/* Título principal — destaque visual com gradiente na palavra "IA" */}
          <h1 className="hero__title">
            Registre suas refeições com{' '}
            <span className="text-gradient">IA</span>.
          </h1>

          {/* Descrição do app — explica o diferencial */}
          <p className="hero__description">
            Fale ou escreva o que comeu — no app ou no WhatsApp — e a IA calcula 
            tudo. Gamificação estilo Duolingo para manter você motivado.
          </p>

          {/* Botões de ação (CTA) */}
          <div className="hero__actions">
            {/* Botão primário — abre o modal de instalação */}
            <button className="btn btn--primary btn--lg" onClick={onInstallClick}>
              📱 Instalar App
            </button>

            {/* Botão secundário — link para o repositório GitHub */}
            <a
              href="https://github.com/FitBrother/fitbrother"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline btn--lg"
            >
              {/* Ícone SVG do GitHub */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Ver no GitHub
            </a>
          </div>

          {/* Métricas de destaque — números que impressionam */}
          <div className="hero__metrics">
            <div className="hero__metric">
              <span className="hero__metric-value">🤖</span>
              <span className="hero__metric-label">IA Nutricional</span>
            </div>
            <div className="hero__metric">
              <span className="hero__metric-value">📱💬</span>
              <span className="hero__metric-label">App + WhatsApp</span>
            </div>
            <div className="hero__metric">
              <span className="hero__metric-value">🔥</span>
              <span className="hero__metric-label">Streaks Diários</span>
            </div>
          </div>
        </div>

        {/* === Coluna direita — imagem/mockup do app === */}
        <div className="hero__image">
          {/* Brilho atrás da imagem */}
          <div className="hero__image-glow"></div>

          {/* Mockup do app com animação flutuante (CSS keyframe "float") */}
          <img 
            src="/images/hero-mockup.png" 
            alt="FitBrother App — Dashboard com macros e refeições"
            className="hero__mockup"
          />
        </div>
      </div>
    </section>
  )
}

export default Hero
