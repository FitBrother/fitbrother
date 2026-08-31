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
            {/* Logo da marca — lockup horizontal real */}
            <div className="footer__brand-logo">
              <img src="/brand/logo-horizontal-menta.png" alt="FitBrother" />
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
                <a href="https://www.fitbrother.app" className="footer__link">
                  Usar agora
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
                <a href="/termos" className="footer__link">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="/privacidade" className="footer__link">
                  Privacidade
                </a>
              </li>
              <li>
                <a href="/exclusao-de-dados" className="footer__link">
                  Exclusão de dados
                </a>
              </li>
              <li>
                <a href="/aviso-de-saude" className="footer__link">
                  Saúde e IA
                </a>
              </li>
              <li>
                <a href="/cookies" className="footer__link">
                  Cookies
                </a>
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
