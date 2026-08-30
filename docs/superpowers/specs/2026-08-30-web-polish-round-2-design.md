# Polimentos da versão web — rodada 2

**Data:** 2026-08-30
**Escopo:** layout mobile-web (breakpoint estreito, `width < 1024`). O breakpoint desktop
(`isDesktop`, Sidebar lateral) fica inalterado, exceto onde explicitamente indicado.

Dez pedidos de polimento consolidados em sete grupos — swipe lateral e "transição de abas"
compartilham a mesma implementação, por isso viram um grupo só.

---

## Grupo 1 — Cores erradas

### 1.1 Loading azul no onboarding

`app/(onboarding)/index.tsx:23` tem `<ActivityIndicator size="large" />` sem prop `color`.
É o único `ActivityIndicator` do app inteiro sem cor explícita — em `react-native-web` isso
cai no azul default (`#1976D2`). Todos os outros loadings do app já passam
`color={colors.primary[400]}`.

**Mudança:** adicionar `color={colors.primary[400]}` (menta `#06D59F`, token de marca).

### 1.2 Outline azul nos inputs

Não existe reset de `outline` em lugar nenhum do projeto — nem em `global.css` (que só tem as
diretivas do Tailwind), nem em `public/index.html`, nem inline no `components/Input.tsx`.
Como o RNW renderiza `TextInput` como `<input>`/`<textarea>` no DOM, o navegador desenha seu
anel de foco azul por cima da borda customizada do componente.

**Mudança:** regra CSS global em `apps/mobile/global.css`:

```css
input,
textarea {
  outline: none;
}
```

Afeta apenas web (o arquivo não é lido pelo runtime nativo). O indicador de foco continua
existindo: `Input.tsx:37-41` já troca a borda para `border-primary-400` quando `isFocused`,
então a acessibilidade de foco visível está preservada.

---

## Grupo 2 — Animação dos três pontinhos ("Calculando suas metas")

`components/onboarding/blocks/CalculatingBlock.tsx:87-100` renderiza três `View` com
`style={{ opacity: 0.4 + i * 0.3 }}` — opacidades fixas calculadas uma vez no `map`. Não há
animação alguma: nem Reanimated, nem `setInterval`, nem keyframes. A tela fica visível por
`PREVIEW_DELAY_MS = 2600`, tempo suficiente para o usuário perceber que nada se move.

**Mudança:** bounce sequencial com Reanimated (estilo "digitando" do WhatsApp). Cada ponto
sobe e desce em loop infinito, com delay escalonado entre os três para criar efeito de onda.

- `useSharedValue` + `withRepeat(withSequence(withTiming(...)), -1, true)` por ponto.
- Delay escalonado via `withDelay(i * STAGGER_MS, ...)`.
- Durações vindas de `lib/motion.ts` onde houver token adequado; constante local documentada
  quando não houver (o projeto já tem esse precedente em `StreakCounter.tsx:14-16`, que
  hardcoda `PULSE_MS = 900` por falta de um token `duration.slower`).
- Os pontos passam a ter opacidade uniforme — o movimento vertical é o que comunica progresso,
  não o gradiente estático atual.

---

## Grupo 3 — Swipe lateral + transição animada entre abas

Resolve dois pedidos: navegação por swipe entre Home/Social/Análises **e** a troca de abas que
hoje é instantânea (render condicional sem transição).

**Estado atual:** `app/(app)/index.tsx:79` mantém `useState<HomeTab>("home")` e renderiza por
`&&` condicional (linhas ~401, 436-437). Não há `ScrollView` horizontal, `PagerView` nem lib de
tabs. `HomeHeader` dispara `onChangeTab(key)` no toque.

**Decisão de dependência (revisada):** implementação própria com `react-native-gesture-handler`
+ `react-native-reanimated`, ambos já instalados. **Nenhuma dependência nova.**

Durante o brainstorm foi cogitado `react-native-tab-view`, mas a verificação empírica do pacote
mostrou um custo que não estava claro na hora da decisão:

- Em **web**, o Metro resolve `Pager.js` → `PanResponderAdapter` (JS puro, não precisa de
  `react-native-pager-view`).
