# M7.3 — Engajamento (likes + comentários + notificações + realtime) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Fechar o M7 (Feed Social) adicionando likes e comentários (lista plana) aos posts, com contagens denormalizadas em realtime, notificações sociais (push) ao autor, e a foto opcional no post (UI que faltou no M7.2).

**Architecture:** Migrations introduzem `post_likes` e `post_comments` com triggers que mantêm `posts.like_count`/`comment_count` (mesmo padrão de `meals.total_*`), realtime via `ALTER PUBLICATION`, e novos `notification_kind` (`post_like`/`post_comment`). Backend Fastify ganha rotas de like/unlike/comentar/listar/excluir, enfileirando notificações na outbox existente. Mobile ganha `LikeButton`, tela/sheet de comentários e o picker de foto no Novo Post.

**Tech Stack:** Supabase (Postgres + RLS + Realtime + Storage), Fastify + zod, Expo Router + React Query + Realtime, `@fitbrother/shared`.

**Base:** M7.1 + M7.2 entregues (branch `feat/social-media`, merged). `posts` existe (`0041`/`0042`); backend de posts aceita `image_path`. Migrations vão até `0045`. Verificação: checks SQL rolled-back + `npm run typecheck`/`lint`; mobile e2e manual em device.

---

## File Structure

**Migrations (novas):**
- `0046_social_notification_kinds.sql` — `ALTER TYPE notification_kind ADD VALUE post_like/post_comment` (separado: enum value não pode ser usado na mesma transação em que é criado).
- `0047_post_likes.sql` — tabela + RLS + trigger de `like_count` + realtime.
- `0048_post_comments.sql` — tabela + RLS + trigger de `comment_count` + realtime.

**Checks:** `scripts/checks/m7-3-engagement.sql` + `.sh`.

**Shared:** `packages/shared/src/schemas.ts` — `CommentSchema`, `CreateCommentRequestSchema`, `CommentsResponseSchema`, `LikeResponseSchema`.

**Backend:**
- `apps/server/src/routes/posts.ts` — `POST/DELETE /posts/:id/like`, `GET/POST /posts/:id/comments`, `DELETE /comments/:id`; enfileira notificações.
- `apps/server/src/services/notifications.ts` — `renderPush` cases `post_like`/`post_comment`.

**Mobile:**
- `apps/mobile/lib/api/posts.ts` — like/unlike/comments client.
- `apps/mobile/lib/hooks/{useToggleLike,useComments,useAddComment,usePostsRealtime}.ts`.
- `apps/mobile/components/domain/{LikeButton,CommentButton,CommentInput,CommentRow}.tsx`.
- `apps/mobile/app/(app)/post/[id].tsx` — detalhe + comentários (se ainda não existir).
- `apps/mobile/app/(app)/post/new.tsx` — adicionar picker de foto (upload pro bucket `post-images`, grava `image_path`).
- `apps/mobile/components/domain/PostCard.tsx` — ligar like/comentário + contagens.

---

## Task 1: Migration `0046` — kinds de notificação social
- [ ] Criar `0046_social_notification_kinds.sql`: `ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'post_like'; ADD VALUE IF NOT EXISTS 'post_comment';`
- [ ] `npm run db:reset` aplica sem erro.
- [ ] Commit.

## Task 2: Migration `0047_post_likes.sql` + check
- [ ] Escrever check (em `scripts/checks/m7-3-engagement.sql`): like incrementa `posts.like_count`, unlike decrementa, like duplicado é no-op (ON CONFLICT).
- [ ] Rodar check → falha (tabela não existe).
- [ ] Escrever migration: tabela `post_likes(post_id FK posts ON DELETE CASCADE, user_id FK auth.users, created_at)`, PK `(post_id,user_id)`; RLS (insert/delete do próprio user_id; select de quem enxerga o post); trigger `AFTER INSERT/DELETE` mantém `posts.like_count`; `ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes`.
- [ ] `npm run db:reset` + check → passa.
- [ ] Commit.

## Task 3: Migration `0048_post_comments.sql` + check
- [ ] Adicionar check: comentar incrementa `comment_count`; soft-delete decrementa.
- [ ] Rodar → falha.
- [ ] Migration: `post_comments(id uuid PK, post_id FK ON DELETE CASCADE, user_id FK, body text CHECK 1..500, created_at, deleted_at)`; RLS (select de quem vê o post; insert/delete do próprio autor); trigger `AFTER INSERT / UPDATE OF deleted_at` mantém `posts.comment_count`; realtime.
- [ ] `npm run db:reset` + check → passa.
- [ ] Commit.

## Task 4: Shared schemas
- [ ] Adicionar `CommentSchema` (id, post_id, user_id, body, created_at, author: PublicProfile), `CreateCommentRequestSchema` ({ id, body }), `CommentsResponseSchema`, `LikeResponseSchema` ({ liked, like_count }).
- [ ] `npm run typecheck` → passa. Commit.

## Task 5: Backend — like/comment routes + notificações
- [ ] Em `posts.ts`: `POST /posts/:id/like` (upsert ON CONFLICT, lê post visível, enfileira `post_like` se ator≠autor), `DELETE /posts/:id/like`; `GET /posts/:id/comments` (paginado, autor via `public_profiles`), `POST /posts/:id/comments` (insere + enfileira `post_comment` se ator≠autor), `DELETE /comments/:id` (soft, só autor).
- [ ] `renderPush`: cases `post_like` ("Curtiram seu post 👏") e `post_comment` ("Comentário novo 💬", body = trecho).
- [ ] `npm run typecheck` + `lint` → passam. Commit.

## Task 6: Mobile — likes + comentários + realtime
- [ ] `lib/api/posts.ts`: `toggleLike`, `fetchComments`, `addComment`, `deleteComment`.
- [ ] Hooks: `useToggleLike` (optimistic), `useComments`, `useAddComment`, `usePostsRealtime` (invalida feed/contagens em mudança de `posts`).
- [ ] Componentes: `LikeButton` (coração + contagem, tabular-nums, 44px, accessibilityLabel), `CommentButton`, `CommentInput`, `CommentRow`.
- [ ] `PostCard`: ligar like/comentário + contagens.
- [ ] `post/[id].tsx`: lista de comentários + input.
- [ ] `npm run typecheck` + `lint` → passam. Commit.

## Task 7: Mobile — foto no Novo Post
- [ ] `post/new.tsx`: botão de foto opcional (`expo-image-picker`), upload pro bucket `post-images` em `{user_id}/post-{id}.jpg` (RLS por prefixo já existe), passar `image_path` no `POST /posts`. Preview da imagem + fallback sem foto.
- [ ] `PostCard`: renderizar `image_path` quando presente (signed URL via supabase storage).
- [ ] `npm run typecheck` + `lint` → passam. Commit.

## Verificação final
- [ ] `npm run db:reset && ./scripts/checks/m7-3-engagement.sh` → todos os checks passam.
- [ ] `npm run typecheck && npm run lint` → limpos.
- [ ] e2e manual (device): curtir/descurtir atualiza contagem; comentar aparece; foto no post sobe e renderiza; push de like/comentário chega.
- [ ] Atualizar `docs/PLAN.md` §M7 com **Status M7.3** + marcar M7 como concluído. Abrir PR.

**Feito quando:** likes e comentários funcionam com contagem em realtime, foto opcional no post sobe e renderiza, notificações de like/comentário são enfileiradas, e os critérios acima passam.
