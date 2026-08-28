# Dashboard (Home) alinhado ao template do Claude Design — Design

## Motivação

O template `templates/dashboard/Dashboard.dc.html` do projeto de design system
(`526d8a00-58d8-475e-bcf1-6ff77abea7b9`) define uma estrutura mais completa pro
dashboard do que a implementação atual em `apps/mobile/app/(app)/index.tsx`: header
flutuante com saudação + streak no desktop, resumo do dia num `Card` com o disclaimer
de metas logo abaixo, cabeçalho "Refeições" com contagem, e o `MealComposer` docado
como barra larga no rodapé da página (não mais dentro da coluna de resumo).

A maioria dos componentes necessários já existe (`Sidebar`, `HomeHeader`,
`TodaySummaryHeader`, `GoalsDisclaimer`, `Card`, `MealComposer`, `EmptyMealsState`,
`StreakCounter`) — o trabalho é reorganizar o layout de `(app)/index.tsx`, não
construir componentes novos.

## Escopo

**Dentro do escopo:**
- Desktop (`isDesktop`, já existente via `useWindowDimensions`): header flutuante
  "{saudação}, {nome}" + "Hoje" + `StreakCounter`, substituindo o `HomeHeader` simples
  atual (que passa a renderizar só no mobile). Coluna esquerda com resumo em `Card` +
  `GoalsDisclaimer` abaixo. Coluna direita com heading "Refeições" + contagem antes da
  lista. `MealComposer` sai da coluna esquerda e vira uma barra fixa no rodapé da
  página inteira, com legenda "Escreva, dite ou fotografe — a IA calcula os macros."
  abaixo.
- Mobile: mesma reorganização de conteúdo (resumo em `Card`, `GoalsDisclaimer`,
  heading "Refeições" + contagem antes da lista) — o `MealComposer` continua com o
  comportamento atual de acompanhar o teclado (`Animated.View` + `useAnimatedKeyboard`
  já afinado), só ganha a legenda abaixo.
- `EmptyMealsState` passa a ficar dentro de um `Card variant="flat"`.

**Fora do escopo (mantém como está):**
- `BottomTabBar` — o template tem uma barra de navegação fixa no mobile; por ora a
  navegação mobile continua sendo a fileira de ícones no topo do `HomeHeader` (decisão
  do usuário: mudança de shell fica pra depois).
- Gradientes de fade atrás das barras fixas (o template usa
  `linear-gradient` puro de CSS) — sem `expo-linear-gradient` no projeto, e não vale a
  pena adicionar uma dependência só por esse polimento. As barras fixas usam fundo
  sólido `bg-neutral-50` (mesma cor da página, sem o efeito de esmaecer o conteúdo por
  trás).
- Copy do `EmptyMealsState` (já transmite a mesma ideia do template).

## Arquivos afetados

- Modificado: `apps/mobile/app/(app)/index.tsx` (reorganização dos dois branches,
  desktop e mobile)
- Modificado: `apps/mobile/components/domain/HomeHeader.tsx` (exporta `greetingFor`
  pra reuso em `index.tsx`, sem mudar o componente em si)

Nenhuma mudança de dados, hooks ou backend — é só reorganização de layout com
componentes que já existem.