- Em **iOS/Android**, resolve `Pager.ios.js`/`Pager.android.js` → `PagerViewAdapter`, que importa
  `react-native-pager-view` — um **módulo nativo**, ausente do projeto e sem arquivos web no
  pacote publicado.

Como o branch mobile-web de `index.tsx` é escolhido por **largura** (`width < 1024`) e não por
plataforma, um celular real executa esse mesmo código. Adotar tab-view exigiria instalar o
módulo nativo e rebuildar o dev client (`expo prebuild` / EAS) para não quebrar o app nativo.
A implementação própria evita isso e funciona igual nas duas plataformas.

**Mudança:**

- Novo componente `components/domain/SwipeableTabs.tsx`, genérico e isolado: recebe o índice
  ativo, um callback de mudança e as cenas; cuida do `Pan` gesture horizontal e do `translateX`
  animado. Não sabe nada sobre nutrição — é um primitivo de layout.
- `HomeHeader` continua sendo a barra de abas visível — nada muda visualmente nela.
- O conteúdo das três abas (`macroPanel`+lista, `FeedTabContent`, `AnalisesPanel`) vira as três
  cenas do `SwipeableTabs`.
- `activeTab` (state existente) permanece a fonte da verdade, sincronizado nos dois sentidos:
  toque na aba → anima para o índice; swipe → atualiza `activeTab`, mantendo o destaque correto
  na barra.
- Regras de gesto: troca de aba ao ultrapassar 1/3 da largura da tela **ou** com velocidade
  suficiente (fling); caso contrário volta com spring para a aba atual. Sem wrap-around — swipe
  além das bordas (antes de Home, depois de Análises) resiste e volta.
- `activeOffsetX` no `Pan` para não sequestrar scroll vertical das listas.
- Aplicado somente no branch mobile-web de `index.tsx`. O branch `isDesktop` não é tocado.

---

## Grupo 4 — Micro-interações

O usuário selecionou as quatro frentes. A transição de abas já está coberta pelo Grupo 3; as
três restantes:

### 4.1 Feedback de toque em botões e cards

Nenhum `Pressable` do app dá retorno visual ao ser pressionado.

**Mudança:** hook pequeno e reutilizável (`lib/hooks/usePressAnimation.ts` ou similar) que
devolve `onPressIn`/`onPressOut` + `animatedStyle` com scale/opacity sutil via Reanimated.
Aplicado em:

- `components/Button.tsx` (base — cobre a maioria dos botões do app de uma vez)
- Cards de refeição na Home
- Abas do `HomeHeader`
- Cards da tela de histórico

Escala discreta (~0.97) e duração de `Motion.duration.fast`, para não parecer "elástico".

### 4.2 Transição entre telas (stack)

Nenhum `<Stack.Screen>` do projeto define a prop `animation` — busca por `animation:` em
`apps/mobile/app` retorna zero ocorrências. As únicas customizações são de `presentation`
(`modal`, `formSheet`). No web, o default do expo-router praticamente não anima, o que produz a
sensação de "travado" relatada.

**Mudança:** definir `animation: "fade"` no `screenOptions` dos `Stack` em `app/_layout.tsx` e
`app/(app)/_layout.tsx`. As telas com `presentation` explícito (`modal`, `formSheet`) mantêm o
comportamento atual delas.

### 4.3 Entrada de listas

Itens aparecem todos de uma vez, sem entrada suave.

**Mudança:** prop `entering` do Reanimated (`FadeIn` com delay escalonado por índice) nos itens
da lista de refeições da Home e nos cards de histórico. Ambas as listas já usam
`Animated.FlatList`, então é adição de prop, não reestruturação.

---

## Grupo 5 — Layout

### 5.1 Avatar com a mesma altura do container de streak

`HomeHeader.tsx:64-69` — o círculo do avatar é `h-9 w-9` (36px). O container do streak
(`HomeHeader.tsx:46-53` → `StreakCounter.tsx:71`) tem `min-h-[44px]`. Os dois ficam lado a lado
na mesma linha (`flex-row items-center justify-between`), ambos com `shadows.floating`, lendo
como um grupo visual — mas com ~8px de diferença de altura.

