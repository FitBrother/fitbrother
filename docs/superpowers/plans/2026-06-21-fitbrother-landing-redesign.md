# FitBrother Landing Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a landing page do FitBrother (`landing-page/`) para a direção "Dark Premium", aplicando e sistematizando a marca real (logo FB, paleta menta/quase-preto), preservando a boa copy existente.

**Architecture:** Evoluir a SPA React 19 + Vite existente. Reescrever a camada de design tokens em `index.css`, criar primitivas de UI da marca reutilizáveis (anel de calorias, chips de macro, gráfico pontilhado, linha de ranking, ícones SVG), re-skin das seções existentes, adicionar seções novas (FAQ, CTA final), e remover o que saiu de escopo (Team, InstallModal). Mockups de tela usam componentes CSS como placeholder de alta qualidade, com uma fase final que tenta substituir por prints reais do app.

**Tech Stack:** React 19, Vite 8, CSS puro com custom properties (sem framework CSS), ESLint. Fontes via Google Fonts (Space Grotesk + Inter). Playwright (MCP) para verificação visual.

## Global Constraints

- Idioma de toda a copy: **pt-BR**.
- Paleta da marca (valores exatos): `#010603`, `#04100C`, `#06D59F`, `#ECEEEE`, `#FFFFFF`. Tints/shades de menta podem ser derivados.
- Sem adicionar framework CSS (Tailwind etc.) nem libs de UI — CSS puro com custom properties, seguindo o padrão atual do arquivo.
- Nunca usar valores de cor "soltos" no CSS — sempre referenciar variáveis de `:root`.
- Acessibilidade: contraste mínimo AA para texto; foco visível; respeitar `prefers-reduced-motion`.
- CTA principal = badges das lojas (App Store / Google Play) com `href="#"` placeholder, marcados com comentário `{/* TODO: link real da loja */}`.
- Verificação por tarefa (no diretório `landing-page/`): `npm run build` sem erros + `npm run lint` limpo + screenshot visual via Playwright quando a tarefa muda algo visível.
- Sem framework de testes unitários no projeto; não introduzir um (YAGNI). O "teste" de cada tarefa é build + lint + revisão visual.

---

## Pré-requisito (uma vez, antes da Task 1)

No diretório `landing-page/`, garantir dependências instaladas:

```bash
cd landing-page && npm install
```

Confirmar que `npm run dev` sobe o Vite e que `npm run build` + `npm run lint` rodam sem erro no estado atual (baseline).

---

## Task 1: Fundação — assets de marca, tokens e fontes

**Files:**
- Create: `landing-page/public/brand/horizontal_logo_no_bg.png` (cópia)
- Create: `landing-page/public/brand/app_icon.png` (cópia)
- Create: `landing-page/public/brand/app_icon_no_bg.png` (cópia)
- Modify: `landing-page/index.html` (fontes + favicon + título/OG)
- Modify: `landing-page/src/index.css:12-105` (bloco `:root` de tokens + base dark)

**Interfaces:**
- Produces: variáveis CSS de marca consumidas por todas as tarefas seguintes — `--ink-900`, `--ink-800`, `--ink-700`, `--menta-400`, `--menta-500`, `--menta-600`, `--paper`, `--mist`, `--macro-protein`, `--macro-carbs`, `--macro-fat`, `--font-display`, `--font-body`, e os tokens de raio/sombra/espaçamento já existentes (mantidos).

- [ ] **Step 1: Copiar assets de marca para `public/brand/`**

```bash
mkdir -p landing-page/public/brand
cp ../fitbrother-web/assets/brand/horizontal_logo_no_bg.png landing-page/public/brand/
cp ../fitbrother-web/assets/brand/app_icon.png landing-page/public/brand/
cp ../fitbrother-web/assets/brand/app_icon_no_bg.png landing-page/public/brand/
ls landing-page/public/brand/
```
Esperado: os três PNGs listados. (Caminho de origem relativo a `~/development/fitbrother`; ajustar se necessário.)

- [ ] **Step 2: Reescrever o bloco `:root` em `index.css`**

Substituir o bloco de tokens atual (linhas ~12–105) por:

