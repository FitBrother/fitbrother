/**
 * InstallModal.jsx — Modal popup para instalação do app
 * 
 * Exibe um popup com duas opções de plataforma:
 * - Apple (iOS) — App Store
 * - Android — Google Play
 * 
 * Funcionalidades:
 * - Overlay escuro com blur que fecha ao clicar fora
 * - Animação de entrada: scale(0.9) → scale(1) com bounce
 * - Bloqueio de scroll do body quando aberto
 * - Badges "Disponível em breve" (links são placeholder #)
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 14 do index.css.
 */

import { useEffect } from 'react'

/**
 * Componente InstallModal
 * @param {Object} props
 * @param {boolean} props.isOpen — Controla se o modal está visível
 * @param {Function} props.onClose — Callback para fechar o modal
 */
const InstallModal = ({ isOpen, onClose }) => {

  /**
   * Efeito para bloquear o scroll do body quando o modal está aberto.
   * Restaura automaticamente quando o modal fecha ou o componente desmonta.
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    /* Cleanup: restaura o scroll ao desmontar */
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    /**
     * Overlay escuro com blur — cobre toda a tela.
     * Classe "active" controla visibilidade via CSS (opacity + visibility).
     * Clique no overlay fecha o modal.
     */
    <div
      className={`modal-overlay ${isOpen ? 'active' : ''}`}
      onClick={onClose}
    >
      {/* Card do modal — stopPropagation evita fechar ao clicar dentro */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        {/* Botão de fechar (X) no canto superior direito */}
        <button
          className="modal__close"
          onClick={onClose}
          aria-label="Fechar modal de instalação"
        >
          ✕
        </button>

        {/* Ícone decorativo do modal */}
        <div className="modal__icon">📱</div>

        {/* Título do modal */}
        <h2 className="modal__title">Instalar FitBrother</h2>

        {/* Instrução para o usuário */}
        <p className="modal__description">Escolha sua plataforma:</p>

        {/* Container das opções de download */}
        <div className="modal__options">

          {/* === Opção Apple (iOS) === */}
          <a href="#" className="modal__option">
            {/* Ícone SVG da Apple */}
            <div className="modal__option-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </div>

            {/* Textos da opção Apple */}
            <div className="modal__option-text">
              <span className="modal__option-label">Baixar na</span>
              <span className="modal__option-store">App Store</span>
            </div>
          </a>

          {/* === Opção Android (Google Play) === */}
          <a href="#" className="modal__option">
            {/* Ícone SVG do Google Play */}
            <div className="modal__option-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.698-2.698 2.698-2.698v.792zM5.864 2.658L16.8 8.991l-2.302 2.302-8.635-8.635z" />
              </svg>
            </div>

            {/* Textos da opção Android */}
            <div className="modal__option-text">
              <span className="modal__option-label">Disponível no</span>
              <span className="modal__option-store">Google Play</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}

export default InstallModal
