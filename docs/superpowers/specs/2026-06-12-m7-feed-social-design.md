# M7 — Feed Social + Identidade & Descoberta (design)

**Data:** 2026-06-12
**Fase:** 2 (transição para rede social). Primeira de três: M7 → M8 → M9.
**Roadmap canônico:** [`docs/PLAN.md`](../../PLAN.md) §M7. Decisões transversais da Fase 2: [`2026-06-12-m7-m9-rede-social-master-plan-design.md`](2026-06-12-m7-m9-rede-social-master-plan-design.md).
**Status:** aprovado para implementação.

---

## 1. Objetivo

Transformar o registro solitário em ação social. Ao fim do M7, um usuário consegue:

1. Escolher um **username** no onboarding e ser encontrado por busca.
2. Publicar uma refeição já processada pela IA como **post** (foto opcional + legenda + snapshot de macros).
3. Ver no **Feed** os posts de quem segue, com **likes** e **comentários** (lista plana), em realtime.
4. Ter o **telefone blindado** numa tabela isolada (`profiles_private`), inacessível a qualquer query de descoberta.

## 2. Decisões fechadas (do brainstorm)

| Tema | Decisão |
|------|---------|
| Visibilidade | Feed fechado: só seguidores. Macros **visíveis** no post (snapshot). |
| Foto | Opcional, anexada na tela de Novo Post. Não altera o core de registro. |
| Post | Sempre opt-in; sempre vinculado a uma refeição no MVP (sem post avulso). |
| Navegação | **Top tab bar** `Hoje | Feed`; composer fixo no rodapé só na Hoje. Amigos/Perfil/Histórico seguem como ícones no header. |
| Username | Só no onboarding (sem usuários reais → sem backfill/tela forçada). |
| Escopo | Likes + comentários planos. **Fora:** report/block, post avulso, threads. |
| Telefone | Movido para `profiles_private` (RLS owner + service-role). |

## 3. Arquitetura

Três blocos, implementáveis em sequência: **(A) Identidade & Descoberta** (pré-requisito) → **(B) Feed** → **(C/D) Backend + Mobile**.

> **Numeração de migrations:** existentes vão até `0036`; M7 começa em `0037`.

### A. Identidade & Descoberta

#### A.1 `0037_profiles_username.sql`
- `profiles.username citext UNIQUE` — `CHECK (username ~ '^[a-z0-9_.]{3,20}$')`. Nullable até a escolha (mas o onboarding passa a exigir).
- `profiles.avatar_url text` (nullable; fallback = iniciais no cliente).
- Índice implícito do UNIQUE serve a busca exata; busca por prefixo usa `username text_pattern_ops` ou `pg_trgm` (já temos `pg_trgm` da `0001`).

#### A.2 `0038_profiles_private.sql`
- Nova tabela `profiles_private (user_id uuid PK REFERENCES auth.users ON DELETE CASCADE, phone_e164 text UNIQUE, phone_hash text, phone_verified_at timestamptz, updated_at)`.
- **Migração de movimentação:** copia `phone_e164/phone_hash/phone_verified_at` de `profiles` para `profiles_private` (backfill best-effort — sem usuários reais), depois **dropa essas colunas de `profiles`**. Mantém a constraint de formato E.164 e o índice de `phone_hash`.
- RLS: `owner_all` (`auth.uid() = user_id`). Service-role (backend) bypassa para o reverse-match e o verify-phone.
- **Atualizar consumidores:**
  - `POST /me/verify-phone` (`apps/server/src/routes/me.ts` / service) passa a gravar em `profiles_private`.
  - reverse-match de contatos (`apps/server/src/services/contacts.ts`) passa a ler `profiles_private.phone_hash`.
  - Qualquer view/RPC que tocava `profiles.phone_*` (nenhuma social hoje) — confirmar no diff.

#### A.3 `0039_public_profiles.sql`
- View `public_profiles` (`security_invoker`) → `SELECT user_id, username, full_name AS display_name, avatar_url FROM profiles`. **Nunca** telefone.
- `GRANT SELECT ON public_profiles TO authenticated`.
- Toda leitura social de identidade de terceiros passa a usar esta view: autor de post, busca, `following`, leaderboard. (Refatorar `fitbrother_weekly_leaderboard` e `following_summaries_view` para join em `public_profiles` em vez de `profiles` direto — defesa em profundidade.)

#### A.4 Bucket de imagem (`0040_post_images_bucket.sql`)
- Bucket privado `post-images`, MIME `image/jpeg|png|webp`, limite ~5 MB. RLS por prefixo `{user_id}/` (espelha `meal-audios`). Serve também avatares no prefixo `{user_id}/avatar.*`.
- Upload assinado direto do cliente (signed upload URL via service-role, como já é feito p/ áudio).

