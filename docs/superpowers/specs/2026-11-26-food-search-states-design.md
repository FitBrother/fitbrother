# Estados da busca de alimento (design + plano)

Aprovado pelo usuário a partir dos artboards E1–E6 do artifact de propostas, com a decisão de aplicar os estados no `FoodAutocomplete` atual (lista inline dentro do editor de item, na sheet e no drawer) em vez de criar uma tela de busca separada.

## Problema

O `FoodAutocomplete` só mostra recentes, resultados e skeleton. O placeholder é "Descrição", com 1 letra a lista some sem explicação, busca sem resultado fecha a lista e erro de rede não aparece.

## Design

O campo troca o placeholder para **"Buscar alimento"** (o `accessibilityLabel` continua "Descrição do item"). Com o campo em foco, o painel abaixo dele mostra um estado por vez:

| Estado | Condição | Conteúdo |
|---|---|---|
| E1 vazio | texto vazio | linha "A busca começa a partir de 2 letras."; com recentes, título "Usados recentemente" e as linhas |
| E2 uma letra | 1 caractere | "Falta só mais 1 letra para buscar." e atalhos de exemplo (arroz, frango, pão, banana) que preenchem o campo |
| E3 resultados | ≥ 2 caracteres com dados | títulos "Recentes" e "Catálogo" agrupando as linhas atuais |
| E4 carregando | `isLoading` | skeleton atual |
| E5 sem resultado | ≥ 2 caracteres, busca concluída, lista vazia | "Não achamos “x” no catálogo", texto de apoio, botão **Usar “x” mesmo assim** (fecha o painel, mantém o texto) e a dica de uma palavra |
| E6 erro | busca falhou e não há dados | "Não foi possível buscar agora", "Confira sua conexão e tente de novo.", botão **Tentar de novo** (refaz a busca) e **Usar “x” sem o catálogo** |

## Decisões do implementador

- O título é "Catálogo" e não "Catálogo TACO": a sugestão não traz a fonte e o catálogo pode ter outros alimentos.
- Sem destaque do trecho digitado nas linhas nem selo TACO: o dado de fonte não existe e o destaque fica para depois.
- E5 só aparece com a busca concluída (sem `isFetching` nem dado de placeholder), para não dizer "não achamos" de um termo que ainda não foi buscado.
- Sem mudança de backend nem de schema.

## Plano

1. `useFoodSuggestions` expõe `isError`, `isFetching`, `isPlaceholderData` e `refetch` (já vêm do `useQuery`; nada novo a calcular).
2. `FoodSearchPanels.tsx` (novo): `SearchHintPanel`, `ShortQueryPanel`, `NoResultPanel`, `SearchErrorPanel`, com testes.
3. `FoodAutocomplete`: placeholder, escolha do estado por `value.trim().length` + resultado do hook, títulos de seção; testes atualizados (os dois testes de "lista some" mudam de expectativa).
4. Verificação: suíte mobile, typecheck e lint.
