/**
 * App.jsx — Componente principal da Landing Page do FitBrother
 *
 * Composição (Single Page):
 * 1. Navbar (fixa no topo)
 * 2. Hero
 * 3. Features (diferenciais)
 * 4. HowItWorks (3 passos)
 * 5. AppPreview (vitrine — seção clara)
 * 6. Faq
 * 7. FinalCta (faixa menta + download)
 * 8. Footer
 *
 * Inicializa as animações de scroll-reveal via useScrollReveal.
 */

import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import AppPreview from './components/AppPreview'
import Faq from './components/Faq'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'

import useScrollReveal from './hooks/useScrollReveal'

function App() {
  useScrollReveal()

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <AppPreview />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}

export default App
