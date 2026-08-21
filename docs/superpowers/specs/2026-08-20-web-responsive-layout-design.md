# Responsividade web (tablet/desktop) — Design

## Contexto

O Fitbrother vai lançar primeiro na web (App Store/Play Store travados). O app é 100% mobile-first (React Native + NativeWind), sem nenhum breakpoint responsivo — toda tela é uma coluna única `flex-1` pensada pra largura de celular. Em tablet/desktop, isso deixa texto esticado, botões afastados e formulários gigantes. Este spec cobre a adaptação pra tablet e desktop, entregue de uma vez (sem fases).

## Mecanismo técnico

NativeWind v4 já suporta prefixos responsivos (`md:`, `lg:`) via media query em web e via listener de `Dimensions` em nativo — não precisa de lib nova. Breakpoints usados (padrão Tailwind):

- **base (`<768px`)** — comportamento atual, sem mudanças. Celular.
- **`md` (`≥768px`)** — tablet. Sidebar aparece; a maioria das telas ganha um limite de largura centralizado.
- **`lg` (`≥1024px`)** — desktop. Home/Feed/Histórico ganham layout de múltiplas colunas.

## Categorização das telas

- **Nível 1 — Adaptativas (Home, Feed, Histórico):** ganham layout próprio em `md`/`lg`, tratado caso a caso abaixo.
- **Nível 2 — Card centralizado (todo o resto):** conteúdo interno não muda; só ganha `md:mx-auto md:max-w-[Npx]` no container raiz, centralizando em telas largas. Sem lógica nova, mudança puramente de largura/alinhamento.
  - Telas de auth (`(auth)/*`) e onboarding (`(onboarding)/*`): max-width **440px** — aplicado uma vez no `_layout.tsx` de cada grupo (todas as telas do grupo se beneficiam sem edição individual).
  - Telas do app autenticado fora do Nível 1 (histórico do dia, refeição, edição, configurações, perfil, conquistas, sobre, privacidade, exclusão de conta, scan, amigos, busca, insights, post): max-width **640px** — aplicado individualmente no container raiz de cada tela, porque convivem no mesmo `Stack` que Home/Feed/Histórico (que **não** querem esse limite).

## Sidebar desktop (`md:` e acima)

Componente novo `components/layout/Sidebar.tsx`, renderizado dentro de `(app)/_layout.tsx` ao lado do `<Stack>` existente (`className="hidden md:flex"` — abaixo de 768px não renderiza nada).

- **Largura fixa 248px**, fundo `surface`, borda direita `neutral-200`. Sem modo colapsado/ícone-só.
- **Topo:** wordmark "Fitbrother" (Space Grotesk, menta).
- **Nav:** Home, Histórico, Feed, Análises, Amigos, Buscar pessoas — ícone + label (mesmos ícones `lucide-react-native` do header atual). Item ativo via `usePathname()`, destaque `bg-primary-50 text-primary-600`.
- **Rodapé:** `StreakCounter` (componente já existente) + avatar/nome linkando pra `/profile` (o botão "Sair" continua só dentro do Perfil, não duplica na sidebar).
- **`HomeHeader`:** a fileira de ícones de navegação (Calendar/Rss/Sparkles/Search/Users/User, já numa `ScrollView` horizontal desde o polimento de ontem) ganha `md:hidden` — a navegação passa a viver na sidebar. Saudação + streak continuam visíveis em qualquer largura.

## Home — dashboard em duas colunas (`lg:` e acima)

- **Coluna esquerda fixa (~380px):** hero ring de calorias + 3 macro rings + composer ("O que você comeu?"), sticky enquanto a coluna direita rola.
- **Coluna direita flexível:** lista de refeições do dia, com mais respiro horizontal (não vira grid, continua lista).
- **Em `md` (768–1023px):** mantém empilhado como hoje (só ganha a sidebar) — duas colunas força demais um tablet.
- **Largura máxima do conteúdo em `lg`:** 1120px centralizado no espaço à direita da sidebar.

## Feed — grid responsivo (`md:`/`lg:`)

- Navegação pro detalhe continua `push` pra `/post/[id]` — **sem** master-detail lado a lado (exigiria mudar a arquitetura de rotas do Expo Router; fora de escopo).
- Grid de `PostCard`: 1 coluna base, 2 colunas `md` e acima.

## Histórico — grid responsivo (`md:`/`lg:`)

- Grid de `HistoryDayCard`: 1 coluna base, 2 colunas `md`, 3 colunas `lg` (`≥1280px` continua 3 — não cria breakpoint extra pra 4). Tap continua navegando pra `/history/[day]` (Nível 2).

## Fora de escopo

- Master-detail (lista + detalhe lado a lado) em Feed ou Histórico.
- Sidebar colapsável/modo ícone.
- Redesenho de paleta/tipografia (já coberto na sessão anterior).
- Breakpoints além de `md`/`lg` (sem `sm`, `xl`, `2xl` customizados).

## Verificação

- Redimensionar o browser em 4 larguras de referência — 375px (celular), 768px (tablet), 1024px (laptop pequeno), 1440px (desktop) — e conferir visualmente Home, Feed, Histórico e pelo menos 2 telas Nível 2 (ex: Perfil, onboarding) em cada uma.
- `npm run typecheck` e `npm run lint` limpos.
- Nenhuma tela abaixo de 768px muda de comportamento (regressão zero no mobile).
