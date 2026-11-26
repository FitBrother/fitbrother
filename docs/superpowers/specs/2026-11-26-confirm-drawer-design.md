# Drawer de confirmação da refeição (design)

Aprovado pelo usuário em 2026-11-26 a partir dos artboards H e I do artifact de propostas de UX ("pode seguir" depois do desenho em dois estados). Substitui a tela cheia "Confirme o que entendi" (modo pendente do `MealEditor`, entregue em #47) por um drawer. O backend não muda (a refeição continua nascendo pendente com `require_confirmation` e é confirmada com `PATCH confirm`).

## Problema

A confirmação em tela cheia mostra informação demais (barra de macros, chips, banners, lista com stepper) para quem só quer conferir e confirmar, e tira o usuário da Home.

## Objetivo

Depois de registrar, subir um drawer sobre a tela atual, com o mínimo para decidir em um toque ("Entendi isto: …", total em kcal, Confirmar) e a lista de ajustes só se o usuário pedir.

## Design

Três visões dentro do mesmo drawer (artboards I1–I7):
1. **Compacto (padrão):** rótulo ("ENTENDI ISTO" até 3 itens; "ENTENDI N ITENS" acima disso), frase com os nomes curtos dos 3 primeiros itens ("Arroz, feijão e frango" / "Arroz, feijão, frango e mais 9"), total em kcal grande, "Almoço · 12:40 ▾" (toque abre o seletor de tipo ou de horário), botões **Ajustar** e **Confirmar**, link "Descartar". Texto digitado: sem linha extra. Áudio: linha com ícone de microfone e a transcrição entre aspas (1 linha). Foto: miniatura de 72 pt à esquerda. Confiança abaixo de 0,6: uma linha âmbar "Não tive certeza das quantidades." (substitui o banner).
2. **Ajustar:** "‹" volta ao compacto; título "Ajustar refeição" e total sempre visível; itens em linhas planas com stepper − / +; "Adicionar item"; "Almoço · 12:40 ▾"; **Confirmar** e "Descartar". Altura máxima ~88% da tela: topo e rodapé fixos, só a lista rola. Com poucos itens o drawer encolhe.
3. **Item:** tocar no nome de um item troca o conteúdo do próprio drawer (sem segundo modal) pelo editor de item já existente (alimento com busca, quantidade, atalhos, unidade, macros, switch de ajuste manual, remover, Concluir), com "‹" de volta à lista.

Comportamento:
- O drawer é **global** do app: qualquer tela abre por `useConfirmMealSheet().open(mealId)`. Abre depois de registrar (Home, registro retroativo, onboarding, fallback de IA do código de barras) e ao tocar na faixa, no selo ou no card de uma refeição pendente na Home.
- **Confirmar** salva as edições e confirma numa única requisição (como hoje). **Descartar** pede confirmação e exclui. Fechar o drawer (toque no fundo ou voltar do Android) mantém a refeição pendente. Sem arrastar para fechar (evita fechar sem querer).
- Abrir `meal/[id]` de uma refeição pendente (deep link, URL) abre o drawer e sai da tela: o modo pendente da tela cheia deixa de existir; refeição confirmada continua sendo a tela de detalhe editável.

## Não-objetivos

Mudar o backend, "Corrigir texto" (reinterpretar), confirmação automática, arrastar para expandir/fechar, buscar pendentes de outros dias.

## Abordagens consideradas

- **Drawer com `Modal` do RN:** simples, mas o seletor de tipo/horário e o item abririam um modal sobre outro, frágil no iOS e na web.
- **Overlay absoluto no layout `(app)` (escolhida):** nenhum modal nativo para o drawer; os seletores (que são `Modal`) abrem por cima sem empilhar problema; um único host global. Limite: a tela `history/[day]/new` é um `formSheet` nativo e cobriria o overlay, então depois do registro retroativo ela fecha e o drawer abre em seguida.
- **Cartão expandido na Home / tela cheia:** descartados antes (layout da Home; é o que o usuário achou confuso).

## Deixado ao implementador

Animação (usar `lib/motion.ts`), ícones exatos, como separar os componentes dentro de `components/domain/`, respeitando as regras de ouro de UI do `CLAUDE.md`.
