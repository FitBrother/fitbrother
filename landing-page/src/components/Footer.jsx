/**
 * Footer.jsx — Rodapé da landing page
 * 
 * Contém:
 * - Logo "FitBrother" com tagline
 * - Links organizados em colunas: Projeto, Navegação, Legal
 * - Link para o GitHub
 * - Mensagem "Feito com 💚 no Brasil"
 * - Copyright com ano atual
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 13 do index.css.
 */

/**
 * Componente Footer
 * Renderiza o rodapé com informações de marca, links e copyright.
 */
const Footer = () => {
  return (
    /* Footer com fundo escuro */
    <footer className="footer">
      <div className="container">

        {/* Grid principal do footer — 4 colunas em desktop */}
        <div className="footer__inner">

          {/* === Coluna 1: Marca + Descrição === */}
          <div className="footer__brand">
            {/* Logo da marca */}
            <div className="footer__brand-logo">
              <img src="/brand/horizontal_logo_no_bg.png" alt="FitBrother" height="26" />
            </div>

            {/* Tagline do projeto */}
            <p className="footer__brand-description">
              App de nutrição com IA. Fale ou escreva o que comeu e acompanhe seus
              macros em tempo real.
            </p>
          </div>

          {/* === Coluna 2: Produto === */}
          <div>
            <h4 className="footer__column-title">Produto</h4>
            <ul className="footer__links">
              <li>
                <a href="#features" className="footer__link">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="footer__link">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="#preview" className="footer__link">
                  Preview
                </a>
              </li>
            </ul>
          </div>

          {/* === Coluna 3: Links de Navegação === */}
          <div>
            <h4 className="footer__column-title">Navegação</h4>
            <ul className="footer__links">
              <li>
                <a href="#faq" className="footer__link">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#download" className="footer__link">
                  Baixar
                </a>
              </li>
              <li>
                <a href="#hero" className="footer__link">
                  Topo
                </a>
              </li>
            </ul>
          </div>

          {/* === Coluna 4: Links Legais === */}
          <div>
            <h4 className="footer__column-title">Legal</h4>
            <ul className="footer__links">
              <li>
                <span className="footer__link">Termos de Uso</span>
              </li>
              <li>
                <span className="footer__link">Privacidade</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Linha divisória */}
        <div className="footer__divider"></div>

        {/* Barra inferior — copyright + crédito */}
        <div className="footer__bottom">
          <p>© 2026 FitBrother. Todos os direitos reservados.</p>
          <div className="footer__bottom-links">
            <span>Feito com 💚 no Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
