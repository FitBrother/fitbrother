# Plano Geral — Transição para Rede Social (M7 · M8 · M9)

**Data:** 2026-06-12
**Tipo:** Brainstorm da Fase 2 — decisões transversais e rationale. Cada fase terá sua própria spec detalhada → plano → revisão → implementação.
**Status:** Aprovado para detalhamento do M7.

> **Roadmap e status canônicos vivem em [`docs/PLAN.md`](../../PLAN.md) (§Fase 2 — M7–M9).** Este documento guarda o *porquê* (decisões transversais, riscos, sequência); o `PLAN.md` guarda o breakdown por milestone e os Status de implementação. Em caso de conflito, o `PLAN.md` vence para escopo/sequência.

---

## 1. Objetivo

Expandir o Fitbrother de um app de registro nutricional solitário para uma **rede social com foco em gamificação e engajamento**, aproveitando o core de IA que já lê a refeição e salva macros/calorias automaticamente.

São três features novas, tratadas como três fases sequenciais sob este plano:

1. **M7 — Feed Social:** transformar o registro em ação social (post com foto + legenda + macros, feed de quem você segue, likes e comentários).
2. **M8 — Análise com IA:** usar a IA como conselheira sobre os dados já coletados (feedback de refeição, wrap-up do dia, tendências de semana/mês).
3. **M9 — Compartilhamento externo:** motor de aquisição orgânica via cards exportáveis estilo Strava (a partir de um post ou de uma análise de IA).

---

## 2. Estado atual (baseline)

O app está em M5+ (M0–M5 entregues). Relevante para este plano:

- **Grafo social:** existe `follows` (assimétrico, estilo Duolingo), match por contatos (`contact_links` + `phone_hash`), leaderboard semanal (`fitbrother_weekly_leaderboard`). A view `following_summaries_view` expõe do network apenas `day/goal_hit/meals_count` — **nunca macros** (FEATURES §3.5).
- **Refeições:** `meals` + `meal_items` completos (macros, `consumed_at`, soft-delete via `deleted_at`). **Não há coluna de foto** nem bucket de imagem — só `meal-audios`.
- **IA/LLM:** camada `LLMProvider` plugável (Gemini Flash default), cache global (`ai_extractions`, keyed por `hash(text + LLM_PROMPT_VERSION + locale)`), quota diária (`ai_usage` + `fitbrother_assert_ai_cap`). Hoje só faz **extração de refeição**.
- **Notificações & achievements:** outbox `notifications` + worker `dispatchPendingPush` prontos e reutilizáveis; engine `fitbrother_evaluate_achievements` com triggers.
- **Identidade:** `profiles` tem RLS `owner_all` — **um usuário só lê a própria linha**. Dados de terceiros só aparecem via views/RPCs `SECURITY DEFINER` que selecionam colunas a dedo. `phone_e164`/`phone_hash` ficam em `profiles` e nunca entram nessas projeções.
- **Navegação:** hoje é `Stack` puro (sem tab bar). Telas: Hoje, Histórico, Amigos, Achievements, Perfil.

### O que não existe e este plano cria

posts · likes · comentários · feed · username/busca · tabela privada de telefone · coluna/bucket de foto · camada de insights de IA (`ai_insights`) · cards exportáveis.

---

## 3. Decisões transversais (já fechadas no brainstorming)

| Tema | Decisão |
|------|---------|
| **Visibilidade do feed** | Fechado: só seguidores veem. Reversão **controlada** do "never macros" — apenas no que o usuário escolhe postar. |
| **Macros no post** | Visíveis. O post carrega um **snapshot** dos macros no momento da publicação (não referencia a meal ao vivo). |
| **Foto** | Opcional, anexada na tela de Novo Post. **Não altera o core de registro.** Foto vive no post (`posts.image_path`). |
| **Postar** | Sempre opt-in. Registro continua privado por padrão. |
| **Análise IA** | Dia/semana/mês **automáticos via cron**, entregues por push + card no app. Custo de LLM é risco de 1ª ordem (ver §8). |
| **Username** | Adicionar `username` único (citext) para descoberta. Busca por username. |
| **Telefone** | Mover para tabela **`profiles_private`** (RLS owner + service-role). Vazamento estruturalmente impossível em queries de descoberta. |
| **Geração de card** | **Client-side** (`react-native-view-shot` + `expo-sharing`). Server-side fica para v2 se precisarmos de deep-link público. |

