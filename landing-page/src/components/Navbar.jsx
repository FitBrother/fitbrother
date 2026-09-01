/**
 * Navbar.jsx — Barra de navegação fixa no topo da página
 *
 * Funcionalidades:
 * - Logo FitBrother (PNG horizontal da marca)
 * - Links de navegação com scroll suave para âncoras (#features, #how-it-works, #faq)
 * - CTA "Usar agora" que leva direto pro app web (/app)
 * - Efeito glassmorphism escuro via CSS
 * - Detecta scroll para aplicar classe "scrolled" (fundo mais opaco + borda)
 * - Menu hambúrguer para mobile com animação de X
 *
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 7 do index.css.
 */

import { useState, useEffect } from 'react'

const Navbar = () => {
  /* Estado que indica se o usuário já rolou a página (> 50px) */
  const [scrolled, setScrolled] = useState(false)

  /* Estado que controla se o menu mobile está aberto ou fechado */
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  /* Fecha o menu mobile ao clicar num link */
  const handleNavClick = () => {
    setMenuOpen(false)
  }

  const navLinks = [
    { href: '#features', label: 'Recursos' },
    { href: '#how-it-works', label: 'Como funciona' },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar__inner">
        {/* Logo do FitBrother — lockup horizontal real da marca */}
        <a href="#hero" className="navbar__logo" aria-label="FitBrother — início">
          <img src="/brand/logo-horizontal-menta.png" alt="" />
        </a>

        {/* Links de navegação — desktop inline, overlay no mobile */}
        <div className={`navbar__links ${menuOpen ? 'active' : ''}`}>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="navbar__link" onClick={handleNavClick}>
              {link.label}
            </a>
          ))}

          {/* CTA dentro do menu mobile */}
          <a
            href="https://app.fitbrother.app"
            className="btn btn--primary navbar__cta"
            onClick={handleNavClick}
          >
            Usar agora
          </a>
        </div>

        {/* CTA no desktop */}
        <a
          href="https://app.fitbrother.app"
          className="btn btn--primary navbar__cta navbar__cta--desktop"
        >
          Usar agora
        </a>

        {/* Botão hambúrguer — visível apenas no mobile */}
        <button
          className={`navbar__hamburger ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menu de navegação"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  )
}

export default Navbar