#### A.5 Onboarding (mobile)
- Novo step de **username** (com check de disponibilidade em tempo real) + **avatar opcional** (image picker → upload → `avatar_url`). Encaixe natural após o step de nome.
- `useOnboardingStore` ganha `username`/`avatarPath`; `POST /onboarding/complete` passa a persistir `username` + `avatar_url`.

### B. Feed (schema)

#### B.1 `0041_posts.sql`
```
posts (
  id              uuid PK,                    -- client-gen p/ optimistic UI
  user_id         uuid FK auth.users,
  meal_id         uuid FK meals NOT NULL,     -- MVP: sempre vinculado
  caption         text,
  image_path      text,                       -- bucket post-images; null se sem foto
  total_kcal      numeric(8,2),               -- SNAPSHOT no publish
  total_protein_g numeric(8,2),
  total_carbs_g   numeric(8,2),
  total_fat_g     numeric(8,2),
  like_count      int NOT NULL DEFAULT 0,     -- denormalizado via trigger
  comment_count   int NOT NULL DEFAULT 0,     -- denormalizado via trigger
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
)
```
- Índice `(user_id, created_at DESC) WHERE deleted_at IS NULL`.
- **RLS leitura:** `deleted_at IS NULL AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = auth.uid() AND f.followee_id = posts.user_id))`.
- **RLS escrita:** INSERT/UPDATE/DELETE só com `user_id = auth.uid()`.
- Snapshot: o `POST /posts` copia `meals.total_*` no momento da publicação (não referencia ao vivo) — editar/deletar a meal depois não muda o feed.

#### B.2 `0042_post_likes.sql`
- `post_likes (post_id FK posts ON DELETE CASCADE, user_id FK auth.users, created_at)`, PK `(post_id, user_id)`.
- RLS: INSERT/DELETE do próprio `user_id`, **desde que** o post seja visível ao caller (subquery em posts/RLS). SELECT idem visibilidade.
- Trigger `AFTER INSERT/DELETE` mantém `posts.like_count`.

#### B.3 `0043_post_comments.sql`
- `post_comments (id uuid PK, post_id FK ON DELETE CASCADE, user_id FK, body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500), created_at, deleted_at)`.
- RLS leitura: post visível + `deleted_at IS NULL`. Escrita: só autor do comentário (e post visível).
- Trigger `AFTER INSERT / UPDATE OF deleted_at` mantém `posts.comment_count`.

#### B.4 Realtime
- Habilitar Realtime em `posts` (atualização de `like_count`/`comment_count` ao vivo) e opcionalmente `post_comments` (novos comentários na tela aberta). RLS do Realtime respeita as policies acima.

### C. Backend (Fastify — `apps/server/src/routes/`)

Novo arquivo `routes/posts.ts` + extensão de `routes/social.ts`/`me.ts`:

| Rota | Descrição |
|------|-----------|
| `GET /users/search?q=` | Busca por username (prefixo, via `public_profiles`); gate em `phone_verified_at`. |
| `GET /users/username-available?u=` | Checagem de disponibilidade (onboarding). |
| `POST /onboarding/complete` (ext.) | Passa a aceitar `username` + `avatar_url`. |
| `POST /posts` | `{ id, meal_id, caption?, image_path? }` → valida ownership da meal, copia snapshot de macros, INSERT. |
| `GET /feed?cursor=` | Posts de quem o caller segue + próprios, `created_at DESC`, paginação keyset; inclui `author` (public_profiles), `like_count`, `comment_count`, `liked_by_me`. |
| `GET /posts/:id` | Detalhe (respeita RLS). |
| `DELETE /posts/:id` | Soft delete (dono). |
| `POST /posts/:id/like` · `DELETE /posts/:id/like` | Toggle like. |
| `GET /posts/:id/comments?cursor=` · `POST /posts/:id/comments` · `DELETE /comments/:id` | Comentários planos. |

- **Notificações:** ao curtir/comentar (ator ≠ autor), enfileira `notifications` com `kind` novos `post_like`/`post_comment` (enum `notification_kind` ganha 2 valores) + render cases em `services/notifications.ts`. Reusa `dispatchPendingPush`.
- **Zod schemas** em `packages/shared` (`PostSchema`, `CreatePostSchema`, `CommentSchema`, `UsernameSchema`).

### D. Mobile (`apps/mobile/`)

