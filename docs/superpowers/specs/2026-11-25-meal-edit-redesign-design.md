# Edição de refeição: lista + sheet por item (design)

Aprovado pelo usuário em 2026-11-25 a partir dos artboards D1 (lista) e D2 (sheet do item) do artifact de propostas de UX. Esta é a **Parte 1**; a busca de alimento (artboards E1–E6) é a Parte 2 e não faz parte deste design.

## Problema

A tela atual (`EditMealModal`) mostra todo item como um formulário aberto (descrição, qtd, unidade, 4 macros): tudo solto, sem hierarquia, com o total só no fim da rolagem, e nada indica que a refeição em si (tipo, horário) é editável.

## Objetivo

Uma tela que mostre a refeição como um objeto editável e simples: o total sempre à vista, uma linha limpa por item, correção rápida de quantidade sem abrir nada e uma camada separada (sheet) para o resto.

## Não-objetivos

- Busca de alimento nova (placeholder, estados vazio/1 letra/sem resultado/erro): Parte 2. Nesta parte o sheet continua usando o `FoodAutocomplete` atual.
- Editar o **dia** da refeição: fora (muda o dia nutricional, streak e resumos; fica para uma parte própria).
- PATCH atômico, foto da refeição, créditos TACO.
- Dark mode, novas dependências (nada de `@gorhom/bottom-sheet`: o app já usa `Modal` do RN para sheets e pickers).

## Anti-objetivos

- Lista com cards expansíveis e vários campos visíveis ao mesmo tempo (era o problema).
- Faixa de resumo escura: foge do padrão do app. O resumo é um `Card` elevado branco.

## Tela (D1)

De cima para baixo:

1. Barra: `X` (fecha, com confirmação se houver alteração), título "Editar refeição", ícone lixeira "Excluir refeição" (confirma, exclui a refeição).
2. Chips editáveis: **tipo** (Almoço ▾) e **horário** (12:40 ▾). Tocar abre um seletor (lista de tipos / `TimePicker` existente). Só o horário muda; o dia da refeição não.
3. Card de resumo (Card `elevated`): kcal grande (Space Grotesk), chip de delta (`+32 kcal` / `−12 kcal`, em relação ao total ao abrir a tela; some se 0), `MacroSplitBar` existente (barra 6 px + legenda). Fica **fixo** acima da lista (a lista rola).
4. "Itens · N" e uma linha-card por item: nome com lápis (abre o sheet), kcal abaixo, selo "Ajustado" quando houver macros ajustados à mão, e à direita o stepper `− 150 g +` (alvos de 44 pt).
5. Botão tracejado "Buscar e adicionar alimento": adiciona um item vazio e abre o sheet com o campo de nome focado.
6. Barra inferior fixa com "Salvar alterações" (desabilitado sem alterações).

Sem itens: aviso "Sem itens — salvar vai excluir a refeição" (comportamento atual, mantido).

## Sheet do item (D2)

`Modal` do RN, `animationType="slide"`, backdrop `bg-black/40`, container `rounded-t-[26px] bg-white`, handle 36×4 `bg-neutral-300` (DESIGN_SYSTEM §12.8). O card de resumo continua visível acima e atualiza ao vivo.

Conteúdo: campo do alimento (hoje `FoodAutocomplete`; selo TACO quando vinculado ao catálogo), quantidade grande com botões − / + redondos, atalhos de quantidade, unidade (as 7 de `UNIT_OPTIONS`), bloco de macros (kcal grande + P/C/G), switch "Ajustar macros manualmente" (mostra os 4 campos numéricos), rodapé com lixeira "Remover item" e "Concluir item".

As edições valem na hora (o reducer é o mesmo); "Concluir", o backdrop e o botão voltar só fecham o sheet. Fechar o sheet de um item **novo** ainda sem nome remove o item.

## Regras de quantidade

- Stepper e sheet usam o mesmo passo por unidade: `g`/`ml` 10, `cup` 0,5, `unit`/`slice`/`tbsp`/`tsp` 1. Nunca chega a zero ou menos (o − desabilita quando `quantidade − passo <= 0`).
- Atalhos: `g`/`ml` [50, 100, 150, 200]; `cup` [0,5, 1, 1,5, 2]; demais [1, 2, 3, 4]; a quantidade atual entra na lista se não estiver (ordenada, no máximo 5).
- **Item salvo passa a escalar macros com a quantidade** (âncora proporcional ao valor salvo, mesma unidade). Hoje um item salvo tem `link: none` e mudar a quantidade não muda as kcal, o que quebraria o stepper. Editar um macro à mão (`adjusted`) interrompe o escalonamento, como hoje.

## Meta da refeição

`meal_type` e `consumed_at` já existem em `PATCH /meals/:id`. Só vão no patch quando mudaram. Mudar o horário recalcula `consumed_at` mantendo a data local; se o dia nutricional resultante mudar (horário antes de `day_start_hour`), invalida também as queries do novo dia.

## Abordagens consideradas

- **A (refeição como documento, cards expansíveis)**: resolve o "parece editável" com menos telas, mas deixa vários campos visíveis por item.
- **B (lista + sheet)**: simples por tela, mas mais toques e total some.
- **C (cards com stepper e pills)**: correção rápida, porém denso.
- **Escolhida: D = B + stepper e total do C + chips e barra de macros do A.** O caso comum (corrigir quantidade) é 1 toque; o caso raro (trocar alimento, ajustar macros) abre o sheet.

## Deixado ao implementador

Animações (usar `lib/motion.ts`), ícones lucide exatos, e como organizar os componentes dentro de `components/domain/`, desde que sigam as regras de ouro de UI do `CLAUDE.md`.
