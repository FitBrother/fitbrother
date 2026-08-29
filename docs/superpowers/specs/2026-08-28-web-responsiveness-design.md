# Responsividade web — design

Parte do "Grupo E" (último) do batch de pré-lançamento web. Três mudanças em `apps/mobile`, sem impacto em schema/backend.

## 1. Telas pequenas de desktop

`app/(app)/index.tsx` (branch `isDesktop`, linha ~291): a coluna de resumo (`TodaySummaryHeader` + `GoalsDisclaimer`) é `w-[400px] shrink-0` dentro de `flex-row gap-8` — com a sidebar fixa de 248px, sobram só ~344px pra lista de refeições numa janela de 1024px (o corte mínimo de `isDesktop`).

**Fix:** `w-[320px] xl:w-[400px]` no lugar de `w-[400px]` fixo — mais fôlego pra lista em janelas entre 1024–1279px, mantém 400px em telas maiores.

## 2. Composer no mobile-web

`components/domain/MealComposer.tsx` — no estado idle sem texto, três botões redondos de 64px renderizam ao mesmo tempo: código de barras (`onScanPress`), foto (`onPhotoPress`) e microfone/enviar. Confirmado via inspeção do DOM em viewport de 375px: a área de texto visível cai pra ~47px.

**Fix:**
- Novo botão único "+" (ícone `Plus`) substitui os botões separados de código de barras e foto quando ambos `onScanPress` e `onPhotoPress` estão presentes.
- Tocar no "+" abre um pequeno menu (2 opções: "Foto" e "Código de barras") — reaproveita o padrão de bottom sheet já usado no app (`@gorhom/bottom-sheet`, já é dependência).
- Se só um dos dois handlers for passado (ex. `onPhotoPress` sem `onScanPress`), mantém o botão único direto, sem menu — comportamento atual preservado.
- Resultado: no máximo 2 botões de 64px ao lado do texto (o "+" e o mic/enviar), nunca 3.

## 3. Ícones do topo (`HomeHeader`)

`components/domain/HomeHeader.tsx` — o `ScrollView` horizontal dos ícones tem `className="ml-2 shrink-0 md:hidden"`. `shrink-0` impede o `ScrollView` de ser contido pelo `flex-row justify-between` do pai, então seu conteúdo (6 ícones + streak) vaza pra fora da viewport e arrasta a página inteira num scroll lateral — confirmado: `document.body.scrollWidth` (475px) > `document.documentElement.clientWidth` (375px) numa tela de 375px.

**Fix:**
- `shrink-0` → `flex-1 min-w-0` no `ScrollView`, contendo o overflow dentro da própria faixa (scroll interno, não mais vazamento pra página).
- Reduz os ícones sempre visíveis pra **Histórico** e **Perfil** (as ações mais centrais: progresso próprio e conta). Os demais (Feed, Análises, Buscar pessoas, Amigos) somem por trás de um botão "mais" (ícone `MoreHorizontal`), que abre o mesmo bottom sheet mencionado acima ou um menu simples.
- `StreakCounter` continua sempre visível (já é compacto).

## Fora de escopo

- Backend/schema — nenhuma mudança de dados.
- Sidebar desktop (`md:` e acima) — já funciona bem, mudanças ficam restritas à faixa mobile (`md:hidden`) e à coluna de resumo do dashboard desktop.
