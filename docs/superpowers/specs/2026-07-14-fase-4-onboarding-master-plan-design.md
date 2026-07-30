# Plano Geral — Motor de Metas & Onboarding Renovado (Fase 4)

**Data:** 2026-07-14
**Tipo:** Brainstorm da Fase 4 — decisões transversais e rationale, a partir de um
spec externo fornecido pelo dono do produto
([`2026-07-14-onboarding-spec-original.md`](2026-07-14-onboarding-spec-original.md)).
Cada milestone abaixo terá sua própria spec detalhada → plano → revisão →
implementação, como as fases anteriores do projeto.
**Status:** Aprovado para detalhamento do M14 (primeira fatia).

> **Roadmap e status canônicos vivem em [`docs/PLAN.md`](../../PLAN.md) (§Fase 4).**
> Este documento guarda o *porquê* (auditoria, decisões transversais, riscos,
> sequência); o `PLAN.md` guarda o breakdown por milestone e os Status de
> implementação. Em caso de conflito, o `PLAN.md` vence para escopo/sequência.

---

## 1. Objetivo

Substituir o motor de metas nutricionais atual (fórmula fixa em SQL, sem gates de
segurança) e o onboarding estático de 9 telas por:

1. Um **motor de cálculo** determinístico, testável e com gates de segurança
   clínica (idade, gravidez, IMC, triagem de TCA, condições de saúde).
2. Um **onboarding reformulado** como máquina de estados com resume no servidor,
   novas perguntas de anamnese (objetivo/ritmo, rotina, barreiras, alimentação,
   saúde) e um placeholder de paywall.
3. **Contexto de perfil injetado no feedback de IA** já existente (M8), pra sair de
   "você excedeu 300 kcal" pra feedback que considera restrições e barreiras reais.
4. **Salvaguardas de linguagem** (Brasil: prescrição de plano alimentar é atividade
   privativa de nutricionista/médico) centralizadas e testadas em CI.

