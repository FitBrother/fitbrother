/**
 * HowItWorks.jsx — Seção "Como Funciona"
 *
 * Mostra os 3 passos para usar o FitBrother:
 * 1. Fale, Escreva ou Fotografe — entrada por voz/texto/foto
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

import Icon from './Icon'
import CalorieRing from './brand/CalorieRing'
import MacroChips from './brand/MacroChips'
import LeaderboardRow from './brand/LeaderboardRow'
import DottedChart from './brand/DottedChart'

const stepsData = [
  {
    number: '01',
    shot: 'capture',
    title: 'Diga — ou mostre — o que comeu',
    description:
      'Um áudio de oito segundos, uma frase digitada ou uma foto do prato. O que for mais rápido na hora.',
    imageAlt: 'Foto de um prato com os alimentos identificados pela IA',
  },
  {
    number: '02',
    shot: 'ai-flow',
    title: 'A IA faz a conta',
    description:
      'Transcrição, identificação dos alimentos e cálculo dos macros. Se algo saiu errado, é um toque pra corrigir.',
    imageAlt: 'Resultado da IA — calorias e macronutrientes',
  },
  {
    number: '03',
    shot: 'gamification',
    title: 'Volte amanhã',
    description:
      'Ofensiva, conquistas e ranking semanal com os amigos. O hábito é a parte difícil — essa é a parte que a gente resolve.',
    imageAlt: 'Ranking semanal e aderência da semana',
  },
]

/** Conteúdo de fallback por passo — substituído por print real na Task 12. */
const StepVisual = ({ shot }) => {
  if (shot === 'capture') {
    return (
      <div className="capture">
        {/* Moldura do prato — placeholder gráfico, não foto real */}
        <div className="capture__frame">
          <div className="capture__shutter">
            <Icon name="camera" size={26} />
          </div>
        </div>
        <div className="capture__caption">Identificado na foto</div>
        <div className="capture__items">
          <span className="capture__item">Frango grelhado</span>
          <span className="capture__item">Arroz integral</span>
          <span className="capture__item">Brócolis</span>
        </div>
        <div className="capture__result">
          <strong>538 kcal</strong> · 42g proteína · 54g carbo · 14g gordura
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
          <span className="section__eyebrow">Como funciona</span>
          <h2 className="section__title">Três passos e pronto</h2>
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