```css
:root {
  /* === MARCA — Menta === */
  --menta-400: #3FE3B5;   /* hover / brilho */
  --menta-500: #06D59F;   /* primária */
  --menta-600: #04A87E;   /* pressionado / gradiente escuro */

  /* === TONS ESCUROS (ink) === */
  --ink-900: #010603;     /* fundo mais profundo */
  --ink-800: #04100C;     /* superfícies / seções escuras */
  --ink-700: #0A1F17;     /* cards elevados */
  --ink-600: #12352A;     /* borda sutil sobre dark */

  /* === CLAROS === */
  --paper: #FFFFFF;
  --mist:  #ECEEEE;       /* seção clara (quebra de ritmo) */
  --mist-200: #DDE1E1;

  /* === MACROS (semântico, do app) === */
  --macro-protein: #FF6B81;
  --macro-carbs:   #FFC24B;
  --macro-fat:     #A78BFA;
  --macro-calories: var(--menta-500);

  /* === FEEDBACK === */
  --color-success: #22C55E;
  --color-danger:  #EF4444;
  --color-streak:  #FB923C;

  /* === GRADIENTES === */
  --gradient-hero: radial-gradient(120% 90% at 80% 0%, #06351f 0%, var(--ink-800) 55%, var(--ink-900) 100%);
  --gradient-menta: linear-gradient(135deg, var(--menta-400), var(--menta-600));
  --gradient-glow: radial-gradient(600px circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(6,213,159,.15), transparent 40%);

  /* === BACKGROUNDS === */
  --bg-body: var(--ink-900);
  --bg-section-dark: var(--ink-800);
  --bg-section-light: var(--mist);
  --bg-card-dark: var(--ink-700);
  --bg-glass-dark: rgba(4,16,12,.7);

  /* === TEXTO === */
  --text-on-dark: var(--paper);
  --text-on-dark-muted: rgba(236,238,238,.66);
  --text-on-light: var(--ink-800);
  --text-on-light-muted: rgba(4,16,12,.62);
  --text-on-menta: var(--ink-800);

  /* === BORDAS / SOMBRAS / RAIO === */
  --border-dark: rgba(255,255,255,.08);
  --border-light: rgba(4,16,12,.1);
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  --border-radius-xl: 24px;
  --border-radius-full: 9999px;
  --shadow-md: 0 4px 20px rgba(0,0,0,.25);
  --shadow-lg: 0 8px 40px rgba(0,0,0,.4);
  --shadow-glow: 0 0 50px rgba(6,213,159,.25);

  /* === TIPOGRAFIA === */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* === LAYOUT === */
  --section-padding-y: 120px;
  --section-padding-x: 24px;
  --container-max: 1200px;
  --navbar-height: 72px;

  /* === ANIMAÇÃO === */
  --animation-duration: 0.6s;
  --animation-duration-fast: 0.3s;
  --animation-easing: cubic-bezier(0.4, 0, 0.2, 1);
  --animation-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

Atualizar `body` (linha ~168) para fundo dark e texto claro por padrão:

```css
body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.7;
  color: var(--text-on-dark);
  background-color: var(--bg-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}
```

Atualizar headings para `--font-display` e `::selection` para menta:

```css
h1,h2,h3,h4,h5,h6 { font-family: var(--font-display); font-weight: 700; line-height: 1.15; letter-spacing:-0.02em; color: var(--text-on-dark); }
::selection { background: var(--menta-500); color: var(--ink-900); }
::-moz-selection { background: var(--menta-500); color: var(--ink-900); }
```

> Nota p/ implementador: as seções 4–17 do `index.css` (botões, navbar, hero, etc.) serão re-skinadas nas tarefas seguintes. Nesta tarefa, só os tokens + base. O build pode renderizar "quebrado" entre tarefas — é esperado.

- [ ] **Step 3: Atualizar fontes e favicon em `index.html`**

No `<head>`, trocar o link das fontes para Space Grotesk + Inter:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
```

Trocar o favicon emoji pelo ícone FB:

```html
<link rel="icon" type="image/png" href="/brand/app_icon.png" />
```

- [ ] **Step 4: Verificar build + lint**

```bash
cd landing-page && npm run build && npm run lint
```
Esperado: build sem erro; lint limpo.

- [ ] **Step 5: Commit**

```bash
git add landing-page/public/brand landing-page/index.html landing-page/src/index.css
git commit -m "feat(landing): aplicar tokens de marca, fontes e favicon FB"
```

---

## Task 2: Primitivas de UI da marca (CSS/SVG)

Componentes presentacionais reutilizáveis no hero, preview e como fallback de mockups.

**Files:**
- Create: `landing-page/src/components/brand/CalorieRing.jsx`
- Create: `landing-page/src/components/brand/MacroChips.jsx`
- Create: `landing-page/src/components/brand/DottedChart.jsx`
- Create: `landing-page/src/components/brand/LeaderboardRow.jsx`
- Create: `landing-page/src/components/Icon.jsx`
- Modify: `landing-page/src/index.css` (append seção "Primitivas da marca")

**Interfaces:**
- Produces:
  - `CalorieRing({ value=1247, total=2000, label='kcal' })` — anel conic-gradient com número central.
  - `MacroChips({ items=[{label:'Proteína',value:'68g',color:'protein'},...] })` — fileira de chips.
  - `DottedChart({ days=[true,true,false,...] })` — grid 7 colunas de pontos menta/apagado.
  - `LeaderboardRow({ rank, name, value, you=false })` — linha de ranking.
  - `Icon({ name, size=24 })` — ícone SVG inline; nomes: `mic`, `bot`, `whatsapp`, `flame`, `apple`, `googleplay`, `chevron`, `check`.

- [ ] **Step 1: Criar `Icon.jsx`**

```jsx
/** Conjunto de ícones SVG inline (line icons), cor herdada via currentColor. */
const PATHS = {
  mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></>,
  bot: <><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4M9 13h.01M15 13h.01"/></>,
  whatsapp: <path d="M3 21l1.6-4.5A8 8 0 1 1 12 20a8 8 0 0 1-4-1.1L3 21z"/>,
  flame: <path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .2 1 .8 1.5 1.5 1.5C10.5 9 9 7 12 3z"/>,
  chevron: <path d="M6 9l6 6 6-6"/>,
  check: <path d="M20 6L9 17l-5-5"/>,
};
export default function Icon({ name, size = 24, stroke = 2, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  );
}
```

> Nota: os logos Apple/Google Play são **preenchidos** (não combinam com o set de linha), então ficam inline direto no `StoreBadges` (Task 4) — não entram no `Icon`. Ícones de linha disponíveis: `mic`, `bot`, `whatsapp`, `flame`, `chevron`, `check`.

- [ ] **Step 2: Criar `CalorieRing.jsx`**

