# Tour guiado ampliado com toque direto — design

**Data:** 2026-09-22
**Status:** aprovado para implementação
**Base:** `2026-09-17-tour-guiado-primeiro-registro-design.md` (gatilho,
persistência, replay e medição continuam valendo; este documento só descreve o
que muda).
**Revisão 2026-09-23:** o toque direto foi revertido — todos os passos avançam
pelo "Próximo" (o último só com "Concluir"). Roteiro, navegação e volta pra
Home continuam valendo; as seções de "tap" abaixo ficam como histórico da
decisão.

## Objetivo

Ampliar o tour para cobrir também o **+** do composer (foto/código de barras),
o streak (e o Histórico que ele abre), o avatar da Home e a tela de Metas e
macros (edição manual). Nos itens acionáveis, o usuário **toca no próprio item
destacado** em vez de apertar "Próximo" — interação mais direta.

## Decisões

- **O tour roteiriza.** O recorte vira área de toque do tour; o toque avança o
  roteiro e o tour executa a navegação/troca de aba. O botão real embaixo não
  recebe o toque. Linear e previsível: toque perdido, botão Voltar do Android
  ou Modal por cima não quebram a sequência.
- **O + só explica.** Não abre o menu de anexos (é um `Modal`, que abriria numa
  janela nativa acima do overlay).
- **O streak abre o Histórico**, com um passo informativo lá; depois o tour
  volta sozinho para a Home para seguir pelo avatar.
- **Último passo:** sem "Pular", botão "Concluir".
- **Ao terminar** (concluir ou pular), o app volta para a Home.

## Roteiro

| # | id | Tela | Alvo | Ação | Texto |
|---|---|---|---|---|---|
| 1 | `home-tab` | home | aba Home | next | Aqui você vê seu resumo do dia. |
| 2 | `social-tab` | home | aba Social | tap | Toque em Social para ver o progresso dos seus amigos. |
| 3 | `analises-tab` | home | aba Análises | tap | Toque em Análises para ver os gráficos da sua evolução. |
| 4 | `composer-plus` | home | **+** do `MealComposer` | tap | Toque no + para registrar por foto ou código de barras. |
| 5 | `streak` | home | streak do `HomeHeader` | tap | Sua ofensiva: dias seguidos registrando. Toque para ver seu histórico. |
| 6 | `history-day` | history | 1º card da lista | next | Cada dia registrado fica aqui, com seus totais. |
| 7 | `home-avatar` | home | avatar do `HomeHeader` | tap | Toque na sua foto para abrir o perfil. |
| 8 | `profile-shortcut-card` | profile | `InstallPrompt` | next | Adicione o Fitbrother à tela inicial. |
| 9 | `profile-goals` | profile | item "Metas e macros" | tap | Toque em Metas e macros para ajustar suas metas. |
| 10 | `goals-editor` | goals | seletor "Calorias & macros / Meu corpo" | next | Aqui você ajusta calorias, macros e seus dados do corpo manualmente. |

O passo 8 continua condicional (`visibleSteps` filtra por `InstallPromptState`).
O antigo `profile-avatar` sai — o toque no avatar da Home cumpre esse papel.

## Interação (`TourOverlay`)

- `TourStep` ganha `action: "tap" | "next"`.
- **Passo `tap`:** um `Pressable` invisível posicionado exatamente sobre o
  recorte chama `next()`; `accessibilityRole="button"` e
  `accessibilityLabel` = texto do passo. O balão mostra só "Pular".
- **Passo `next`:** "Pular" + "Próximo", como hoje.
- **Último passo:** só o botão "Concluir" (sem "Pular"), independentemente da
  ação.
- Fora do recorte, o véu continua bloqueando toques.

## Navegação e abas (`TourProvider` + Home)

- `screen: "home" | "history" | "profile" | "goals"`, mapeado para os
  pathnames `/`, `/history`, `/profile`, `/goals`. Quando o passo atual pede
  uma tela diferente do pathname: `home` → `router.dismissTo("/(app)")`;
  as demais → `router.push(...)`. Substitui o efeito que só tratava o Perfil.
- `finish()` (concluir ou pular) volta para a Home com `dismissTo("/(app)")`
  quando o pathname não é `/`.
- A aba da Home reflete o último toque: `home-tab`/`social-tab` → Home;
  `analises-tab` → Social; `composer-plus`/`streak` → Análises. Os demais
  passos não mexem na aba.

## Alvos novos (`TourTarget`)

- `HomeHeader`: `streak` (Pressable do streak) e `home-avatar`.
- `MealComposer`: `composer-plus` (botão **+**).
- `history/index.tsx`: `history-day` no item de índice 0 da `FlatList`.
- `profile.tsx`: `profile-goals` no `MenuItem` "Metas e macros"; o
  `TourTarget id="profile-avatar"` sai.
- `goals.tsx`: `goals-editor` no seletor de abas.

A medição por estabilidade do `TourTarget` (mede por frame até parar) cobre as
animações de entrada dessas telas. Alvo ausente (streak escondido no modo
leve, **+** oculto porque há texto digitado) cai na rede de segurança de 2 s,
que avança sozinha.

## Testes

- `steps.test.ts`: ordem dos passos, ações e filtro do atalho.
- `tour-context.test.tsx`: navegação por tela (push no Histórico/Perfil/Metas,
  `dismissTo` na volta para a Home) e volta para a Home ao terminar.
- `TourOverlay.test.tsx`: passo `tap` sem "Próximo" e toque no recorte chama
  `next()`; último passo sem "Pular" e com "Concluir".

## Fora de escopo

- Abrir o menu do **+** durante o tour.
- Layout desktop (continua sem tour, `width >= 1024`).
