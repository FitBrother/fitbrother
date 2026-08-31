/**
 * FinalCta.jsx — Faixa de CTA final em menta sólida.
 *
 * Injeta a energia da marca uma vez antes do footer.
 *
 * Classes CSS na seção final-cta do index.css.
 */

import StoreBadges from './StoreBadges'

const FinalCta = () => (
  <section id="download" className="final-cta">
    <div className="container final-cta__inner">
      <h2 className="final-cta__title">Sua primeira refeição leva oito segundos.</h2>
      <p className="final-cta__sub">Sem formulário, sem banco de alimentos, sem desculpa.</p>
      <a href="https://www.fitbrother.app" className="btn btn--outline btn--lg">
        Usar agora
      </a>
      <StoreBadges className="final-cta__badges" />
    </div>
  </section>
)

export default FinalCta