```jsx
/** Anel de calorias com número central. percent calculado de value/total. */
export default function CalorieRing({ value = 1247, total = 2000, size = 160 }) {
  const pct = Math.min(100, Math.round((value / total) * 100));
  return (
    <div className="cring" style={{ width: size, height: size, '--pct': pct + '%' }}>
      <div className="cring__inner">
        <strong>{value.toLocaleString('pt-BR')}</strong>
        <span>kcal · {Math.max(0, total - value)} restantes</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `MacroChips.jsx`, `DottedChart.jsx`, `LeaderboardRow.jsx`**

```jsx
// MacroChips.jsx
export default function MacroChips({ items = [
  { label: 'Proteína', value: '68g', color: 'protein' },
  { label: 'Carbo', value: '145g', color: 'carbs' },
  { label: 'Gordura', value: '42g', color: 'fat' },
] }) {
  return (
    <div className="macro-chips">
      {items.map((m) => (
        <div className="macro-chip" key={m.label}>
          <strong style={{ color: `var(--macro-${m.color})` }}>{m.value}</strong>
          <span>{m.label}</span>
        </div>
      ))}
    </div>
  );
}
```

```jsx
// DottedChart.jsx — semana de aderência
export default function DottedChart({ days = [true,true,false,true,true,false,true] }) {
  return (
    <div className="dotted-chart" role="img" aria-label="Aderência da semana">
      {days.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}
    </div>
  );
}
```

```jsx
// LeaderboardRow.jsx
export default function LeaderboardRow({ rank, name, value, you = false }) {
  return (
    <div className={`lb-row${you ? ' lb-row--you' : ''}`}>
      <span className="lb-rank">{rank}</span>
      <span className="lb-name">{name}{you && <em> · você</em>}</span>
      <span className="lb-value">{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Adicionar CSS das primitivas ao final de `index.css`**

```css
/* ===== Primitivas da marca ===== */
.cring { border-radius:50%; display:flex; align-items:center; justify-content:center;
  background: conic-gradient(var(--menta-500) 0% var(--pct), rgba(255,255,255,.08) var(--pct) 100%); position:relative; }
.cring__inner { position:absolute; inset:12px; border-radius:50%; background:var(--ink-800);
  display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.cring__inner strong { font-family:var(--font-display); font-size:2rem; color:var(--paper); }
.cring__inner span { font-size:.7rem; color:var(--menta-500); font-weight:600; }

.macro-chips { display:flex; gap:10px; }
.macro-chip { flex:1; background:rgba(255,255,255,.05); border:1px solid var(--border-dark);
  border-radius:var(--border-radius-md); padding:10px; text-align:center; }
.macro-chip strong { display:block; font-family:var(--font-display); font-size:1.1rem; }
.macro-chip span { font-size:.7rem; color:var(--text-on-dark-muted); }

.dotted-chart { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
.dotted-chart i { aspect-ratio:1; border-radius:3px; background:rgba(255,255,255,.15); }
.dotted-chart i.on { background:var(--menta-500); }

.lb-row { display:grid; grid-template-columns:28px 1fr auto; gap:12px; align-items:center;
  padding:12px 14px; border-radius:var(--border-radius-md); }
.lb-row--you { background:rgba(6,213,159,.12); border:1px solid rgba(6,213,159,.3); }
.lb-rank { font-family:var(--font-display); font-weight:700; color:var(--menta-500); }
.lb-name { color:var(--paper); font-weight:600; }
.lb-name em { color:var(--text-on-dark-muted); font-style:normal; font-weight:400; }
.lb-value { color:var(--text-on-dark-muted); font-size:.85rem; }
```

- [ ] **Step 5: Verificar build + lint**

```bash
cd landing-page && npm run build && npm run lint
```
Esperado: build e lint OK (componentes ainda não usados não quebram o build).

- [ ] **Step 6: Commit**

```bash
git add landing-page/src/components/brand landing-page/src/components/Icon.jsx landing-page/src/index.css
git commit -m "feat(landing): primitivas de UI da marca (anel, macros, chart, ranking, ícones)"
```

---

## Task 3: Navbar (re-skin dark + logo FB)

**Files:**
- Modify: `landing-page/src/components/Navbar.jsx`
- Modify: `landing-page/src/index.css` (seção 7 — navbar)

**Interfaces:**
- Consumes: tokens de marca (Task 1).
- Produces: `<Navbar onInstallClick? />` — remover a prop de modal; CTA vira link âncora/loja. Assinatura final: `Navbar()` sem props.

- [ ] **Step 1: Atualizar `Navbar.jsx`** — usar o logo PNG e CTA "Baixar":

```jsx
const Navbar = () => {
  /* ...estado de scroll/menu existente mantido... */
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <a href="#hero" className="navbar__logo">
          <img src="/brand/horizontal_logo_no_bg.png" alt="FitBrother" height="28" />
        </a>
        <div className="navbar__links">
          <a href="#features" className="navbar__link">Recursos</a>
          <a href="#how-it-works" className="navbar__link">Como funciona</a>
          <a href="#faq" className="navbar__link">FAQ</a>
          <a href="#download" className="btn btn--primary navbar__cta">Baixar</a>
        </div>
        {/* hambúrguer existente mantido */}
      </div>
    </nav>
  );
};
```
Remover qualquer referência a `onInstallClick`.

- [ ] **Step 2: Re-skin CSS da navbar** — fundo glass escuro:

```css
.navbar { background: var(--bg-glass-dark); backdrop-filter: blur(20px); border-bottom:1px solid transparent; }
.navbar.scrolled { background: rgba(4,16,12,.92); border-bottom:1px solid var(--border-dark); }
.navbar__logo img { display:block; }
.navbar__link { color: var(--text-on-dark-muted); }
.navbar__link:hover { color: var(--menta-400); }
.navbar__link::after { background: var(--menta-500); }
.navbar__hamburger span { background: var(--paper); }
```
Atualizar o menu mobile (`.navbar__links`) para `background: rgba(4,16,12,.96)`.

- [ ] **Step 3: Re-skin botões** (seção 6 do CSS) para a marca:

```css
.btn--primary { background: var(--menta-500); color: var(--text-on-menta); }
.btn--primary:hover { background: var(--menta-400); box-shadow: var(--shadow-glow); transform: translateY(-2px); }
.btn--outline { color: var(--menta-400); border:2px solid var(--menta-500); background:transparent; }
.btn--outline:hover { background: rgba(6,213,159,.1); }
.btn--dark { background: var(--ink-700); color: var(--paper); }
```

- [ ] **Step 4: Verificar build + lint + visual**

```bash
cd landing-page && npm run build && npm run lint
```
Depois `npm run dev` e via Playwright MCP navegar a `http://localhost:5173`, tirar screenshot do topo. Esperado: navbar escura com logo FB e CTA menta.

- [ ] **Step 5: Commit**

```bash
git add landing-page/src/components/Navbar.jsx landing-page/src/index.css
git commit -m "feat(landing): navbar dark com logo FB e botões na marca"
```

---

## Task 4: Hero + StoreBadges

**Files:**
- Create: `landing-page/src/components/StoreBadges.jsx`
- Modify: `landing-page/src/components/Hero.jsx`
- Modify: `landing-page/src/index.css` (seção 8 — hero; append `.store-badges`, `.phone-frame`)

**Interfaces:**
- Consumes: `CalorieRing`, `MacroChips` (Task 2), tokens (Task 1).
- Produces: `StoreBadges({ align })` — dois badges (App Store, Google Play) com `href="#"` placeholder; reutilizado na Task 9.

- [ ] **Step 1: Criar `StoreBadges.jsx`**

```jsx
/** Badges das lojas. Links placeholder até publicação. Logos preenchidos inline. */
const AppleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.54c-.02-2.06 1.68-3.05 1.76-3.1-0.96-1.4-2.46-1.6-2.99-1.62-1.27-.13-2.48.75-3.13.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.39 2.05-1.44 2.5-.37 6.2 1.03 8.23.69.99 1.51 2.1 2.58 2.06 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.7.65 1.12-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.27 1.13-2.33-.02-.01-2.17-.83-2.19-3.3zM15.0 6.84c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.4 1.23-.53.61-.99 1.59-.87 2.52.91.07 1.85-.46 2.42-1.15z"/>
  </svg>
);
const GooglePlayLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#06D59F" d="M3.6 2.6c-.25.27-.4.68-.4 1.2v16.4c0 .52.15.93.4 1.2l9-9.6-9-9.2z"/>
    <path fill="currentColor" d="M16.5 8.9l-3.3-1.9-2.9 3.1 2.9 3.1 3.3-1.9c1-.6 1-1.9 0-2.5z"/>
    <path fill="currentColor" opacity=".85" d="M3.6 2.6l9 9.2 2.9-3.1L5.6 1.9c-.8-.46-1.6-.36-2 .7z"/>
    <path fill="currentColor" opacity=".7" d="M3.6 21.4l9-9.6 2.9 3.1-9.9 5.7c-.8.46-1.6.36-2-.7z"/>
  </svg>
);
export default function StoreBadges({ className = '' }) {
  return (
    <div className={`store-badges ${className}`}>
      {/* TODO: link real da loja */}
      <a href="#" className="store-badge" aria-label="Baixar na App Store">
        <AppleLogo />
        <span><small>Baixar na</small><strong>App Store</strong></span>
      </a>
      {/* TODO: link real da loja */}
      <a href="#" className="store-badge" aria-label="Disponível no Google Play">
        <GooglePlayLogo />
        <span><small>Disponível no</small><strong>Google Play</strong></span>
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Reescrever `Hero.jsx`** — headline da marca + badges + telefone CSS:

```jsx
import StoreBadges from './StoreBadges';
import CalorieRing from './brand/CalorieRing';
import MacroChips from './brand/MacroChips';

const Hero = () => (
  <section className="hero" id="hero">
    <div className="hero__orb hero__orb--primary"></div>
    <div className="container hero__grid">
      <div className="hero__content">
        <div className="hero__badge">🤖 Nutrição com IA</div>
        <h1 className="hero__title">Registre o que comeu <span className="text-menta">só falando.</span></h1>
        <p className="hero__description">
          Fale ou escreva o que comeu — no app ou no WhatsApp — e a IA calcula tudo:
          calorias, proteínas, carboidratos e gorduras. Com gamificação estilo Duolingo pra te manter no ritmo.
        </p>
        <StoreBadges className="hero__badges" />
        <div className="hero__metrics">
          <div className="hero__metric"><span className="hero__metric-value">IA</span><span className="hero__metric-label">Nutricional</span></div>
          <div className="hero__metric"><span className="hero__metric-value">App + Zap</span><span className="hero__metric-label">Sincronizado</span></div>
          <div className="hero__metric"><span className="hero__metric-value">Streaks</span><span className="hero__metric-label">Diários</span></div>
        </div>
      </div>
      <div className="hero__image">
        <div className="hero__image-glow"></div>
        {/* Telefone construído em CSS — print real entra na Task 11 (data-screenshot="dashboard") */}
        <div className="phone-frame" data-screenshot="dashboard">
          <div className="phone-frame__top"><span>9:41</span><span>FitBrother</span></div>
          <CalorieRing value={1247} total={2000} size={160} />
          <MacroChips />
          <div className="phone-frame__meal">
            <div className="phone-frame__meal-label">CAFÉ DA MANHÃ · 07:30</div>
            <div className="phone-frame__meal-name">Ovos mexidos, pão integral, café</div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
export default Hero;
```

- [ ] **Step 3: CSS do hero, badges e phone-frame**

```css
.hero { background: var(--gradient-hero); }
.hero__title { color: var(--paper); font-size: clamp(2.5rem,5.5vw,4.2rem); font-weight:700; line-height:1.05; }
.text-menta { color: var(--menta-500); }
.hero__description { color: var(--text-on-dark-muted); }
.hero__badge { background: rgba(6,213,159,.12); border:1px solid rgba(6,213,159,.3); color: var(--menta-400); }
.hero__orb--primary { background: var(--menta-600); }
.hero__metric-value { color: var(--paper); font-family:var(--font-display); }
.hero__metric-label { color: var(--text-on-dark-muted); }
.hero__image-glow { background: radial-gradient(circle, rgba(6,213,159,.3) 0%, transparent 70%); }

.store-badges { display:flex; gap:14px; flex-wrap:wrap; }
.store-badge { display:inline-flex; align-items:center; gap:10px; padding:12px 20px;
  background: var(--paper); color: var(--ink-900); border-radius: var(--border-radius-md);
  transition: transform var(--animation-duration-fast) var(--animation-easing); }
.store-badge:hover { transform: translateY(-2px); box-shadow: var(--shadow-glow); }
.store-badge span { display:flex; flex-direction:column; line-height:1.1; }
.store-badge small { font-size:.65rem; }
.store-badge strong { font-family:var(--font-display); font-size:1rem; }

.phone-frame { width:300px; max-width:80vw; background:linear-gradient(165deg,var(--ink-700),var(--ink-900));
  border:6px solid #0c0f0e; border-radius:36px; padding:24px 20px; box-shadow: var(--shadow-glow);
  display:flex; flex-direction:column; gap:18px; align-items:center; }
.phone-frame__top { width:100%; display:flex; justify-content:space-between; color:var(--paper); font-size:.8rem; font-weight:600; }
.phone-frame__meal { width:100%; background:rgba(6,213,159,.1); border:1px solid rgba(6,213,159,.25); border-radius:var(--border-radius-md); padding:12px; }
.phone-frame__meal-label { color:var(--menta-500); font-size:.65rem; font-weight:700; }
.phone-frame__meal-name { color:var(--paper); font-size:.85rem; margin-top:2px; }
```

- [ ] **Step 4: Verificar build + lint + visual** (screenshot do hero via Playwright). Esperado: hero dark, headline com "só falando." em menta, badges brancos, telefone com anel.

- [ ] **Step 5: Commit**

```bash
git add landing-page/src/components/StoreBadges.jsx landing-page/src/components/Hero.jsx landing-page/src/index.css
git commit -m "feat(landing): hero dark premium com badges das lojas e telefone CSS"
```

---

## Task 5: Features (ícones SVG + cards dark)

**Files:**
- Modify: `landing-page/src/components/Features.jsx`
- Modify: `landing-page/src/index.css` (seção 9 — features)

**Interfaces:**
- Consumes: `Icon` (Task 2).

- [ ] **Step 1: Atualizar `Features.jsx`** — trocar emojis por `<Icon>` e manter copy:

```jsx
import Icon from './Icon';
const featuresData = [
  { icon:'mic', title:'Registro por voz e texto', description:'Fale ou escreva o que comeu em linguagem natural. Sem formulários, sem busca manual.' },
  { icon:'bot', title:'IA que calcula macros', description:'A IA identifica os alimentos e calcula calorias, proteínas, carboidratos e gorduras.' },
  { icon:'whatsapp', title:'WhatsApp integrado', description:'Registre direto pelo WhatsApp. Tudo sincroniza em tempo real com o app.' },
  { icon:'flame', title:'Gamificação social', description:'Streaks diários, conquistas e ranking semanal com amigos. Estilo Duolingo para nutrição.' },
];
// no map: <div className="feature-card__icon"><Icon name={feature.icon} /></div>
```

- [ ] **Step 2: Re-skin CSS** — seção escura, cards `--ink-700`:

```css
#features { background: var(--bg-section-dark); }
.feature-card { background: var(--bg-card-dark); border:1px solid var(--border-dark); }
.feature-card:hover { border-color: rgba(6,213,159,.4); box-shadow: var(--shadow-lg); transform: translateY(-8px); }
.feature-card__icon { background: rgba(6,213,159,.12); color: var(--menta-500); border-radius: var(--border-radius-md); }
.feature-card__title { color: var(--paper); }
.feature-card__description { color: var(--text-on-dark-muted); }
.section__title { color: var(--paper); }
.section__subtitle { color: var(--text-on-dark-muted); }
```
Remover a regra `.section--alt` clara antiga (ou redefinir para `--ink-800`).

- [ ] **Step 3: Verificar build + lint + visual.** Esperado: 4 cards escuros com ícones de linha em menta.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/Features.jsx landing-page/src/index.css
git commit -m "feat(landing): features com ícones SVG e cards dark"
```

---

## Task 6: Como Funciona (3 passos re-skin)

**Files:**
- Modify: `landing-page/src/components/HowItWorks.jsx`
- Modify: `landing-page/src/index.css` (seção 10 — steps)

**Interfaces:**
- Consumes: tokens. Imagens em `data-screenshot` para troca na Task 11.

- [ ] **Step 1: Atualizar `HowItWorks.jsx`** — manter copy/estrutura; trocar `<img>` por um wrapper de tela com fallback de componente. Cada passo usa um slot visual marcado:

```jsx
// manter stepsData (copy atual), mas o visual de cada passo é um placeholder com data-screenshot:
// step 1 -> 'whatsapp', step 2 -> 'ai-flow', step 3 -> 'gamification'
<div className="step__image">
  <div className="screen-slot" data-screenshot={step.shot} aria-label={step.imageAlt}>
    {/* placeholder textual até Task 11; substituído por <img> ou componente da marca */}
    <span className="screen-slot__hint">{step.title}</span>
  </div>
</div>
```
Adicionar `shot: 'whatsapp' | 'ai-flow' | 'gamification'` a cada item de `stepsData`.

- [ ] **Step 2: Re-skin CSS** — seção dark, número menta, linha de conexão menta:

```css
#how-it-works { background: var(--bg-body); }
.steps::before { background: linear-gradient(to bottom, transparent, var(--menta-600), transparent); }
.step__number { background: var(--menta-500); color: var(--ink-900); }
.step__title { color: var(--paper); }
.step__description { color: var(--text-on-dark-muted); }
.screen-slot { aspect-ratio:9/16; max-width:300px; width:100%; border-radius:var(--border-radius-xl);
  background:var(--bg-card-dark); border:1px solid var(--border-dark); box-shadow:var(--shadow-lg);
  display:flex; align-items:center; justify-content:center; overflow:hidden; }
.screen-slot img { width:100%; height:100%; object-fit:cover; }
.screen-slot__hint { color:var(--text-on-dark-muted); font-size:.8rem; padding:16px; text-align:center; }
```

- [ ] **Step 3: Verificar build + lint + visual.** Esperado: 3 passos alternados, números menta, slots de tela.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/HowItWorks.jsx landing-page/src/index.css
git commit -m "feat(landing): como funciona re-skin dark com slots de tela"
```

---

## Task 7: Preview do App (vitrine)

**Files:**
- Modify: `landing-page/src/components/AppPreview.jsx`
- Modify: `landing-page/src/index.css` (seção 11 — app-preview)

**Interfaces:**
- Consumes: `LeaderboardRow`, `DottedChart`, `CalorieRing` (Task 2) para a vitrine; slots `data-screenshot` para Task 11.

- [ ] **Step 1: Reescrever `AppPreview.jsx`** — seção clara (`--mist`) para quebra de ritmo, com vitrine de cards da marca:

```jsx
import LeaderboardRow from './brand/LeaderboardRow';
import DottedChart from './brand/DottedChart';

const AppPreview = () => (
  <section id="preview" className="section section--light app-preview">
    <div className="container">
      <div className="section__header reveal">
        <h2 className="section__title">Tudo num lugar só</h2>
        <p className="section__subtitle">Dashboard em tempo real, ranking de amigos e sua semana num olhar.</p>
      </div>
      <div className="preview__grid">
        <div className="preview__card" data-screenshot="dashboard"><span className="screen-slot__hint">Dashboard</span></div>
        <div className="preview__card preview__card--dark">
          <h3 className="preview__card-title">Ranking semanal</h3>
          <LeaderboardRow rank={1} name="Emily R." value="18 dias" />
          <LeaderboardRow rank={2} name="Você" value="14 dias" you />
          <LeaderboardRow rank={3} name="Alex C." value="11 dias" />
        </div>
        <div className="preview__card preview__card--dark">
          <h3 className="preview__card-title">Sua semana</h3>
          <DottedChart />
        </div>
      </div>
    </div>
  </section>
);
export default AppPreview;
```

- [ ] **Step 2: CSS** — seção clara + cards:

```css
.section--light { background: var(--bg-section-light); }
.section--light .section__title { color: var(--text-on-light); }
.section--light .section__subtitle { color: var(--text-on-light-muted); }
.preview__grid { display:grid; grid-template-columns: 1.2fr 1fr 1fr; gap:20px; align-items:stretch; }
.preview__card { background:var(--paper); border-radius:var(--border-radius-xl); padding:24px; box-shadow:var(--shadow-md);
  min-height:260px; display:flex; flex-direction:column; gap:12px; }
.preview__card--dark { background: var(--ink-800); }
.preview__card-title { color: var(--paper); font-size:1rem; }
@media (max-width:768px){ .preview__grid{ grid-template-columns:1fr; } }
```

- [ ] **Step 3: Verificar build + lint + visual.** Esperado: faixa clara com vitrine (dashboard slot, ranking, gráfico pontilhado).

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/AppPreview.jsx landing-page/src/index.css
git commit -m "feat(landing): seção preview clara com vitrine de UI da marca"
```

---

## Task 8: FAQ (acordeão)

**Files:**
- Create: `landing-page/src/components/Faq.jsx`
- Modify: `landing-page/src/index.css` (append seção FAQ)

**Interfaces:**
- Consumes: `Icon` (`chevron`). Produces: `<Faq />` sem props.

- [ ] **Step 1: Criar `Faq.jsx`** com `<details>/<summary>` (acessível, sem JS de estado):

```jsx
import Icon from './Icon';
const faqs = [
  { q:'Meus dados ficam seguros?', a:'Sim. Seus registros são privados e você pode exportar ou apagar tudo quando quiser, conforme a LGPD.' },
  { q:'Preciso de balança ou pesar a comida?', a:'Não. Descreva naturalmente ("2 ovos e um café com leite") e a IA estima as porções e os macros pra você.' },
  { q:'Funciona mesmo pelo WhatsApp?', a:'Funciona. Mande texto ou áudio pro nosso número e o registro sincroniza no app em tempo real.' },
  { q:'O FitBrother é grátis?', a:'Você começa de graça. Recursos avançados podem fazer parte de um plano no futuro.' },
];
const Faq = () => (
  <section id="faq" className="section">
    <div className="container">
      <div className="section__header reveal">
        <h2 className="section__title">Perguntas frequentes</h2>
      </div>
      <div className="faq">
        {faqs.map((f,i) => (
          <details className="faq__item reveal" key={i}>
            <summary className="faq__q">{f.q}<Icon name="chevron" size={20} /></summary>
            <p className="faq__a">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);
export default Faq;
```

- [ ] **Step 2: CSS do FAQ**

```css
.faq { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:12px; }
.faq__item { background:var(--bg-card-dark); border:1px solid var(--border-dark); border-radius:var(--border-radius-md); padding:4px 20px; }
.faq__q { display:flex; justify-content:space-between; align-items:center; gap:16px; cursor:pointer;
  list-style:none; padding:18px 0; font-family:var(--font-display); font-weight:600; color:var(--paper); }
.faq__q::-webkit-details-marker { display:none; }
.faq__item[open] .faq__q svg { transform:rotate(180deg); }
.faq__q svg { color:var(--menta-500); transition:transform var(--animation-duration-fast); flex-shrink:0; }
.faq__a { color:var(--text-on-dark-muted); padding:0 0 18px; margin:0; }
```

- [ ] **Step 3: Verificar build + lint + visual.** Esperado: acordeão dark abre/fecha; chevron menta gira.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/Faq.jsx landing-page/src/index.css
git commit -m "feat(landing): seção FAQ em acordeão acessível"
```

---

## Task 9: Faixa de CTA final (bloco menta)

**Files:**
- Create: `landing-page/src/components/FinalCta.jsx`
- Modify: `landing-page/src/index.css` (append seção final-cta)

**Interfaces:**
- Consumes: `StoreBadges` (Task 4). Produces: `<FinalCta />`, id de âncora `#download`.

- [ ] **Step 1: Criar `FinalCta.jsx`**

```jsx
import StoreBadges from './StoreBadges';
const FinalCta = () => (
  <section id="download" className="final-cta">
    <div className="container final-cta__inner">
      <h2 className="final-cta__title">Sua dieta, no modo jogo.</h2>
      <p className="final-cta__sub">Baixe o FitBrother e registre sua primeira refeição em segundos.</p>
      <StoreBadges className="final-cta__badges" />
    </div>
  </section>
);
export default FinalCta;
```

- [ ] **Step 2: CSS** — bloco menta sólida, texto escuro, badges escuros:

```css
.final-cta { background: var(--menta-500); padding: 96px 0; }
.final-cta__inner { text-align:center; display:flex; flex-direction:column; align-items:center; gap:20px; }
.final-cta__title { color: var(--ink-900); font-size: clamp(2rem,4vw,3rem); }
.final-cta__sub { color: rgba(4,16,12,.8); font-size:1.1rem; }
.final-cta .store-badge { background: var(--ink-900); color: var(--paper); }
```

- [ ] **Step 3: Verificar build + lint + visual.** Esperado: faixa menta com título escuro e badges escuros.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/FinalCta.jsx landing-page/src/index.css
git commit -m "feat(landing): faixa de CTA final em menta sólida"
```

---

## Task 10: Footer (re-skin)

**Files:**
- Modify: `landing-page/src/components/Footer.jsx`
- Modify: `landing-page/src/index.css` (seção 13 — footer)

- [ ] **Step 1: Atualizar `Footer.jsx`** — usar logo PNG, atualizar links âncora (`Recursos`, `Como funciona`, `FAQ`, `Baixar`), remover links mortos. Manter colunas/estrutura.

```jsx
// trocar o logo textual por:
<div className="footer__brand-logo"><img src="/brand/horizontal_logo_no_bg.png" alt="FitBrother" height="26" /></div>
// descrição:
<p className="footer__brand-description">App de nutrição com IA. Fale ou escreva o que comeu e acompanhe seus macros em tempo real.</p>
```

- [ ] **Step 2: CSS** — footer já é dark; ajustar tokens:

```css
.footer { background: var(--ink-900); border-top:1px solid var(--border-dark); }
.footer__link:hover { color: var(--menta-400); }
.footer__brand-description { color: var(--text-on-dark-muted); }
```

- [ ] **Step 3: Verificar build + lint + visual.**

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/Footer.jsx landing-page/src/index.css
git commit -m "feat(landing): footer com logo FB na marca"
```

---

## Task 11: Composição, limpeza e responsivo

**Files:**
- Modify: `landing-page/src/App.jsx`
- Delete: `landing-page/src/components/Team.jsx`
- Delete: `landing-page/src/components/InstallModal.jsx`
- Modify: `landing-page/src/index.css` (seção 15 — responsivo; remover regras órfãs de team/modal)

- [ ] **Step 1: Reescrever `App.jsx`** — nova composição, sem modal/team:

```jsx
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import AppPreview from './components/AppPreview';
import Faq from './components/Faq';
import FinalCta from './components/FinalCta';
import Footer from './components/Footer';
import useScrollReveal from './hooks/useScrollReveal';

function App() {
  useScrollReveal();
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
  );
}
export default App;
```

- [ ] **Step 2: Deletar componentes fora de escopo**

```bash
rm landing-page/src/components/Team.jsx landing-page/src/components/InstallModal.jsx
```
Remover do `index.css` as seções `.team*` e `.modal*` (12 e 14) que ficaram órfãs.

- [ ] **Step 3: Revisar responsivo** — garantir nos breakpoints existentes (1024/768/480): hero vira coluna única e centraliza; `.store-badges` e `.hero__metrics` centralizam; `.preview__grid` e `.features__grid` colapsam; `.phone-frame` reduz. Ajustar/append no media query se necessário:

```css
@media (max-width:768px){
  .hero__badges, .hero__metrics { justify-content:center; }
  .phone-frame { width:260px; }
}
```

- [ ] **Step 4: Verificar build + lint + visual desktop e mobile.** Via Playwright: screenshot da página inteira em 1280px e em 390px. Esperado: tudo na marca, sem seção de equipe, sem modal, sem erros no console.

- [ ] **Step 5: Commit**

```bash
git add -A landing-page/src
git commit -m "feat(landing): nova composição, remove equipe/modal e ajusta responsivo"
```

---

## Task 12: Prints reais do app (fase com fallback)

Objetivo: substituir os slots `data-screenshot` por prints reais. **Se a captura não for viável em tempo razoável, manter os componentes/placeholders CSS já implementados — a landing já está completa sem isto.**

**Files:**
- Create (se obtidos): `landing-page/public/images/screen-dashboard.png`, `screen-whatsapp.png`, `screen-gamification.png`
- Modify (se obtidos): `Hero.jsx`, `HowItWorks.jsx`, `AppPreview.jsx` (trocar slot por `<img>`)

- [ ] **Step 1: Tentar subir o app** — ler `SETUP_ACCOUNTS.md` e `README.md`; tentar `npm run db:start`, `npm run dev:server`, `npm run dev:mobile`. Avaliar caminho viável de captura (Expo web, ou emulador Android). **Timebox: parar e usar fallback se travar em ambiente/credenciais.**

- [ ] **Step 2: Capturar e otimizar** as 3–4 telas-chave (dashboard com anel/macros, registro por voz, conversa WhatsApp, ranking/streaks). Salvar em `public/images/`.

- [ ] **Step 3: Substituir slots** — onde houver `data-screenshot="X"`, trocar o placeholder por `<img src="/images/screen-X.png" alt="..." />` mantendo o wrapper `.screen-slot`/`.phone-frame`.

- [ ] **Step 4: Se não foi viável** — registrar no PR/commit que os slots seguem com componentes CSS da marca (swappáveis depois) e por quê. Não bloquear a entrega.

- [ ] **Step 5: Verificar build + lint + visual + Commit**

```bash
cd landing-page && npm run build && npm run lint
git add -A landing-page
git commit -m "feat(landing): prints reais do app nas telas (ou nota de fallback)"
```

---

## Task 13: Verificação final

- [ ] **Step 1: Build + lint limpos**

```bash
cd landing-page && npm run build && npm run lint
```

- [ ] **Step 2: Auditoria visual via Playwright** — navegar `npm run dev`, screenshots de cada seção em desktop (1280px) e mobile (390px). Conferir: contraste AA (texto sobre dark e sobre menta), foco visível ao tabular, âncoras da navbar funcionando, nenhum erro no console.

- [ ] **Step 3: Checklist de marca** — logo FB presente (navbar+footer), favicon FB, zero emojis-como-ícone remanescentes, paleta só com tokens da marca, fontes Space Grotesk/Inter carregando.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A landing-page && git commit -m "chore(landing): ajustes finais de polish e acessibilidade"
```

---

## Self-Review (cobertura do spec)

- §2 Tokens de marca → Task 1 ✓ · Tipografia → Task 1 ✓ · Componentes da marca → Task 2 ✓ · Assets/logo/favicon → Task 1, 3, 10 ✓
- §3 Navbar → Task 3 · Hero → Task 4 · Features → Task 5 · Como Funciona → Task 6 · Preview → Task 7 · FAQ → Task 8 · CTA final → Task 9 · Footer → Task 10 ✓
- §4 Reescrever index.css → Task 1 · Re-skins → 3–10 · Remover Team/InstallModal → Task 11 · Novos componentes (StoreBadges/Faq/FinalCta/ícones) → Tasks 2,4,8,9 · Acessibilidade/responsivo → Tasks 11,13 ✓
- §5 Telas reais + fallback → Task 12 ✓
- §6 Verificação (build/lint/Playwright/contraste) → Task 13 ✓
- §7 Fora de escopo (waitlist, links reais, depoimentos, redesenho de logo) → não há tarefas, correto ✓

Sem placeholders proibidos (os `data-screenshot` e `href="#"` são intencionais e documentados). Nomes de componentes/props consistentes entre tarefas (`CalorieRing`, `MacroChips`, `DottedChart`, `LeaderboardRow`, `Icon`, `StoreBadges`).