#### D.1 Navegação — top tab bar
- Reestruturar `app/(app)/` para um layout com **top tabs** `Hoje | Feed`.
- **Implementação:** segmented control leve próprio (Pressable + Reanimated p/ o indicador), trocando o conteúdo — evita dep nova de navegação. Swipe entre tabs fica como nice-to-have (avaliar `react-native-pager-view` só se necessário; alinhar antes de adicionar). Header atual (saudação + streak + ícones Histórico/Amigos/Perfil) permanece **acima** das tabs; composer fixo no rodapé **só** quando a tab ativa é Hoje.
- Hoje = tela atual inalterada. Feed = nova tela.

#### D.2 Telas e componentes
- `app/(app)/feed/index.tsx` — `FlatList` de `PostCard`, pull-to-refresh, infinite scroll (keyset), empty state ("Siga alguém para ver posts" + atalho pra busca).
- `app/(app)/post/[id].tsx` — detalhe + comentários.
- `app/(app)/post/new.tsx` — Novo Post (recebe `meal_id`): preview do card de macros, foto opcional (`expo-image-picker` câmera/galeria + compressão `expo-image-manipulator`), legenda, publicar.
- `app/(app)/users/search.tsx` — busca por username + seguir.
- Componentes domínio: `PostCard`, `PostHeader` (Avatar + username + timestamp), `Avatar` (fallback iniciais), `LikeButton`, `CommentButton`, `CommentList`, `CommentInput`, `MacroSummaryRow` (reusa `MacroBar`/tokens).
- Hooks React Query: `useFeed` (infinite), `usePost`, `useCreatePost`, `useToggleLike` (optimistic), `useComments`, `useAddComment`, `useUserSearch`, `useUsernameAvailable`; realtime `usePostsRealtime` (invalida contagens).

#### D.3 CTA de compartilhamento
- Na tela de detalhe da refeição (`app/(app)/meal/[id]/index.tsx`): botão **"Compartilhar no feed"** → `post/new?meal_id=...`. (Refeições de baixa confiança / `review_required` só ganham o CTA após confirmar.)
- Após publicar: toast de sucesso + navega para o Feed.

## 4. Fluxo de dados (publicação)

```
meal salva (IA) ──► tela detalhe ──► "Compartilhar no feed"
   ──► NewPost: foto? (picker→signed upload→post-images) + legenda
   ──► POST /posts {id, meal_id, caption, image_path}
        └─ server copia meals.total_* → posts snapshot
   ──► Feed (Realtime/refetch) mostra o post
   ──► like/comment de terceiros ──► trigger atualiza counts (Realtime)
                                  ──► notifications (push) ao autor
```

## 5. Tratamento de erros

- **Username em uso / inválido:** 409/422 com código; UI mostra inline no onboarding (check em tempo real evita a maioria).
- **Upload de foto falha:** post pode ser publicado sem foto (opcional); UI permite retry do upload antes de publicar.
- **Meal não pertence ao caller / não existe:** 403/404 no `POST /posts`.
- **Like duplicado:** `ON CONFLICT DO NOTHING` (idempotente); UI optimistic reconcilia.
- **Post fora de visibilidade (deixou de seguir):** RLS retorna vazio; cliente trata 404/empty.

## 6. Testes

- **SQL/RLS (padrão dos checks existentes em `scripts/checks/`):** terceiro que não segue **não** lê posts; seguidor lê; ninguém lê `profiles_private` de outro; `public_profiles` não expõe telefone; triggers de count corretos em like/unlike/comentar/soft-delete; snapshot não muda ao editar a meal.
- **e2e backend (rolled-back):** publicar → aparece no feed do seguidor; like → count++ + notificação enfileirada; comentar idem; soft-delete some do feed.
- **Mobile:** typecheck + lint; verificação visual exige device (picker/realtime) — registrar como no M5.

## 7. Fora de escopo (M7) / follow-ups

- Report/block, threads de comentário, post avulso (sem refeição) → v2.
- **FEATURES.md:** documentar seção social Fase 2 (posts/feed) quando estabilizar; reforçar reversão controlada do "never macros" (macros só em `posts`; `following_summaries_view` segue sem macros).
- **M6/LGPD:** incluir `posts`/`post_likes`/`post_comments`/`profiles_private` no export/delete.
- **M9:** o `PostCard` e o card de macros são a base do `ShareCard` (compartilhamento externo).

## 8. Feito quando

Username escolhido no onboarding; busca acha e segue um usuário; refeição publicada com foto+legenda+macros aparece no feed de quem segue; like e comentário funcionam com contagem em realtime; telefone vive em `profiles_private` e nenhuma projeção social retorna telefone (validado via SQL com JWT de terceiro); typecheck + lint limpos.
