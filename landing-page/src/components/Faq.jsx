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
    q: 'Preciso pesar a comida?',
    a: 'Não. Descreva do jeito que você fala — "dois ovos e uma fatia de pão" — e a IA estima as porções. Se quiser precisão, dá pra ajustar a quantidade depois.',
  },
  {
    q: 'Dá pra registrar por foto?',
    a: 'Dá. Fotografe o prato e a IA identifica os alimentos e estima os macros. Se o produto for embalado, dá pra escanear o código de barras.',
  },
  {
    q: 'Funciona pelo WhatsApp?',
    a: 'Ainda não — está em desenvolvimento. Por enquanto você registra por voz, texto ou foto direto no app, inclusive pelo navegador.',
  },
  {
    q: 'Meus dados são meus?',
    a: 'São. Você pode exportar tudo ou apagar a conta inteira direto nas configurações, a qualquer momento.',
  },
  {
    q: 'Tem versão web?',
    a: 'Tem — e é por onde estamos começando. O mesmo app roda no navegador, com layout adaptado pra tablet e desktop.',
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
