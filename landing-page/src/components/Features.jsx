/**
 * Features.jsx — Seção "Por que o FitBrother?"
 * 
 * Exibe 5 cards com as funcionalidades principais do app:
 * 1. Registro por Voz e Texto
 * 2. Registro por Foto
 * 3. IA que Calcula Macros
 * 4. Gamificação Social
 * 5. WhatsApp Integrado (ainda não lançado — leva selo "Em breve")
 *
 * Cada card possui:
 * - Ícone SVG em círculo menta
 * - Título descritivo, com selo opcional (`badge`)
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
    icon: 'camera',
    title: 'Registro por foto',
    description: 'Fotografe o prato e a IA identifica os alimentos. Produto embalado? Escaneie o código de barras.',
  },
  {
    icon: 'bot',
    title: 'IA que calcula macros',
    description: 'A IA identifica os alimentos e calcula calorias, proteínas, carboidratos e gorduras.',
  },
  {
    icon: 'flame',
    title: 'Gamificação social',
    description: 'Streaks diários, conquistas e ranking semanal com amigos. Estilo Duolingo para nutrição.',
  },
  {
    icon: 'whatsapp',
    title: 'WhatsApp integrado',
    badge: 'Em breve',
    description: 'Estamos construindo o registro direto pelo WhatsApp, sincronizando em tempo real com o app.',
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

              {/* Título — com selo quando a funcionalidade ainda não está no ar */}
              <h3 className="feature-card__title">
                {feature.title}
                {feature.badge && <span className="feature-card__badge">{feature.badge}</span>}
              </h3>

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
