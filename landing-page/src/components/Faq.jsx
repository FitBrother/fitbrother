/**
 * Faq.jsx — Seção de perguntas frequentes (acordeão acessível).
 *
 * Usa <details>/<summary> nativos: acessível por teclado e sem estado JS.
 * O chevron (Icon) gira quando o item está aberto via CSS.
 *
 * Classes CSS na seção FAQ do index.css.
 */

import Icon from './Icon'

const faqs = [
  {
    q: 'Meus dados ficam seguros?',
    a: 'Sim. Seus registros são privados e você pode exportar ou apagar tudo quando quiser, conforme a LGPD.',
  },
  {
    q: 'Preciso de balança ou pesar a comida?',
    a: 'Não. Descreva naturalmente ("2 ovos e um café com leite") e a IA estima as porções e os macros pra você.',
  },
  {
    q: 'Funciona mesmo pelo WhatsApp?',
    a: 'Funciona. Mande texto ou áudio pro nosso número e o registro sincroniza no app em tempo real.',
  },
  {
    q: 'O FitBrother é grátis?',
    a: 'Você começa de graça. Recursos avançados podem fazer parte de um plano no futuro.',
  },
]

const Faq = () => (
  <section id="faq" className="section">
    <div className="container">
      <div className="section__header reveal">
        <h2 className="section__title">Perguntas frequentes</h2>
      </div>

      <div className="faq">
        {faqs.map((f, i) => (
          <details className="faq__item reveal" key={i}>
            <summary className="faq__q">
              {f.q}
              <Icon name="chevron" size={20} />
            </summary>
            <p className="faq__a">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
)

export default Faq
