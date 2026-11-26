# Detalhe editável e confirmação ao registrar (design)

Duas partes ligadas, desenhadas nos artboards F (detalhe) e G (confirmação) do artifact de propostas de UX. **Rascunho para aprovação**: as decisões marcadas "Decisão" precisam de resposta do usuário antes de implementar a Parte 2.

## Parte 1 — O detalhe da refeição já é a edição (proposta A, aprovada)

### Problema
Da Home, editar uma refeição exige 3 toques e 3 telas: card → detalhe (só leitura) → lápis → tela de edição. O detalhe não parece editável; o único gesto direto é deslizar o item para excluir.

### Design
Uma tela só (`meal/[id]`), a mesma lista + sheet por item já entregue na edição:
- Barra: voltar, título "Refeição", lixeira "Excluir refeição". O lápis some.
- Chips de tipo e horário (e o dia como texto, não editável), card de total fixo, card de feedback da IA, lista com stepper, "Buscar e adicionar alimento", e abaixo "Compartilhar" / "Novo post".
- **Barra de salvar só aparece quando há alteração**: "Descartar" + "Salvar alterações". Enquanto houver alteração pendente, Compartilhar e Novo post ficam ocultos (não se compartilha o que não foi salvo).
- Voltar (botão, gesto do iOS, botão do Android) com alteração pendente pergunta "Descartar alterações?".
- O deslize para excluir item sai; "Remover item" fica no sheet. Remover o último item continua perguntando se exclui a refeição.
- A rota `meal/[id]/edit` deixa de existir.

### Não-objetivos
Editar o dia da refeição; PATCH atômico no servidor; mudar o card da Home.

## Parte 2 — Confirmar antes de registrar de fato

### Problema
Hoje a IA interpreta e **salva na mesma requisição** (`POST /meals/{text,audio,photo}` extrai e persiste `meals` + `meal_items`). A refeição entra no dia na hora; o usuário não vê o que a IA entendeu. Só confiança < 0,6 vira `review_required` ("Revisar") e só se confirma na tela de detalhe. Um erro (alimento ou quantidade errada) passa batido.

### Fatos do código que o design aproveita
- `meals.review_required = true` **já significa "ainda não vale"**: fica fora de `daily_summaries`, streak, `goal_hit`, achievements, insights e ranking. Confirmar (`POST /meals/:id/confirm`) só vira o flag para false e o trigger recalcula o dia (e dispara streak/conquistas nessa hora).
- Não existe coluna de status/rascunho. Não existe endpoint "interpretar sem salvar".
- A refeição pendente persiste: se o app fecha, ela continua lá.
- Barcode não usa IA e já tem a própria tela de confirmação (`scan-confirm`).
- WhatsApp não está implementado no código.

### Design
Toda refeição registrada por **texto, áudio ou foto** nasce **pendente** (`review_required = true`) e o app leva o usuário direto para a tela de confirmação:
1. Registra → "Lendo sua refeição…" (skeleton) → tela **"Confirme o que entendi"** (a mesma tela do detalhe, em modo pendente).
2. A tela mostra o que o usuário disse (texto/transcrição) ou a foto, os itens com stepper, tipo e horário, e o aviso "ainda não conta no seu dia". Quando a confiança é < 0,6, um banner extra: "Não tive certeza de alguns itens".
3. **Confirmar refeição** envia as alterações pendentes e confirma **numa só requisição** (`PATCH /meals/:id` com `confirm: true`), e só então a refeição soma no dia, no streak e nas conquistas.
4. **Descartar refeição** exclui (com confirmação).
5. Fechar a tela não perde nada: a refeição fica pendente na Home com o selo "Confirmar", uma faixa "N refeições aguardando confirmação" e o total do dia avisando "+459 kcal ao confirmar".

### Decisões (suposições do plano; confirmar antes de implementar)
- **D1. Pendente não soma** no dia/streak (é o comportamento atual de `review_required`). Alternativa: somar na hora e usar a tela só como "recibo editável" (sem mudar backend, mas não é "antes de registrar de fato").
- **D2. Sem confirmação automática na v1.** Risco real: quem registra e não confirma não ganha o dia nem o streak. Mitigações possíveis em seguida: push "Confirme sua refeição" (o `notification_kind = 'meal_confirmation'` já existe e ninguém o usa) ou confirmar sozinho no fim do dia nutricional (só para as de confiança ≥ 0,6).
- **D3.** O primeiro registro do onboarding (`FirstMealBlock`) **passa pela confirmação** também (ensina o produto); o tour é notificado ao confirmar.
- **D4.** Registro retroativo (`history/[day]/new`) também passa pela confirmação.
- **D5. "Corrigir texto"** (reinterpretar o que o usuário escreveu, artboard G4) fica **fora da v1**: exige um endpoint novo de reinterpretação e gasta cota de IA. Na v1 o usuário corrige item a item.
- **D6. Schema:** a mudança é a troca do corpo da RPC `create_meal_with_items` numa migration nova (a 0088). `CLAUDE.md` pede revisão antes de mexer em schema de produção; ver Notas do plano.

### Não-objetivos
Reinterpretação por IA, push/auto-confirmação, WhatsApp, "interpretar sem salvar" (descartado: dois caminhos de criação, perde o rascunho se o app fecha), mudar o fluxo do barcode.

### Abordagens consideradas (Parte 2)
- **Reaproveitar `review_required` como "pendente" (escolhida):** mudança mínima (uma função SQL + um flag no PATCH), sobrevive a app fechado, reaproveita a tela do detalhe e a semântica que já exclui do dia.
- **Pré-visualização sem salvar:** endpoints novos de "parse" para texto/áudio/foto, depois "criar a partir de itens"; nada persiste até confirmar, mas o rascunho se perde se o app fecha e o `source` original precisa ser carregado à parte.
- **Somar na hora e só mostrar um recibo editável:** zero backend, porém não atende "antes de registrar de fato".

## Deixado ao implementador
Textos exatos dos avisos, animações (`lib/motion.ts`), organização dos componentes dentro das regras de ouro de UI do `CLAUDE.md`.