**Mudança:** avatar `h-9 w-9` → `h-11 w-11` (44px), igualando ao streak. As iniciais sobem de
`text-xs` para `text-sm` proporcionalmente.

### 5.2 Espaçamento entre gráficos e barra de navegação

Nota: no mobile-web o menu de navegação fica **no topo** (dentro do `HomeHeader`), não embaixo.
O elemento fixo inferior é o `MealComposer`, não um menu.

`HomeHeader.tsx:44` fecha com `pb-1` (4px) e o `macroPanel` (`index.tsx:373`) abre sem
`padding-top` — ou seja, apenas 4px separam a barra de abas do card de resumo, apertado em
comparação com o `pt-4` (16px) interno do próprio card.

**Mudança:** adicionar `pt-3` (12px) ao `macroPanel`. Valor a validar visualmente no preview
durante a execução, ajustando se ficar apertado ou folgado demais.

---

## Grupo 6 — Nomenclatura

Hierarquia atual é confusa: a aba de topo chama "Feed" e contém dentro dela uma sub-aba
"Publicações" — dois rótulos diferentes para conceitos parecidos em níveis distintos.

**Mudanças (apenas rótulos exibidos):**

- `HomeHeader.tsx:14-18` — label da aba `feed` passa de `"Feed"` para `"Social"`.
- `FeedTabContent.tsx` — label da sub-aba `posts` passa de `"Publicações"` para `"Feed"`
  (incluindo o `accessibilityLabel` correspondente).

A chave interna `HomeTab = "home" | "feed" | "analises"` **não muda** — renomear o
identificador propagaria por vários arquivos sem ganho funcional. Só o texto visível muda.

Desktop (`components/layout/Sidebar.tsx:19`, rota `app/(app)/feed.tsx:23`) permanece com "Feed",
conforme o escopo mobile-web definido no brainstorm.

---

## Grupo 7 — Streak ⇄ Histórico

### 7.1 Tocar no streak leva ao histórico

`HomeHeader.tsx:46-53` envolve o `StreakCounter` num `View` simples, e o próprio componente tem
`accessibilityRole="text"` (`StreakCounter.tsx:73`) — semanticamente estático.

**Mudança:** o wrapper em `HomeHeader.tsx` vira `Pressable` navegando para `/(app)/history`,
com `accessibilityRole="button"` e `accessibilityLabel` descritivo. O container já satisfaz o
alvo de toque de 44px. O `StreakCounter` em si permanece um componente de apresentação — quem
decide o comportamento é o call-site, então o uso no desktop (`index.tsx:283-288`) segue
não-clicável.

### 7.2 Número de ofensivas na tela de histórico

Hoje o cabeçalho de `app/(app)/history/index.tsx:66-77` tem apenas o botão voltar + título
"Histórico".

**Mudança:** adicionar o pill de streak à direita do título, reaproveitando `StreakCounter` +
`useStreak()` (o hook já tem `staleTime` de 5min, então não gera refetch relevante). Renderizado
apenas quando `!profile.soft_mode`, mesmo critério já aplicado na Home (`HomeHeader.tsx:46`).
Estilo visual idêntico ao da Home (pill branco arredondado com `shadows.floating`), para leitura
consistente entre as duas telas. Não é clicável aqui — o usuário já está no destino.

---

## Verificação

Ao final da implementação, validar no preview do browser (mobile-web viewport):

1. Loading do gate de onboarding em menta, não azul.
2. Três pontinhos animando em onda na tela de cálculo de metas.
3. Nenhum anel de foco azul ao focar inputs; borda menta ainda indica foco.
4. Swipe lateral alterna Home ↔ Social ↔ Análises, com a aba destacada acompanhando; toque na
   aba também anima.
5. Botões e cards respondem visualmente ao toque.
6. Navegação entre telas com fade.
7. Itens de lista entram com fade escalonado.
8. Avatar e pill de streak com a mesma altura no header.
9. Respiro visível entre a barra de abas e o card de resumo.
10. Aba lê "Social"; sub-aba lê "Feed".
11. Tocar no streak da Home abre o Histórico.
12. Histórico exibe o pill de streak no cabeçalho.

Além disso: `npm run typecheck` limpo em `apps/mobile`.
