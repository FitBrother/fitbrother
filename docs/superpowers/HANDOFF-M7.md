# Handoff — Fase 2 (Rede Social) / começar pelo M7.1

> Cole o bloco abaixo no Claude Code para continuar o desenvolvimento. Todo o planejamento já está feito e commitado; falta executar.

---

## Prompt para o Claude Code

```
Você vai continuar o desenvolvimento do Fitbrother na Fase 2 (transição para rede social). TODO o planejamento já foi feito por outra sessão e está commitado. Sua tarefa é EXECUTAR o plano, não replanejar.

LEIA PRIMEIRO, NESTA ORDEM:
1. CLAUDE.md — regras de ouro (UI + backend). Inviáveis de quebrar: tipografia font-sans-*, tabular-nums em números, cor via token (sem hex em JSX), hit target 44px, RLS sempre, webhooks idempotentes, cache+cap de IA, sem dark mode, lucide-react-native, sem tags HTML.
2. docs/PLAN.md — roadmap único M0–M9. Fase 1 (M0–M6) majoritariamente entregue; M4 pausado. A Fase 2 é a seção "═══ Fase 2 — M7–M9 ═══". É a fonte de verdade de escopo/sequência/status.
3. docs/superpowers/specs/2026-06-12-m7-m9-rede-social-master-plan-design.md — decisões transversais da Fase 2 (o "porquê").
4. docs/superpowers/specs/2026-06-12-m7-feed-social-design.md — design detalhado do M7 inteiro.
5. docs/superpowers/plans/2026-06-12-m7-1-identity-discovery.md — O PLANO QUE VOCÊ VAI EXECUTAR AGORA (11 tasks, passos bite-sized).
6. FEATURES.md (backend/schema) e DESIGN_SYSTEM.md (UI) — fontes de verdade quando precisar.

CONTEXTO DO ESTADO ATUAL:
- Monorepo npm workspaces: apps/mobile (Expo Router), apps/server (Fastify + pg-boss), packages/shared (zod + LLMProvider), packages/db-types (tipos gerados), supabase/migrations (vão até 0036).
- App em M5: registro de refeição por IA (texto/áudio), dashboard realtime, streaks, achievements, follow assimétrico por contatos, leaderboard. WhatsApp (M4) pausado.
- NÃO existe test runner JS. A verificação do repo é: (a) checks SQL em scripts/checks/*.sql rodados por psql no container supabase_db_fitbrother, em transação com ROLLBACK; (b) `npm run typecheck` + `npm run lint` (max-warnings 0); (c) e2e manual em device para mobile/realtime/push. O plano do M7.1 já segue exatamente esse padrão.

PRÉ-REQUISITOS antes de começar:
- `npm install` na raiz.
- Docker rodando + `npm run db:start` (sobe Supabase local; container supabase_db_fitbrother).
- Para features mobile que tocam câmera/imagem/push: dev build EAS (Expo Go não basta).
- Crie uma branch de implementação a partir do estado atual: `git checkout -b feat/m7-1-identity-discovery`.

COMO EXECUTAR:
- Invoque a skill superpowers:executing-plans (ou superpowers:subagent-driven-development se quiser um subagente por task) e execute docs/superpowers/plans/2026-06-12-m7-1-identity-discovery.md task por task, marcando os checkboxes.
- Siga TDD-por-checks: para cada task de banco, escreva/rode o check SQL e veja-o FALHAR antes de escrever a migration; depois `npm run db:reset` e rode o check até PASSAR. Para TS, rode typecheck+lint. Commits frequentes (um por task, como o plano indica).
- Migrations são imutáveis após merge: mudança nova = migration nova. Nunca edite uma migration já aplicada/commitada.
- Onde o plano disser "confirme contra o padrão existente / abra o arquivo X", FAÇA isso (ex.: shape exato de OnboardingStepShell, registro de rotas em server.ts, policies em 0019_meal_audios_bucket.sql, assinatura de authedFetch). O plano marca esses pontos de propósito.

ATENÇÃO ESPECIAL (segurança/privacidade):
- A migration 0038 MOVE o telefone para profiles_private. Antes de aplicar, rode `grep -rn "phone_verified_at\|phone_hash\|phone_e164" supabase/migrations/ apps/server/src/` e confirme que todos os consumidores foram atualizados (verify-phone, contacts). Nenhuma view/RPC/endpoint social pode expor telefone — toda identidade de terceiros sai por public_profiles.

AO TERMINAR O M7.1:
- Rode `./scripts/checks/m7-1-identity.sh` (todos os checks passam) + `npm run typecheck && npm run lint`.
- Faça o e2e manual em device descrito na "Verificação final do M7.1".
- Adicione a linha "Status M7.1" em docs/PLAN.md §M7, espelhando o formato dos Status de M5.x (o que foi feito, migrations, rotas, e o que ficou pro M7.2; marque o que NÃO foi rodado visualmente).
- Abra PR.

DEPOIS DO M7.1 — não improvise as próximas fatias:
- M7.2 (Feed core: posts + foto + CTA + top tab bar) e M7.3 (Engajamento: likes + comentários + notificações + realtime) ainda NÃO têm plano detalhado. Para cada uma, rode o ciclo: superpowers:brainstorming (se houver decisão em aberto) → superpowers:writing-plans, usando o design em 2026-06-12-m7-feed-social-design.md (Partes B/C/D) como base. Gere o plano datado em docs/superpowers/plans/ e só então execute. Continue a numeração de migrations a partir de 0041.

Comece agora: leia os docs na ordem acima, confirme que o Supabase local está up, crie a branch, e inicie a Task 1 do plano do M7.1.
```

---

## Notas pro dev (fora do prompt)

- **Onde está o planejamento:** branch `docs/m7-m9-rede-social-master-plan` (só docs). Faça merge dela na `main` antes de começar, ou crie a branch de implementação a partir dela — o importante é ter os docs disponíveis.
- **Padrão de verificação:** veja `scripts/checks/m5-3-social.sh` / `.sql` como referência de formato; o plano do M7.1 já cria `scripts/checks/m7-1-identity.*` no mesmo molde.
- **Quando travar em produto/UX** (ex.: lib do top-tab no M7.2, layout do card de post): as decisões transversais estão fixadas nos specs; só rebrainstorme o que for genuinamente novo.
