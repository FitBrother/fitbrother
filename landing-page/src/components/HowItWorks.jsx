/**
 * HowItWorks.jsx — Seção "Como Funciona"
 *
 * Mostra os 3 passos para usar o FitBrother:
 * 1. Fale ou Escreva — entrada por voz/texto/WhatsApp
 * 2. A IA Faz o Trabalho — transcrição + cálculo de macros
 * 3. Acompanhe e Compita — dashboard + gamificação
 *
 * Layout alternado: o visual alterna entre esquerda e direita a cada step.
 * Cada passo tem um slot visual (`data-screenshot`) que recebe print real
 * na Task 12; até lá, mostra um componente da marca como fallback de alta
 * qualidade.
 *
 * Classes CSS na seção 10 do index.css.
 */

import CalorieRing from './brand/CalorieRing'
import MacroChips from './brand/MacroChips'
import LeaderboardRow from './brand/LeaderboardRow'
import DottedChart from './brand/DottedChart'

const stepsData = [
  {
    number: '01',
    shot: 'whatsapp',
    title: 'Fale ou escreva',
    description:
      'Abra o app ou mande um WhatsApp. Diga naturalmente: "Comi 2 ovos e um café com leite". Sem formulários complicados.',
    imageAlt: 'Conversa de WhatsApp registrando uma refeição',
  },
  {
    number: '02',
    shot: 'ai-flow',
    title: 'A IA faz o trabalho',
    description:
      'A inteligência artificial transcreve áudios, identifica cada alimento e calcula os macronutrientes automaticamente.',
    imageAlt: 'Resultado da IA — calorias e macronutrientes',
  },
  {
    number: '03',
    shot: 'gamification',
    title: 'Acompanhe e compita',
    description:
      'Dashboard em tempo real com seus macros. Mantenha seu streak, desbloqueie conquistas e suba no ranking dos amigos.',
    imageAlt: 'Ranking semanal e aderência da semana',
  },
]

/** Conteúdo de fallback por passo — substituído por print real na Task 12. */
const StepVisual = ({ shot }) => {
  if (shot === 'whatsapp') {
    return (
      <div className="wa-chat">
        <div className="wa-bubble wa-bubble--out">Comi 2 ovos e um café com leite ☕</div>
        <div className="wa-bubble wa-bubble--in">
          Anotado! <strong>210 kcal</strong> · 15g proteína · 8g carbo · 12g gordura
        </div>
      </div>
    )
  }
  if (shot === 'ai-flow') {
    return (
      <div className="step-card">
        <CalorieRing value={1247} total={2000} size={140} />
        <MacroChips />
      </div>
    )
  }
  return (
    <div className="step-card">
      <LeaderboardRow rank={1} name="Emily R." value="18 dias 🔥" />
      <LeaderboardRow rank={2} name="Você" value="14 dias 🔥" you />
      <LeaderboardRow rank={3} name="Alex C." value="11 dias 🔥" />
      <DottedChart />
    </div>
  )
}

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="section">
      <div className="container">
        <div className="section__header reveal">
          <h2 className="section__title">Como funciona</h2>
          <p className="section__subtitle">Três passos simples para controlar sua nutrição.</p>
        </div>

        <div className="steps">
          {stepsData.map((step, index) => (
            <div
              key={step.number}
              className={`step reveal ${index % 2 === 0 ? 'reveal--left' : 'reveal--right'}`}
            >
              <div className="step__content">
                <div className="step__number">{step.number}</div>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__description">{step.description}</p>
              </div>

              <div className="step__image">
                <div className="screen-slot" data-screenshot={step.shot} aria-label={step.imageAlt}>
                  <StepVisual shot={step.shot} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
