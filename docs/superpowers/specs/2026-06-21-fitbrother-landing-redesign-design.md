# Redesign da Landing Page — FitBrother

**Data:** 2026-06-21
**Status:** Aprovado (design) — pronto para plano de implementação
**Escopo:** Evoluir a landing page React+Vite existente em `landing-page/` aplicando a marca real do FitBrother numa direção visual "Dark Premium".

---

## 1. Contexto e objetivo

O FitBrother é um app de nutrição com IA: o usuário fala ou escreve o que comeu (no app ou no WhatsApp), a IA transcreve, identifica alimentos, calcula macros e sincroniza em tempo real. Gamificação estilo Duolingo (streaks, conquistas, ranking de amigos).

Já existe uma landing em `landing-page/` (React 19 + Vite, CSS com design tokens). O problema: o visual atual **não usa a marca real** — usa um teal genérico (`#2DD4BF`) em tema claro, com ícones emoji. Os mockups de tela são gerados por IA e têm artefatos.

**Objetivo:** redesenhar a landing para uma direção **Dark Premium** que aplica e sistematiza a marca real (logo FB, paleta menta/quase-preto), mantendo a boa copy e estrutura existentes, com CTA de download nas lojas.

### Decisões tomadas no brainstorming
- **Marca:** aplicar e sistematizar os assets existentes (não redesenhar do zero).
- **Direção visual:** Dark Premium (quase-preto dominante, menta como acento neon).
- **Hero:** telefone limpo construído em CSS, contendo print real do app dentro da moldura.
- **Local:** evoluir a landing existente em `landing-page/`.
- **CTA principal:** badges das lojas (App Store / Google Play), links placeholder por enquanto.
- **Seções:** Hero, Features, Como Funciona, Preview do App, FAQ, CTA final, Footer. **Seção "Equipe" removida.**
- **Telas:** tentar rodar o app e capturar prints reais; fallback para componentes CSS.

---

## 2. Mini brand system (design tokens)

Reescrever a camada de tokens em `landing-page/src/index.css`.

### Cores
| Token | Valor | Uso |
|---|---|---|
| `--ink-900` | `#010603` | Fundo mais profundo |
| `--ink-800` | `#04100C` | Superfícies / seções escuras |
| `--ink-700` | `~#0A1F17` (derivado) | Cards elevados no dark |
| `--menta-500` | `#06D59F` | Cor primária da marca |
| `--menta-400` | `~#3FE3B5` (derivado) | Hover / brilho claro |
| `--menta-600` | `~#04A87E` (derivado) | Pressionado / gradiente escuro |
| `--paper` | `#FFFFFF` | Texto sobre dark / superfície clara |
| `--mist` | `#ECEEEE` | Seção clara (quebra de ritmo) |
| Macros | proteína / carbo / gordura | Mantêm cor semântica (do app) |

Texto sobre dark: `--paper` e `--mist`; mutado via opacidade. Contraste mínimo AA.

### Tipografia
- **Títulos/display:** Space Grotesk (geométrica, conversa com o corte do "F" do logo). Trocável por Plus Jakarta Sans sem refatorar.
- **Corpo:** Inter.

### Componentes da marca
Botões pill; cards arredondados (16–24px); **anel de calorias**; **chips de macro**; **gráfico pontilhado** (estilo do board de inspiração); **linha de ranking de amigos**; **badges das lojas**; glows menta sutis. Ícones emoji substituídos por **set de ícones SVG** em linha, na cor menta.

### Assets
Copiar de `assets/brand` (em `fitbrother-web`) para `landing-page/public/`:
- `horizontal_logo_no_bg.png` → navbar e footer.
- `app_icon.png` / `app_icon_no_bg.png` → favicon (substitui o emoji 🍏 no `index.html`).

---

## 3. Estrutura da página

Dark dominante, com **uma** seção clara (`--mist`) para quebra de ritmo e **uma** faixa menta sólida (CTA final) para energia.

