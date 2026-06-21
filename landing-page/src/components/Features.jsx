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
import Icon from './Icon'

const featuresData = [
  {
    icon: 'mic',
    title: 'Registro por voz e texto',
    description: 'Fale ou escreva o que comeu em linguagem natural. Sem formulários, sem busca manual.',
  },
  {
    icon: 'bot',
    title: 'IA que calcula macros',
    description: 'A IA identifica os alimentos e calcula calorias, proteínas, carboidratos e gorduras.',
  },
  {
    icon: 'whatsapp',
    title: 'WhatsApp integrado',
    description: 'Registre direto pelo WhatsApp. Tudo sincroniza em tempo real com o app.',
  },
  {
    icon: 'flame',
    title: 'Gamificação social',
    description: 'Streaks diários, conquistas e ranking semanal com amigos. Estilo Duolingo para nutrição.',
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
              {/* Ícone SVG em círculo menta */}
              <div className="feature-card__icon">
                <Icon name={feature.icon} size={26} />
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