---

## 4. Infraestrutura compartilhada (transversal)

Peças que mais de uma fase consome — puxadas conforme cada fase precisa.

### 4.1 Identidade & Descoberta (pré-requisito do M7)

- **`username`** em `profiles`: `citext UNIQUE`, validação `^[a-z0-9_.]{3,20}$`. Escolhido no onboarding/perfil.
- **`profiles_private`**: nova tabela 1:1 com `profiles` contendo `phone_e164`, `phone_hash`, `phone_verified_at`. RLS owner + service-role only. Migration move as colunas de `profiles` e atualiza o fluxo de `verify-phone` e o match de contatos para gravar/ler aqui.
- **Projeção pública canônica `public_profiles`**: view/RPC que expõe **somente** `{user_id, username, display_name, avatar_url}`. Toda a UI social (autor de post, busca, lista de seguidores, leaderboard) lê **só** por aqui. `profiles` permanece `owner_all`.
- **Avatar:** coluna `avatar_url` + reuso do padrão de bucket de imagem (§4.2).
- **Busca:** `GET /users/search?q=` resolvendo via `public_profiles`. Convive com o match por contatos existente.

### 4.2 Fotos / imagens (entra no M7)

- Bucket privado novo `post-images` (espelha RLS por prefixo `{user_id}/` do `meal-audios`, 25 MB, MIME image/jpeg|png|webp).
- Upload assinado direto do cliente. `posts.image_path` aponta para o objeto.
- Mesmo bucket serve avatares (`avatars/` prefix) ou bucket separado — decidir na spec do M7.

### 4.3 Camada de Insights de IA (entra no M8)

- Reusa `LLMProvider` com um **segundo método** `generateInsight(payload, periodType)`.
- Cache próprio keyed por `hash(payload_agregado + INSIGHT_PROMPT_VERSION + period_type)`.
- **Linha de quota dedicada** em `ai_usage` (não compete com extração de refeição).
- Versionamento próprio: `INSIGHT_PROMPT_VERSION`.
- Saída **estruturada** (JSON: `title`, `bullets[]`, `score`, `tone`), validada por zod em `packages/shared`.

### 4.4 Notificações sociais (reuso)

- Reusa `notifications` + `dispatchPendingPush`. Adiciona `kind`: `post_like`, `post_comment`, `insight_ready`, `new_follower` (se aplicável).
- Render cases novos em `notifications.ts`.

---

## 5. M7 — Feed Social

**Meta:** usuário publica refeições e vê/interage com posts de quem segue.

### Schema (novas tabelas)
- **`posts`**: `id`, `user_id`, `meal_id` (FK nullable), `caption`, `image_path`, snapshot de macros (`total_kcal/protein_g/carbs_g/fat_g`), `created_at`, `deleted_at` (soft delete).
- **`post_likes`**: `post_id`, `user_id`, `created_at` (PK composta).
- **`post_comments`**: `id`, `post_id`, `user_id`, `body`, `created_at`, `deleted_at`.
- **RLS:** leitura de `posts`/likes/comments liberada quando o autor é o caller **ou** o caller segue o autor (join em `follows`); escrita só do dono. Filtros padrão excluem `deleted_at`.

### Snapshot de macros
O post copia os totais da refeição na publicação. Editar/deletar a meal depois não muda o histórico do feed e respeita o soft-delete.

### Fluxo
1. IA salva a refeição (fluxo atual, inalterado).
2. Na tela de detalhe/home aparece CTA **"Compartilhar no feed"**.
3. Tela **Novo Post**: foto opcional (captura/galeria) + legenda + preview do card de macros.
4. Publica → `posts` + upload de imagem.
5. Feed (nova aba) lista posts de quem você segue em ordem cronológica, com foto, legenda, card de macros, like e comentários. Realtime para contagem de likes/comentários.

### Navegação
Introduz **tab bar** (hoje é Stack). Abas prováveis: **Hoje · Feed · Amigos · Perfil**.

### Componentes novos (design system)
`PostCard`, `PostHeader` (avatar + username + timestamp), `LikeButton`, `CommentButton`, `CommentInput`, `FeedScreen`, `NewPostScreen`, busca de usuários.

---

