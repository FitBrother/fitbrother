/**
 * Team.jsx — Seção "Nossa Equipe"
 * 
 * Exibe os integrantes do projeto FitBrother com:
 * - Avatar com iniciais e gradiente de cor
 * - Nome do integrante
 * - Cargo/função
 * - Botão com link do LinkedIn (ícone SVG)
 * 
 * Animações de scroll-reveal com delay escalonado.
 * Hover: card levanta + sombra + brilho teal.
 * 
 * ⚠️ DADOS DA EQUIPE — Substitua com os dados reais dos integrantes!
 * Basta editar o array `teamMembers` abaixo com os nomes, cargos e URLs corretas.
 * 
 * Todas as cores usam variáveis CSS do index.css.
 * Classes CSS estão definidas na seção 12 do index.css.
 */

/**
 * DADOS DA EQUIPE — Substitua com os dados reais dos integrantes.
 * 
 * Cada membro possui:
 * - name: Nome completo
 * - role: Cargo ou função no projeto
 * - linkedin: URL do perfil no LinkedIn
 * - initials: Iniciais para o avatar (2 letras)
 * 
 * Para adicionar ou remover integrantes, edite este array.
 */
const teamMembers = [
  {
    name: 'Membro 1',
    role: 'Desenvolvedor Full Stack',
    linkedin: '#',
    initials: 'M1',
  },
  {
    name: 'Membro 2',
    role: 'Designer UX/UI',
    linkedin: '#',
    initials: 'M2',
  },
  {
    name: 'Membro 3',
    role: 'Desenvolvedor Mobile',
    linkedin: '#',
    initials: 'M3',
  },
  {
    name: 'Membro 4',
    role: 'Desenvolvedor Backend',
    linkedin: '#',
    initials: 'M4',
  },
]

/**
 * Ícone SVG do LinkedIn — reutilizado em cada card.
 * Renderiza o logo oficial do LinkedIn.
 */
const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

/**
 * Componente Team
 * Renderiza a seção com os cards da equipe e links do LinkedIn.
 */
const Team = () => {
  return (
    /* Seção com id para navegação por âncora (#team) */
    <section id="team" className="section">
      <div className="container">

        {/* Cabeçalho centralizado da seção */}
        <div className="section__header reveal">
          <h2 className="section__title">Nossa Equipe</h2>
          <p className="section__subtitle">
            As pessoas por trás do FitBrother.
          </p>
        </div>

        {/* Grid responsivo de cards da equipe */}
        <div className="team__grid">
          {teamMembers.map((member, index) => (
            /**
             * Card individual do membro.
             * Delay escalonado para animação em cascata.
             */
            <div
              key={index}
              className={`team-card reveal reveal-delay-${index + 1}`}
            >
              {/* Avatar com iniciais — gradiente primário como fundo */}
              <div className="team-card__photo" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--gradient-primary)',
                border: 'none',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '1.8rem',
                  color: 'var(--text-on-primary)',
                }}>
                  {member.initials}
                </span>
              </div>

              {/* Nome do membro */}
              <h3 className="team-card__name">{member.name}</h3>

              {/* Cargo/função do membro */}
              <p className="team-card__role">{member.role}</p>

              {/* Botão com link para o LinkedIn */}
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="team-card__linkedin"
                aria-label={`LinkedIn de ${member.name}`}
              >
                <LinkedInIcon />
                LinkedIn
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Team
