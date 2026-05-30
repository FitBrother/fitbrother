/**
 * Navbar.jsx — Barra de navegação fixa no topo da página
 * 
 * Funcionalidades:
 * - Logo "FitBrother" com emoji 🍏
 * - Links de navegação com scroll suave para âncoras (#features, #how-it-works, #team)
 * - Botão "Instalar App" que abre o modal de instalação
 * - Efeito glassmorphism (fundo translúcido com blur) via CSS
 * - Detecta scroll para aplicar classe "scrolled" (fundo mais opaco + sombra)
 * - Menu hambúrguer para mobile com animação de X
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 7 do index.css.
 */

import { useState, useEffect } from 'react'

/**
 * Componente Navbar
 * @param {Object} props
 * @param {Function} props.onInstallClick — Callback executado ao clicar em "Instalar App"
 */
const Navbar = ({ onInstallClick }) => {
  /* Estado que indica se o usuário já rolou a página (> 50px) */
  const [scrolled, setScrolled] = useState(false)

  /* Estado que controla se o menu mobile está aberto ou fechado */
  const [menuOpen, setMenuOpen] = useState(false)

  /**
   * Efeito para monitorar o scroll da página.
   * Quando scrollY > 50, aplica a classe "scrolled" na navbar.
   */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)

    /* Cleanup: remove o listener ao desmontar o componente */
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  /**
   * Fecha o menu mobile quando um link é clicado.
   * Garante que a navegação por âncora funcione no mobile.
   */
  const handleNavClick = () => {
    setMenuOpen(false)
  }

  /**
   * Array de links de navegação.
   * Cada link aponta para uma âncora (id) da página.
   * Para adicionar novos links, basta adicionar um objeto aqui.
   */
  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'Como Funciona' },
    { href: '#team', label: 'Equipe' },
  ]

  return (
    /* Navbar fixa — classes CSS definidas na seção 7 do index.css */
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar__inner">

        {/* Logo do FitBrother com emoji */}
        <a href="#" className="navbar__logo">
          <span className="navbar__logo-icon">🍏</span>
          Fit<span className="navbar__logo-accent">Brother</span>
        </a>

        {/* Links de navegação — visíveis no desktop, menu overlay no mobile */}
        <div className={`navbar__links ${menuOpen ? 'active' : ''}`}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="navbar__link"
              onClick={handleNavClick}
            >
              {link.label}
            </a>
          ))}

          {/* Botão CTA dentro do menu mobile (duplicado do desktop) */}
          <button
            className="btn btn--primary navbar__cta"
            onClick={() => {
              onInstallClick()
              handleNavClick()
            }}
          >
            Instalar App
          </button>
        </div>

        {/* Botão CTA no desktop (fora do menu mobile) */}
        <button
          className="btn btn--primary navbar__cta navbar__cta--desktop"
          onClick={onInstallClick}
        >
          Instalar App
        </button>

        {/* Botão hambúrguer — visível apenas no mobile (display:none no desktop via CSS) */}
        <button
          className={`navbar__hamburger ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menu de navegação"
        >
          {/* Três linhas que se transformam em X quando ativo */}
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  )
}

export default Navbar