## 6. M8 — Análise com IA

**Meta:** IA como conselheira sobre os dados já coletados, em 4 níveis.

| Nível | Gatilho | Conteúdo |
|-------|---------|----------|
| **Refeição** | Junto da extração (barato) | Feedback curto imediato ("Ótima fonte de proteínas!"). |
| **Dia** | Cron no fim do dia (por timezone) | Wrap-up: metas batidas + mensagem de incentivo. |
| **Semana** | Cron semanal | Tendências: padrões de açúcar, hidratação, consistência. |
| **Mês** | Cron mensal | Tendências de mais longo prazo. |

### Backend
- Worker/cron monta payload **agregado e compacto** (manda summaries por dia, **não** refeição crua) e pede saída estruturada.
- Persistência em **`ai_insights`**: `id`, `user_id`, `period_type` (enum: `meal/day/week/month`), `period_start`, `payload jsonb`, `created_at`.
- Cache + quota dedicados (§4.3).
- Só gera para usuários com **dados suficientes** no período (evita custo/insight vazio).

### Entrega
Push (`kind: insight_ready`) quando pronto + card de insight no app, disponível para compartilhar no M9.

---

## 7. M9 — Compartilhamento externo (cards estilo Strava)

**Meta:** motor de aquisição orgânica.

- **Origem:** a partir de (a) um post do feed ou (b) uma análise de IA (ex: resumo da semana).
- **Composição:** foto do usuário + dados/insight + marca d'água/logo. Layouts: Stories (9:16) e quadrado (WhatsApp).
- **Abordagem:** **client-side** — componente React renderizado com o próprio design system, capturado como PNG via `react-native-view-shot`, compartilhado via `expo-sharing` (share sheet nativo). Sem infra de servidor, usa os mesmos tokens/fontes, funciona offline, custo zero.
- **Componentes:** `ShareCard` (variantes story/square), telas/sheets de "Gerar card" no post e no insight.
- **v2 (fora de escopo):** render server-side + deep-link público compartilhável.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| **Custo de LLM** ("tudo automático" × usuários ativos) | Cache por hash do período; quota dedicada; só gerar com dados suficientes; payload agregado e compacto. |
| **Vazamento de telefone** | `profiles_private` (separação física) + toda descoberta via `public_profiles`. Revisão de qualquer view/RPC nova. |
| **Reversão do "never macros"** | Macros só saem no que o usuário **escolhe** postar; snapshot no post; feed fechado a seguidores. Atualizar FEATURES §3.5. |
| **Migração de telefone** | Migration de movimentação com backfill; atualizar `verify-phone` e match de contatos atomicamente. |
| **Tab bar nova** | Mudança de navegação (Stack → Tabs) isolada no M7; validar deep-links/rotas existentes. |
| **Moderação** | Feed fechado reduz superfície; comentários precisam de soft-delete + report básico (avaliar escopo no M7). |

---

## 9. Sequência e dependências

```
[Infra: Identidade & Descoberta] ──► M7 Feed Social ──► M9 Cards (compartilha post)
                                                   M8 Análise IA ──► M9 Cards (compartilha insight)
```

- **Ordem:** Identidade/Descoberta → M7 → M8 → M9.
- **M9 depende de M7 e M8** (precisa de "algo" para compartilhar).
- **Cada fase = seu próprio ciclo** spec detalhada → plano → revisão → implementação, sob este guarda-chuva.
- Infra compartilhada é puxada conforme a fase: foto/bucket no M7; insights no M8; nada novo de infra no M9 além do `ShareCard`.

---

## 10. Critérios de "feito" por fase

- **M7:** usuário escolhe username, encontra/segue alguém por busca, publica um post com foto+legenda+macros, e vê/curte/comenta posts de quem segue no feed. Telefone migrado para `profiles_private`; nenhuma projeção social expõe telefone.
- **M8:** usuário recebe feedback de refeição, wrap-up do dia, e relatórios de semana/mês gerados por cron, com cache/quota respeitados.
- **M9:** usuário gera e compartilha externamente um card (story/quadrado) a partir de um post ou de uma análise de IA, com marca d'água do app.

---

## 11. Próximo passo

Detalhar o **M7 — Feed Social** (incluindo a infra de Identidade & Descoberta como pré-requisito) em sua própria spec → plano → implementação.
