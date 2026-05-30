/**
 * App.jsx — Componente principal da Landing Page do FitBrother
 * 
 * Este componente organiza todas as seções da landing page em uma
 * única página (Single Page Application). Ele gerencia:
 * 
 * - Estado do modal de instalação (abrir/fechar)
 * - Inicialização das animações de scroll-reveal
 * - Composição de todas as seções na ordem correta
 * 
 * Estrutura da página:
 * 1. Navbar (fixa no topo)
 * 2. Hero (seção principal com CTA)
 * 3. Features (funcionalidades do app)
 * 4. HowItWorks (como funciona em 3 passos)
 * 5. AppPreview (preview visual do app)
 * 6. Team (equipe com links do LinkedIn)
 * 7. Footer (rodapé)
 * 8. InstallModal (popup de instalação — sobrepõe tudo)
 */

import { useState } from 'react'

/* === Importação dos Componentes === */
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import AppPreview from './components/AppPreview'
import Team from './components/Team'
import Footer from './components/Footer'
import InstallModal from './components/InstallModal'

/* === Hook de animações de scroll === */
import useScrollReveal from './hooks/useScrollReveal'

/**
 * Componente raiz da landing page
 * 
 * Gerencia o estado global do modal de instalação e
 * inicializa o sistema de animações ao rolar a página.
 */
function App() {
  /**
   * Estado que controla a visibilidade do modal de instalação
   * Quando true, o modal aparece sobrepondo todo o conteúdo
   */
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false)

  /**
   * Função para abrir o modal de instalação
   * Passada como prop para Navbar e Hero
   */
  const handleInstallClick = () => {
    setIsInstallModalOpen(true)
  }

  /**
   * Função para fechar o modal de instalação
   * Passada como prop para o InstallModal
   */
  const handleInstallClose = () => {
    setIsInstallModalOpen(false)
  }

  /**
   * Inicializa o IntersectionObserver para detectar
   * elementos com classe .reveal e ativar animações
   * quando entram no viewport ao rolar a página
   */
  useScrollReveal()

  return (
    <>
      {/* === Barra de navegação fixa no topo === */}
      <Navbar onInstallClick={handleInstallClick} />

      {/* === Conteúdo principal da página === */}
      <main>
        {/* Seção Hero — primeira impressão do visitante */}
        <Hero onInstallClick={handleInstallClick} />

        {/* Seção de Funcionalidades — por que usar o FitBrother */}
        <Features />

        {/* Seção Como Funciona — 3 passos simples */}
        <HowItWorks />

        {/* Seção Preview do App — visual do aplicativo */}
        <AppPreview />

        {/* Seção Equipe — integrantes com LinkedIn */}
        <Team />
      </main>

      {/* === Rodapé === */}
      <Footer />

      {/* === Modal de Instalação (Apple/Android) === */}
      {/* Renderizado sempre, mas só visível quando isOpen=true */}
      <InstallModal 
        isOpen={isInstallModalOpen} 
        onClose={handleInstallClose} 
      />
    </>
  )
}

export default App
