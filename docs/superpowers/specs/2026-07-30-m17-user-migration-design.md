# M17 — Migração de usuários existentes

Quarta fatia da Fase 4 (Motor de Metas & Onboarding Renovado). Depende de M14,
M15 e M16 (todos concluídos e mergeados em `main`). Fonte: `docs/PLAN.md`
§Fase 4, `docs/superpowers/specs/2026-07-14-fase-4-onboarding-master-plan-design.md`
§8, e o spec original (`docs/superpowers/specs/2026-07-14-onboarding-spec-original.md`,
"FASE 4 — Migração de usuários existentes").

## Decisão

Confirmado no brainstorm da Fase 4 e reconfirmado aqui: **não há usuários
reais hoje**. M17 fica deliberadamente leve — nenhum pipeline de recálculo
retroativo é implementado nesta fatia. Em vez disso, o procedimento completo
do spec original (rodar `evaluateSafetyGates` em todo perfil existente,
aplicar `BLOCK`/`SOFT_MODE`, comparar/confirmar recálculo de metas, backfill
incremental) é documentado como um **runbook de pré-lançamento** — um
checklist obrigatório e concreto o bastante pra um engenheiro (ou agente)
futuro executar sem precisar re-descobrir o contexto, a ser seguido antes de
abrir a conta pro primeiro público real.

## Entregável

**Novo arquivo:** `docs/runbooks/pre-launch-user-migration.md`, no mesmo
formato de `docs/runbooks/lgpd.md` (seções por etapa, queries SQL concretas,
comportamento esperado). Cobre, em ordem:

1. **Backfill do que for derivável.** Antes de rodar os gates, conferir se
   algum campo novo de `anthropometrics`/`profiles` (M15/M16) pode ser
   preenchido a partir de dados já existentes — hoje nenhum é (todos nasceram
   nullable e sem equivalente antigo), mas o runbook documenta o princípio e
   a query pra achar linhas `NULL` que precisariam de atenção manual antes do
   próximo passo.
2. **Rodar `evaluateSafetyGates` retroativamente.** Para cada usuário: montar
   `TargetsInput` via `buildTargetsInput` (`apps/server/src/services/targets.ts`)
   a partir do `anthropometrics`/`profiles` atuais, chamar
   `evaluateSafetyGates` (`@fitbrother/shared`). Se algum gate retornar
   `SOFT_MODE`, gravar `profiles.soft_mode = true`. Se algum retornar
   `BLOCK`, recalcular via `computeTargets` (que já força metas de
   manutenção quando há gate `BLOCK`) — isso é correção de segurança, não
   feature, e deve rodar mesmo sem o usuário pedir.
3. **Nunca sobrescrever metas silenciosamente.** `nutrition_goals` é
   append-only (nunca `UPDATE`, sempre `INSERT` com novo `effective_from` e
   `effective_to` fechado na linha anterior). Se o recálculo do passo 2
   mudar as metas de alguém, o runbook exige mostrar a comparação
   ("suas metas mudavam de X para Y") e pedir confirmação explícita antes do
   `INSERT` — nunca aplicar em lote sem esse gate de UI.
4. **Coleta incremental de campos ainda faltantes.** Usuários migrados não
   passam pelo onboarding novo — campos como `target_weight_kg`,
   `strength_training`, triagem de TCA etc. ficam `NULL` até serem
   coletados. O runbook proíbe qualquer modal bloqueante no login pra isso;
   a coleta é um campo por vez, em contexto natural de uso (ex.: primeira
   vez que o usuário abre a tela de objetivo nas configurações).

**Referências cruzadas:** `docs/runbook.md` ganha uma linha na lista de
seções apontando pro arquivo novo; `docs/PLAN.md` (M17) marca o milestone
como concluído com este escopo.

## Verificação ("feito quando")

- `supabase db reset` aplica as migrations 0056–0064 (M15/M16) sem erro —
  confere que não existe nenhum dado órfão pra migrar porque não existem
  usuários reais ainda.
- Nenhuma mudança de código em `packages/shared`, `apps/server` ou
  `apps/mobile` — esta fatia é puramente documentação de pré-requisito.

## Fora de escopo

- Implementar o job/script de recálculo retroativo de verdade — fica
  especificado no runbook, não codificado, até existir um público real pra
  justificar.
- Qualquer UI de comparação/confirmação de metas — mencionada como
  requisito no runbook, é trabalho de uma fatia futura (quando o primeiro
  público real se aproximar).
