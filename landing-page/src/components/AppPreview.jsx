/**
 * AppPreview.jsx — Seção "Tudo num lugar só"
 *
 * Seção clara (--mist) para quebrar o ritmo dark da página.
 * Vitrine com 3 cards: dashboard (slot de print), ranking de amigos
 * e aderência da semana — usando as primitivas da marca.
 *
 * O card de dashboard tem data-screenshot="dashboard" para receber
 * print real na Task 12.
 *
 * Classes CSS na seção 11 do index.css.
 */

import LeaderboardRow from './brand/LeaderboardRow'
import DottedChart from './brand/DottedChart'
import CalorieRing from './brand/CalorieRing'
import MacroChips from './brand/MacroChips'

const AppPreview = () => {
  return (
    <section id="preview" className="section section--light app-preview">
      <div className="container">
        <div className="section__header reveal">
          <h2 className="section__title">Tudo num lugar só</h2>
          <p className="section__subtitle">
            Dashboard em tempo real, ranking de amigos e sua semana num olhar.
          </p>
        </div>

        <div className="preview__grid">
          {/* Dashboard — slot para print real (Task 12) */}
          <div className="preview__card preview__card--dark" data-screenshot="dashboard">
            <h3 className="preview__card-title">Seu dia</h3>
            <div className="preview__dash">
              <CalorieRing value={1247} total={2000} size={150} />
              <MacroChips />
            </div>
          </div>

          {/* Ranking semanal */}
          <div className="preview__card preview__card--dark">
            <h3 className="preview__card-title">Ranking semanal</h3>
            <LeaderboardRow rank={1} name="Emily R." value="18 dias" />
            <LeaderboardRow rank={2} name="Você" value="14 dias" you />
            <LeaderboardRow rank={3} name="Alex C." value="11 dias" />
          </div>

          {/* Aderência da semana */}
          <div className="preview__card preview__card--dark">
            <h3 className="preview__card-title">Sua semana</h3>
            <DottedChart />
            <p className="preview__card-note">5 de 7 dias no alvo. Bora fechar a semana! 🔥</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AppPreview