Isso **substitui integralmente o M11 original** ("aprimorar onboarding sem
reestruturar o fluxo") — a máquina de estados com resume exige reestruturação, o
que o M11 antigo explicitamente descartava. O M11 fica marcado como superado por
esta Fase no `PLAN.md`.

---

## 2. Estado atual (baseline) — auditoria (Fase 0 do spec original)

- **Stack:** Expo Router + React Native + TypeScript + NativeWind v4, Zustand
  (estado efêmero de formulário), TanStack Query. Backend Fastify + pg-boss.
  Supabase (Postgres + Auth + Realtime + Storage). **Padrão do projeto inteiro:
  lógica de negócio mora em Postgres** (funções PL/pgSQL + triggers — ex.
  `fitbrother_apply_streak`, `fitbrother_recompute_daily_summary`).
- **Onboarding atual:** 9 telas de rota fixa (`step-2.tsx`...`step-9.tsx`), estado
  em Zustand **sem persistência** (fecha o app, perde tudo), payload inteiro
  enviado de uma vez no fim para uma RPC atômica (`complete_onboarding`).
  `username`/avatar/telefone já são opcionais.
- **Modelo de dados:** `profiles`, `anthropometrics` e `nutrition_goals` **já são
  append-only/versionados** (`UNIQUE` parcial `WHERE effective_to IS NULL`) —
  infra de "metas não mudam silenciosamente" já existe. Nenhum campo do spec
  (peso-alvo, ritmo, barreiras, restrições, condições de saúde, `soft_mode`) existe
  hoje. `subscriptions` só tem `plan=free,status=active`, **sem paywall real**.
- **Cálculo de metas hoje:** determinístico, mas vive inteiro em SQL
  (`complete_onboarding`, migration `0008`): `kcal = TDEE × {lose:0.8,
  maintain:1.0, gain:1.1, recomp:0.95}`, proteína fixa 1.6/2.0 g/kg (não ajusta por
  IMC/peso-alvo), gordura = 25% fixo (sem piso g/kg), sem fibra, **sem gates de
  segurança**.
- **Pipeline de feedback de IA:** dois pipelines já existem (M8) — feedback de
  refeição "piggyback" na extração (`services/extraction.ts`) e insights de
  período (`services/insights.ts`). **Nenhum dos dois injeta contexto de
  perfil/restrições/barreiras hoje.**
- **Telemetria:** não existe (Sentry só cobre erro).
- **Testes:** não existe test runner configurado (zero `*.test.ts`, nenhum script
  `"test"`). Validação hoje é via scripts SQL ad-hoc (`scripts/checks/*.sh`) +
  typecheck/lint.
- **Usuários reais:** nenhum ainda — Supabase prod não provisionado, sem
  TestFlight (confirmado com o dono do produto). Isso simplifica bastante a Fase 4
  do spec original (migração).

### O que já está atendido (não refazer)
Uma pergunta por tela + progress bar + voltar sempre disponível; `username`/avatar/
telefone opcionais (progressive profiling parcial); infra de histórico versionado
em `nutrition_goals`/`anthropometrics`; permissões (telefone/consentimento) já não
ficam na primeira tela.

---

## 3. Decisões transversais fechadas no brainstorm

| Tema | Decisão |
|------|---------|
| Escopo vs. M11 original | Substitui M11 por completo — reestruturação é inevitável. |
| Usuários reais hoje | Nenhum. Migração (M17) fica leve, sem backfill/confirmação complexos. |
| Onde mora o cálculo | **TS puro** em `packages/shared` (diverge do padrão SQL-first do projeto, deliberado — gates com muitos casos de borda são mais seguros de testar em TS). |
| Resume do onboarding | **Servidor** (`onboarding_progress`), como o spec original pede — não uma versão light client-only. |
| Feature flag / A-B | **Fora de escopo nesta Fase.** Sem usuários reais, não há "versão antiga" real pra comparar. Reavaliar quando houver base de usuários. |
| HealthKit / Health Connect | **Fora de escopo nesta Fase.** Usa `tdeeSource: 'declared'` só. Fica como evolução futura. |
| Telemetria de funil (Fase 7 do spec) | **Fora de escopo nesta Fase** — precisa de ferramenta nova (nenhuma existe), decisão adiada. |
| Paywall (Bloco 10) | **Não existe hoje.** Constrói só como **placeholder de UI** (sem IAP) — cobrança real é projeto à parte. |
| Conteúdo clínico/TCA | Escrito conforme o spec original, mas **marcado explicitamente como pendente de revisão profissional** (nutricionista/advogado) antes de qualquer lançamento real. Não bloqueia desenvolvimento — bloqueia lançamento. |
| Test runner | **Vitest** (leve, zero-config pra TS/monorepo). |

---

## 4. Infraestrutura compartilhada (transversal)

### 4.1 Copy e conformidade legal (M14 — pré-requisito de tudo)
Arquivo central de strings ligadas a metas/calorias em `packages/shared`. Termos
permitidos ("metas estimadas", "estimativa", "ferramenta de acompanhamento") vs.
blocklist ("prescrição", "sua dieta", "plano alimentar prescrito", "recomendação
médica"). Teste de lint em CI falha se a blocklist vazar pra fora do próprio
arquivo. Componente `<GoalsDisclaimer />` reutilizável. Todo o resto (M15 revelação
de metas, M16 telas de anamnese, M18 feedback de IA) consome daqui — nada de string
solta duplicada.

### 4.2 `SOFT_MODE` (transversal ao app inteiro, não só onboarding)
Flag `profiles.soft_mode` (M15), reversível só pelo usuário nas configurações.
Quando ativo: esconde kcal/déficit/projeção/streak em **todo lugar que hoje
mostra isso** — `ProgressRing`, `MacroBar`, `StreakCounter`, tela de Análises
(M8 insights). Mapeado como parte do M16 por ser transversal, mas a flag em si
nasce no M15 (motor de cálculo/gates).

### 4.3 Motor de cálculo (nasce no M15, consumido por M16 e futuros recálculos)
`computeTargets`/`evaluateSafetyGates` em `packages/shared/src/targets/`, puro,
sem I/O. Consumido pelo backend no fluxo de onboarding (M16) e, no futuro, por
qualquer tela de "recalcular metas" fora do onboarding (ex. update de peso).

---

## 5. M14 — Copy e conformidade legal

**Meta:** toda string relacionada a metas/calorias do app vem de um único lugar,
com uma blocklist de termos que a lei brasileira reserva a nutricionista/médico,
verificada em CI.

- `packages/shared/src/copy/goals.ts`: strings + `LEGAL_BLOCKLIST` exportada.
- Script/regra de lint em CI que varre `apps/mobile` por strings literais e falha
  se algum termo da blocklist aparecer fora do próprio arquivo de constantes.
- Componente `<GoalsDisclaimer />` (mobile), pronto pra ser usado nas telas de
  revelação de metas (M16) e — futuramente — na tela de metas do Perfil (M10).

**Feito quando:** existe uma fonte única de copy de metas; CI falha se alguém
escrever "prescrição"/"sua dieta"/"recomendação médica" fora do arquivo de
constantes; `<GoalsDisclaimer />` renderiza e é exportado, mesmo sem consumidor
ainda (M16 é quem consome).

---

## 6. M15 — Motor de cálculo + gates de segurança

**Meta:** `computeTargets`/`evaluateSafetyGates` substituem a fórmula fixa da RPC
`complete_onboarding`, com clamps, gates clínicos e os 5 casos de teste exatos do
spec original passando.

- `packages/shared/src/targets/`: `computeTargets(profile): Targets`,
  `evaluateSafetyGates(profile): GateResult[]`, tipos `Targets`/`GateResult`/
  `Warning`. Fórmulas, clamps e tabela de gates exatamente como
  [`2026-07-14-onboarding-spec-original.md`](2026-07-14-onboarding-spec-original.md)
  (Fase 2) especifica.
- Backend (`apps/server/src/services/targets.ts`) chama o módulo **antes** de
  persistir. A RPC `complete_onboarding` deixa de calcular macro em SQL — passa a
  receber os valores já prontos e só persistir (decisão de arquitetura: mover
  cálculo de negócio pra TS, mantendo a atomicidade da transação via chamada
  server-side, não mais só client→RPC direto).
- Migrations aditivas (nullable): `nutrition_goals` ganha `fiber_g`,
  `tdee_source`, `warnings jsonb`, `blocked boolean default false`;
  `anthropometrics` ganha `target_weight_kg`, `rate_kg_per_week`; `profiles` ganha
  `soft_mode boolean default false`.
- Triagem de TCA (3 perguntas, ver §Fase 2 do spec original) vive aqui como parte
  do payload de gates, mas a **tela** que a exibe é do M16.
- Conteúdo do gate/triagem marcado com comentário `// PENDENTE DE REVISÃO
  PROFISSIONAL` + item correspondente no `PLAN.md`.

**Testes obrigatórios:** os 5 casos exatos do spec original (clamp de ritmo + piso
de gordura; BLOCK por IMC; BLOCK por peso-alvo; IMC>30 usa peso-alvo pra proteína;
SOFT_MODE nunca vaza kcal), via Vitest.

**Feito quando:** os 5 casos de teste passam; `complete_onboarding` não calcula
mais macro em SQL, só persiste; um perfil com gate `BLOCK` não recebe `Targets` de
déficit.

---

## 7. M16 — Máquina de estados do onboarding + paywall placeholder

**Meta:** onboarding roda como máquina de estados com resume no servidor, cobrindo
os blocos do spec original adaptados ao que já existe, terminando num placeholder
de paywall (sem cobrança real) e na primeira refeição guiada.

- Migration `onboarding_progress(user_id PK, current_block text, answers jsonb,
  updated_at)`.
- Engine declarativo (`lib/onboarding/blocks.ts`): array de blocos com id, campos,
  condição de branching, componente de tela.
- Rota única `app/(onboarding)/[block].tsx` dirigida pelo engine, **substituindo**
  os 9 arquivos `step-N.tsx` atuais — reaproveitando os componentes de input já
  existentes (`WheelPicker`, `DateInput`, `SegmentedControl`), só migrando pra
  dentro do novo engine (não reescreve a lógica de input, só a casca de
  navegação).
- `PATCH /onboarding/progress` salva a cada passo; `GET /onboarding/progress`
  retoma exatamente onde o usuário parou.
- Blocos: gancho (reaproveita `welcome.tsx`) → dados (sexo/altura/peso/nascimento,
  componentes reaproveitados) → objetivo (peso-alvo + slider de ritmo com data
  projetada em tempo real, chamando `computeTargets` do M15) → rotina → barreiras
  → alimentação → saúde (com a triagem de TCA do M15) → permissões (push; **sem**
  HealthKit) → cálculo (loading) → revelação (usa `<GoalsDisclaimer />` do M14) →
  **paywall placeholder** (UI só, sem IAP) → primeira refeição guiada.
- `SOFT_MODE` (flag nascida no M15): mapeamento de todos os pontos de UI que
  precisam escondê-la (`ProgressRing`, `MacroBar`, `StreakCounter`, insights)
  acontece aqui, por ser o milestone que primeiro liga a flag a uma experiência
  real de usuário.

**Feito quando:** usuário completa o onboarding novo ponta a ponta; fechar o app
no meio e reabrir retoma exatamente no bloco em que parou (mesmo dispositivo ou
outro, mesma conta); gate `BLOCK`/`SOFT_MODE` do M15 efetivamente ramifica o
fluxo; paywall placeholder aparece sem cobrar nada; `soft_mode=true` esconde kcal
em todas as telas mapeadas.

---

## 8. M17 — Migração de usuários existentes

**Meta:** nenhuma quebra pra quem já tem conta — mas como confirmado no brainstorm,
**não há usuários reais hoje**, então esta fatia fica deliberadamente leve.

- Todas as migrations de M15/M16 já nascem aditivas/nullable (nenhuma quebra
  estrutural).
- Sem backfill complexo, sem fluxo de "comparar e confirmar recálculo de metas"
  no MVP desta fase — não há metas de ninguém pra preservar ainda.
- Documentar no `PLAN.md`/runbook que, **quando existirem usuários reais**, rodar
  `evaluateSafetyGates` retroativamente nos perfis existentes e o fluxo de
  confirmação de recálculo do spec original (Fase 4) precisam ser revisitados
  antes do próximo público entrar.

**Feito quando:** `supabase db reset` aplica as migrations de M15/M16/M17 sem
erro; não existe nenhum fluxo de dado órfão porque não existem dados prévios reais
para migrar.

---

## 9. M18 — Contexto para IA

**Meta:** o feedback de refeição (M8.1) e os insights de período (M8.2) passam a
considerar restrições, barreiras e `soft_mode` do usuário, não só os macros.

- `buildCoachContext(profile): CoachContext` em `packages/shared`, formato e
  regras de tom exatamente como a Fase 5 do spec original.
- Consumido por `services/extraction.ts` (injeta no prompt de feedback de
  refeição) e `services/insights.ts` (injeta no prompt de insights de período).
- Se `soft_mode = true`, `metas` e `consumido_hoje` são omitidos do contexto —
  nenhum número chega ao prompt.

**Feito quando:** o feedback de uma refeição muda de tom conforme a
`barreira_principal` do usuário (validável comparando dois perfis sintéticos com
barreiras diferentes); `soft_mode=true` comprovadamente não manda kcal/macros pro
prompt.

---

## 10. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Conteúdo clínico/TCA sem validação profissional | Marcado explicitamente como pendente de revisão (M15); não bloqueia dev, bloqueia lançamento — item correspondente no `PLAN.md`. |
| Mudar onde a lógica de negócio mora (SQL → TS) diverge do padrão do projeto | Deliberado e documentado aqui; escopo restrito ao motor de metas, não é uma migração geral de lógica pra fora do banco. |
| Máquina de estados nova quebrar telas de input já testadas | Reaproveita os componentes de UI existentes (`WheelPicker`, `DateInput`, etc.), só troca a casca de navegação/persistência. |
| Escopo inflar (feature flag, HealthKit, telemetria, paywall real) | Todos explicitamente fora desta Fase (ver §3); qualquer um deles vira sua própria iniciativa futura se/quando fizer sentido. |
| Falta de test runner hoje | M15 introduz Vitest já com os 5 casos obrigatórios do spec original — motor de cálculo nasce testado. |

---

## 11. Sequência e dependências

```
M14 Copy/legal ──► M15 Motor de cálculo+gates ──► M16 Máquina de estados+paywall placeholder ──► M17 Migração
                                                                                    │
                                                                                    ▼
                                                                              M18 Contexto p/ IA
```

- **Ordem:** M14 → M15 → M16 → M17 → M18. M18 pode rodar em paralelo a M17 (ambos só dependem de M16 estar pronto o suficiente para gerar `soft_mode`/restrições reais), mas a ordem linear é a mais segura pra revisão incremental.
- Cada milestone = seu próprio ciclo spec detalhada → plano → revisão → implementação, sob este guarda-chuva, como o M7-M9 (Fase 2) já fez.

---

## 12. Numeração

Milestones novos: **M14 a M18**, inseridos na Fase 3 do roadmap (`PLAN.md`) como
uma nova seção "Fase 4". M11 (Aprimorar onboarding) é marcado como **superado por
esta Fase** — sua meta original ("sem reestruturar o fluxo") é incompatível com o
que esta Fase entrega. Numeração exata de migrations é definida na spec de cada
milestone (`0055` é a mais alta hoje).

---

## 13. Próximo passo

Detalhar o **M14 — Copy e conformidade legal** em sua própria spec → plano →
implementação (é a fundação; M15 em diante consome dela).
