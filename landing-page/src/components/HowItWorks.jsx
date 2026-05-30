/**
 * HowItWorks.jsx — Seção "Como Funciona"
 * 
 * Mostra os 3 passos para usar o FitBrother:
 * 1. Fale ou Escreva — entrada por voz/texto
 * 2. A IA Faz o Trabalho — processamento automático
 * 3. Acompanhe e Compita — dashboard + gamificação
 * 
 * Layout alternado: imagem alterna entre esquerda e direita a cada step.
 * Linha vertical conecta os passos (via CSS pseudo-element).
 * Animações de scroll-reveal com direções alternadas.
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 10 do index.css.
 */

/**
 * Dados dos passos do fluxo.
 * Cada step tem número, título, descrição e caminho da imagem.
 * Para adicionar novos passos, basta adicionar objetos a este array.
 */
const stepsData = [
  {
    number: '01',
    title: 'Fale ou Escreva',
    description: 'Abra o app ou mande um WhatsApp. Diga naturalmente: "Comi 2 ovos e um café com leite". Sem formulários complicados.',
    image: '/images/whatsapp.png',
    imageAlt: 'Interface de chat do WhatsApp com o bot nutricional FitBrother',
  },
  {
    number: '02',
    title: 'A IA Faz o Trabalho',
    description: 'Nossa inteligência artificial transcreve áudios, identifica cada alimento e calcula os macronutrientes automaticamente.',
    image: '/images/how-it-works.png',
    imageAlt: 'Fluxo de processamento da IA — do áudio aos macronutrientes',
  },
  {
    number: '03',
    title: 'Acompanhe e Compita',
    description: 'Dashboard em tempo real com seus macros. Mantenha seu streak, desbloqueie conquistas e suba no ranking dos amigos.',
    image: '/images/gamification.png',
    imageAlt: 'Tela de gamificação — streaks, conquistas e ranking',
  },
]

/**
 * Componente HowItWorks
 * Renderiza a seção com os 3 passos do fluxo do app.
 */
const HowItWorks = () => {
  return (
    /* Seção com id para navegação por âncora (#how-it-works) */
    <section id="how-it-works" className="section">
      <div className="container">

        {/* Cabeçalho centralizado da seção */}
        <div className="section__header reveal">
          <h2 className="section__title">Como Funciona</h2>
          <p className="section__subtitle">
            Três passos simples para controlar sua nutrição.
          </p>
        </div>

        {/* Container dos passos com linha vertical de conexão */}
        <div className="steps">
          {stepsData.map((step, index) => (
            /**
             * Cada step alterna automaticamente a direção
             * via CSS (nth-child:even inverte o grid com direction: rtl).
             * A classe reveal--left/right cria animação de direção oposta.
             */
            <div
              key={step.number}
              className={`step reveal ${index % 2 === 0 ? 'reveal--left' : 'reveal--right'}`}
            >
              {/* Conteúdo textual do passo */}
              <div className="step__content">
                {/* Número do passo em círculo gradiente */}
                <div className="step__number">{step.number}</div>

                {/* Título do passo */}
                <h3 className="step__title">{step.title}</h3>

                {/* Descrição do passo */}
                <p className="step__description">{step.description}</p>
              </div>

              {/* Imagem ilustrativa do passo */}
              <div className="step__image">
                <img src={step.image} alt={step.imageAlt} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
