/**
 * AppPreview.jsx — Seção "Veja o App em Ação"
 * 
 * Mostra uma prévia visual do app com:
 * - Imagem grande centralizada do mockup do dashboard
 * - Efeito de brilho (glow) radial atrás da imagem
 * - Animação flutuante contínua
 * - 3 highlights de funcionalidades abaixo da imagem
 * 
 * A imagem usa animação reveal--zoom (zoom-in suave ao entrar na viewport).
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 11 do index.css.
 */

/**
 * Dados dos highlights exibidos abaixo da imagem.
 * Cada highlight tem ícone, título e descrição curta.
 */
const highlightsData = [
  {
    icon: '📊',
    title: 'Dashboard Inteligente',
    description: 'Visualize seus macros em tempo real',
  },
  {
    icon: '🎯',
    title: 'Metas Personalizadas',
    description: 'Calorias e macros ajustados ao seu objetivo',
  },
  {
    icon: '🏆',
    title: 'Conquistas',
    description: 'Desbloqueie badges e suba no ranking',
  },
]

/**
 * Componente AppPreview
 * Renderiza a prévia visual do aplicativo com highlights.
 */
const AppPreview = () => {
  return (
    /* Seção com fundo alternado para contraste visual */
    <section id="app-preview" className="section section--alt">
      <div className="container">

        {/* Cabeçalho centralizado da seção */}
        <div className="section__header reveal">
          <h2 className="section__title">Veja o App em Ação</h2>
          <p className="section__subtitle">
            Design moderno e intuitivo. Tudo que você precisa em um só lugar.
          </p>
        </div>

        {/* Container do preview — centralizado com glow */}
        <div className="app-preview">
          {/* Brilho radial atrás da imagem — efeito visual premium */}
          <div className="app-preview__glow"></div>

          {/* Imagem do mockup com animação de zoom ao scroll + float contínuo */}
          <div className="app-preview__image reveal reveal--zoom">
            <img
              src="/images/hero-mockup.png"
              alt="FitBrother App — Dashboard completo com macros, refeições e progresso"
            />
          </div>
        </div>

        {/* Grid de highlights — 3 cards informativos abaixo da imagem */}
        <div className="features__grid" style={{ marginTop: '64px' }}>
          {highlightsData.map((highlight, index) => (
            /**
             * Reutiliza a classe feature-card do grid de features
             * para manter consistência visual.
             */
            <div
              key={index}
              className={`feature-card reveal reveal-delay-${index + 1}`}
            >
              {/* Ícone do highlight */}
              <div className="feature-card__icon">
                <span role="img" aria-label={highlight.title}>
                  {highlight.icon}
                </span>
              </div>

              {/* Título do highlight */}
              <h3 className="feature-card__title">{highlight.title}</h3>

              {/* Descrição do highlight */}
              <p className="feature-card__description">{highlight.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default AppPreview
