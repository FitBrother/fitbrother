/**
 * FinalCta.jsx — Faixa de CTA final em menta sólida.
 *
 * Injeta a energia da marca uma vez antes do footer.
 * id="download" é o alvo do CTA "Baixar" da navbar.
 *
 * Classes CSS na seção final-cta do index.css.
 */

import StoreBadges from './StoreBadges'

const FinalCta = () => (
  <section id="download" className="final-cta">
    <div className="container final-cta__inner">
      <h2 className="final-cta__title">Sua dieta, no modo jogo.</h2>
      <p className="final-cta__sub">
        Baixe o FitBrother e registre sua primeira refeição em segundos.
      </p>
      <StoreBadges className="final-cta__badges" />
    </div>
  </section>
)

export default FinalCta
