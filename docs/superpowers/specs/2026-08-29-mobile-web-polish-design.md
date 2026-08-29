# Mobile-web polish (Dashboard) — design

Continuação do polimento da versão web mobile em `apps/mobile`. Quatro mudanças, sem impacto em schema/backend.

## 1. Remove texto abaixo do composer

`app/(app)/index.tsx` — remove o `<Text>` "Escreva, dite ou fotografe — a IA calcula os macros." que ficava logo abaixo do `MealComposer`.

## 2. Aviso de metas estimadas vira ícone expansível

Hoje `<GoalsDisclaimer />` é uma linha fixa (ícone + texto completo) abaixo do card de macros. Substituído por: um botão com ícone `Info` no canto inferior direito do card de macros (`absolute bottom-2 right-2`), estado local `disclaimerOpen`. Ao tocar, expande um bloco com o texto (`GOALS_DISCLAIMER_TEXT` de `@fitbrother/shared`) logo abaixo do card; tocar de novo recolhe. `GoalsDisclaimer.tsx` continua existindo sem alteração — outros usos (RevealBlock do onboarding, coluna de resumo do dashboard desktop) não são afetados.

## 3. Painel de macros fixo

`app/(app)/index.tsx`, branch mobile — hoje o card `TodaySummaryHeader` + disclaimer fazem parte do `ListHeaderComponent` da `FlatList`, então rolam junto com a lista de refeições. Fica:
- Card de macros (+ ícone de info) renderizado como elemento próprio, fixo, entre `HomeHeader` e a lista.
- `FlatList` mantém como `ListHeaderComponent` só o título "Refeições" + contagem — isso continua rolando junto com os itens.
- Mesma estrutura reaproveitada no branch de estado vazio (sem refeições).

## 4. Cabeçalho redesenhado (`HomeHeader.tsx`)

- Remove a saudação ("Bom dia/Boa tarde/Boa noite, Nome").
- **Esquerda:** avatar do usuário + `StreakCounter`. Novo componente `components/Avatar.tsx` (não existe um reutilizável hoje — `profile.tsx` tem a lógica ad-hoc de buscar signed URL e cair pras iniciais, isso vira componente): recebe `avatarPath`, `fullName`, `email`, `size`; busca signed URL via `getPostImageSignedUrl` (mesma função já usada em `profile.tsx`) quando há `avatarPath`, senão mostra iniciais (`profileInitials`). Tocar no avatar navega pra `/(app)/profile` (`hitSlop` garante os 44px de toque mesmo com avatar visualmente menor).
- **Centro:** logo `assets/brand/logo-horizontal-menta.png` (mesma imagem da sidebar desktop, em tamanho menor), centralizado via posicionamento absoluto — fica centralizado na tela independente da largura dos elementos das laterais.
- **Direita:** botão de menu-hambúrguer (ícone `Menu` do lucide-react-native, novo na base de código) abrindo o mesmo padrão de `Modal` já usado (igual ao menu "mais" implementado antes), agora contendo todos os 6 destinos: Histórico, Perfil, Feed, Análises, Buscar pessoas, Amigos.
- `index.tsx` passa `avatarUrl={profile.avatar_url as string | null}` pro `HomeHeader` (o tipo `Profile` tem `[k: string]: unknown`, então precisa de cast — mesmo padrão usado em outros lugares que leem campos extras do profile).

## Fora de escopo

- Sidebar desktop e coluna de resumo desktop — inalteradas.
- Retrofitar o novo `Avatar` em `Sidebar.tsx`/`LeaderboardRow.tsx` — fora do pedido, evita refactor não solicitado.