1. **Navbar** — glass escuro fixo, logo FB horizontal, links âncora, CTA "Baixar".
2. **Hero** — headline forte, subcopy, **badges App Store / Google Play** (placeholder), chips de confiança (IA · App+WhatsApp · Streaks), e **telefone limpo (CSS) com print real dentro** (ou componente CSS no fallback). Glow menta de fundo.
3. **Features** — 4 diferenciais em cards escuros com ícones SVG: registro por voz/texto, IA calcula macros, WhatsApp integrado, gamificação social.
4. **Como Funciona** — 3 passos alternados: Fale ou Escreva → A IA faz o trabalho → Acompanhe e compita. Com prints/telas.
5. **Preview do App** — vitrine das telas de perto (dashboard, WhatsApp, gamificação).
6. **FAQ** — acordeão com dúvidas-chave: privacidade/LGPD, "preciso de balança?", "funciona pelo WhatsApp?", "é grátis?". Sem depoimentos inventados (entram quando houver dados reais).
7. **Faixa de CTA final** — bloco **menta sólida** com headline curta + badges das lojas.
8. **Footer** — escuro: logo, descrição, colunas de links, social, divisor, copyright.

---

## 4. Mudanças no código (evoluir o existente)

- **`index.css`:** reescrever o token system para a marca real; ajustar todas as referências (`--color-primary-*` → `--menta-*`, backgrounds dark por padrão, etc.); manter o sistema de scroll-reveal, botões, responsivo.
- **Re-skin:** `Navbar`, `Hero`, `Features`, `HowItWorks`, `Footer`.
- **Remover:** `Team.jsx` e `InstallModal.jsx` (CTA agora é badges das lojas; modal de instalação não é mais necessário). Limpar referências em `App.jsx`.
- **Novos componentes:** `StoreBadges`, `AppPreview` (reforçado), `Faq`, `FinalCta`, e componentes/uso de ícones SVG (`icons.jsx` ou `public/icons.svg`).
- **Componentes de UI da marca** (para mockups/fallback): `CalorieRing`, `MacroChips`, `DottedChart`, `LeaderboardRow` — reutilizáveis no hero e nas seções.
- **`index.html`:** favicon FB, fontes (Space Grotesk + Inter), metadados OG já existentes mantidos/ajustados.
- **Acessibilidade:** contraste AA no dark, foco visível, `prefers-reduced-motion` respeitando as animações.
- **Responsivo:** aproveitar os breakpoints existentes (1024 / 768 / 480).

---

## 5. Telas reais do app (fase com fallback explícito)

- **Fase 0 — tentativa:** subir o app localmente (Expo) + backend/Supabase, autenticar um usuário com dados semeados, e capturar prints das telas-chave (dashboard com anel/macros, registro por voz, conversa no WhatsApp, gamificação/ranking). Recortar e otimizar.
- **Riscos:** sem simulador iOS no Linux; emulador Android é pesado; Expo web pode não rodar limpo com NativeWind v4 + Expo Router; depende de credenciais (Supabase, OpenAI/Gemini, Meta) e seed de dados.
- **Fallback (plano B):** construir os componentes de UI em CSS na marca (`CalorieRing`, `MacroChips`, chat WhatsApp estilizado, `LeaderboardRow`) como placeholders de alta qualidade — visualmente consistentes e **swappáveis** por prints reais depois. A entrega não trava no print.

---

## 6. Verificação

- `npm run build` (Vite) sem erros; `npm run lint` limpo.
- Revisão visual desktop + mobile via Playwright (screenshots das seções).
- Checagem de contraste (AA) nos textos sobre dark e sobre menta.
- Conferir que âncoras da navbar e badges das lojas funcionam (links placeholder explicitamente marcados).

---

## 7. Fora de escopo

- Backend/analytics da landing, formulário de waitlist, i18n (mantém pt-BR).
- Links reais das lojas (placeholder até o app publicar).
- Depoimentos/prova social com números (sem dados reais ainda).
- Redesenhar o logo ou criar novo símbolo (marca é aplicada, não redesenhada).
