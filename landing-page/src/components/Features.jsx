/**
 * Features.jsx — Seção "Por que o FitBrother?"
 * 
 * Exibe 4 cards com as funcionalidades principais do app:
 * 1. Registro por Voz e Texto
 * 2. IA que Calcula Macros
 * 3. WhatsApp Integrado
 * 4. Gamificação Social
 * 
 * Cada card possui:
 * - Ícone emoji em círculo com gradiente
 * - Título descritivo
 * - Descrição curta
 * - Animação de scroll-reveal com delay escalonado (cascata)
 * - Efeito hover: card sobe + sombra aumenta
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 9 do index.css.
 */

/**
 * Dados das funcionalidades do app.
 * Para adicionar ou modificar uma funcionalidade,
 * basta editar este array. Os cards são gerados automaticamente.
 */
const featuresData = [
  {
    icon: '🎤',
    title: 'Registro por Voz e Texto',
    description: 'Fale ou escreva o que comeu em linguagem natural. Sem formulários, sem busca manual.',
  },
  {
    icon: '🤖',
    title: 'IA que Calcula Macros',
    description: 'Inteligência artificial identifica os alimentos e calcula calorias, proteínas, carboidratos e gorduras.',
  },
  {
    icon: '💬',
    title: 'WhatsApp Integrado',
    description: 'Registre suas refeições direto pelo WhatsApp. Tudo sincroniza em tempo real com o app.',
  },
  {
    icon: '🔥',
    title: 'Gamificação Social',
    description: 'Streaks diários, conquistas, ranking semanal com amigos. Estilo Duolingo para nutrição.',
  },
]

/**
 * Componente Features
 * Renderiza a seção de funcionalidades com título, subtítulo e grid de cards.
 */
const Features = () => {
  return (
    /* Seção com id para navegação por âncora (#features) */
    <section id="features" className="section section--alt">
      <div className="container">

        {/* Cabeçalho centralizado da seção */}
        <div className="section__header reveal">
          <h2 className="section__title">Por que o FitBrother?</h2>
          <p className="section__subtitle">
            Tudo que você precisa para acompanhar sua nutrição de forma inteligente.
          </p>
        </div>

        {/* Grid responsivo com os 4 cards (4 → 2 → 1 colunas) */}
        <div className="features__grid">
          {featuresData.map((feature, index) => (
            /**
             * Card individual de funcionalidade.
             * As classes reveal-delay-{n} criam o efeito cascata —
             * cada card aparece com um pequeno atraso em relação ao anterior.
             */
            <div
              key={index}
              className={`feature-card reveal reveal-delay-${index + 1}`}
            >
              {/* Ícone em círculo com gradiente primário */}
              <div className="feature-card__icon">
                <span role="img" aria-label={feature.title}>
                  {feature.icon}
                </span>
              </div>

              {/* Título da funcionalidade */}
              <h3 className="feature-card__title">{feature.title}</h3>

              {/* Descrição curta da funcionalidade */}
              <p className="feature-card__description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
