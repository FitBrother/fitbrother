# Tour guiado no web (layout desktop) — design

**Data:** 2026-09-23
**Status:** aprovado para implementação
**Base:** `2026-09-22-tour-guiado-ampliado-design.md` (roteiro de 10 passos,
avanço pelo "Próximo", último passo só com "Concluir", volta pra Home ao
terminar).

## Objetivo

Rodar o mesmo roteiro no web. Abaixo de 1024 px o web já usa o layout do
celular (abas no `HomeHeader`) e o tour atual vale como está. A partir de
1024 px entra o layout desktop — navegação pela `Sidebar`, streak no card
"Hoje" — onde o tour hoje é bloqueado. Este documento cobre o desktop e os
ajustes que o web precisa.

## Layout do tour

`tourLayout(width)`: `width >= 1024` → `"desktop"`, senão `"compact"` (mesmo
corte do `isDesktop` da Home e do `lg` da Sidebar). A trava que impedia o tour
no desktop sai.

Cada passo pode ter uma variante `desktop: { screen?, copy? }`;
`visibleSteps(installStatus, layout)` aplica a variante quando o layout é
desktop. Ids e ordem são os mesmos nos dois layouts.

| # | id | Desktop: tela | Desktop: alvo | Desktop: texto |
|---|---|---|---|---|
| 1 | `home-tab` | home | item "Home" da Sidebar | igual |
| 2 | `social-tab` | **feed** (`/feed`) | item "Feed" da Sidebar | igual |
| 3 | `analises-tab` | **insights** (`/insights`) | item "Análises" da Sidebar | igual |
| 4 | `composer-plus` | home | **+** do `MealComposer` | igual |
| 5 | `streak` | home | `StreakCounter` do card "Hoje" | Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu. |
| 6 | `history-day` | history | 1º card | igual |
| 7 | `home-avatar` | home | perfil no rodapé da Sidebar | Aqui você abre seu perfil e suas configurações. |
| 8–10 | atalho / Metas / editor | iguais | iguais | iguais |

## Alvos

- `Sidebar`: `TourTarget` em "Home" (`home-tab`), "Feed" (`social-tab`),
  "Análises" (`analises-tab`) e no perfil do rodapé (`home-avatar`).
- Home desktop (`index.tsx`, ramo `isDesktop`): `TourTarget id="streak"` no
  `StreakCounter` do card "Hoje".
- O **+**, o card do Histórico, o Perfil e Metas já têm alvo e servem aos dois
  layouts.

**Alvo invisível não registra.** A Sidebar fica montada com `display: none`
no layout estreito, então o mesmo id existe duas vezes. O `TourTarget` nunca
registra medida de tamanho zero: o alvo visível vence; sem nenhum visível, a
rede de segurança de 2 s avança o passo.

## Navegação

`SCREEN_ROUTE` ganha `feed` (`/feed`, `/(app)/feed`) e `insights`
(`/insights`, `/(app)/insights`), ambas por `push`. Home continua por
`dismissTo("/(app)")`.

## Web

- **Overlay fixo:** no web o overlay usa `position: "fixed"`. O desktop rola
  o documento (cabeçalho e composer `sticky`); com `absolute` o véu rolaria
  junto enquanto as medidas são relativas à viewport.
- **Rolagem travada:** com o tour ativo, `document.body.style.overflow =
  "hidden"`, restaurado ao terminar — a roda do mouse não move a página por
  baixo do destaque.

## Testes

- `steps.test.ts`: `tourLayout` e variantes desktop (telas e textos).
- `tour-context.test.tsx`: com largura 1280 o tour inicia e empurra `/feed` e
  `/insights`.
- `TourTarget.test.tsx`: medida 0×0 nunca registra.
- `TourOverlay.test.tsx`: no desktop mostra o texto da variante.

## Fora de escopo

- Atalhos de teclado (Esc para pular etc.).
- Alvos dentro das telas de Feed e Análises (o destaque é o item da Sidebar,
  com a tela aberta ao fundo).
