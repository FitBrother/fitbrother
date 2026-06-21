/**
 * Hero.jsx — Seção principal (banner) da landing page
 *
 * Direção Dark Premium. Contém:
 * - Fundo escuro com gradiente radial e orbe de brilho menta
 * - Título impactante com destaque em menta
 * - Subtítulo descritivo do app
 * - Badges das lojas (App Store / Google Play)
 * - Chips de destaque (IA · App+WhatsApp · Streaks)
 * - Telefone construído em CSS com anel de calorias + macros
 *   (o slot data-screenshot="dashboard" recebe print real na Task 12)
 *
 * Classes CSS na seção 8 do index.css.
 */

import StoreBadges from './StoreBadges'
import CalorieRing from './brand/CalorieRing'
import MacroChips from './brand/MacroChips'

const Hero = () => (
  <section className="hero" id="hero">
    {/* Orbe de brilho menta no fundo */}
    <div className="hero__orb hero__orb--primary"></div>

    <div className="container hero__grid">
      {/* Coluna esquerda — conteúdo textual */}
      <div className="hero__content">
        <div className="hero__badge">🤖 Nutrição com IA</div>

        <h1 className="hero__title">
          Registre o que comeu <span className="text-menta">só falando.</span>
        </h1>

        <p className="hero__description">
          Fale ou escreva o que comeu — no app ou no WhatsApp — e a IA calcula tudo: calorias,
          proteínas, carboidratos e gorduras. Com gamificação estilo Duolingo pra te manter no ritmo.
        </p>

        <StoreBadges className="hero__badges" />

        <div className="hero__metrics">
          <div className="hero__metric">
            <span className="hero__metric-value">IA</span>
            <span className="hero__metric-label">Nutricional</span>
          </div>
          <div className="hero__metric">
            <span className="hero__metric-value">App + Zap</span>
            <span className="hero__metric-label">Sincronizado</span>
          </div>
          <div className="hero__metric">
            <span className="hero__metric-value">Streaks</span>
            <span className="hero__metric-label">Diários</span>
          </div>
        </div>
      </div>

      {/* Coluna direita — telefone construído em CSS */}
      <div className="hero__image">
        <div className="hero__image-glow"></div>
        {/* Telefone CSS — print real entra na Task 12 (data-screenshot="dashboard") */}
        <div className="phone-frame" data-screenshot="dashboard">
          <div className="phone-frame__top">
            <span>9:41</span>
            <span>FitBrother</span>
          </div>
          <CalorieRing value={1247} total={2000} size={160} />
          <MacroChips />
          <div className="phone-frame__meal">
            <div className="phone-frame__meal-label">CAFÉ DA MANHÃ · 07:30</div>
            <div className="phone-frame__meal-name">Ovos mexidos, pão integral, café</div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default Hero
