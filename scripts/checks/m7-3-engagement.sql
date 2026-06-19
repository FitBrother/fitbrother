-- M7.3 engajamento — checks SQL. Roda via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m7-3-engagement.sql
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: tabelas + colunas de contagem existem.
SELECT 'check_1_tables' AS check,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_likes')
   AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_comments') AS pass;

-- Check 2: posts/post_likes/post_comments no realtime publication.
SELECT 'check_2_realtime' AS check,
       EXISTS (SELECT 1 FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime' AND tablename = 'posts')
   AND EXISTS (SELECT 1 FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime' AND tablename = 'post_likes')
   AND EXISTS (SELECT 1 FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments') AS pass;

-- Check 3: triggers de contagem (like/unlike/dup + comment/soft-delete) corretos.
-- Cria um usuário sintético + meal + post na transação (tudo dá ROLLBACK no fim).
DO $$
DECLARE
  u uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
  p uuid := gen_random_uuid();
  cid uuid := gen_random_uuid();
  c int;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (user_id, timezone) VALUES (u, 'UTC');
  INSERT INTO public.meals (id, user_id, source, meal_type, consumed_at)
    VALUES (m, u, 'app_text', 'other', now());
  INSERT INTO public.posts (id, user_id, post_type, meal_id) VALUES (p, u, 'meal', m);

  -- like → +1
  INSERT INTO public.post_likes (post_id, user_id) VALUES (p, u);
  SELECT like_count INTO c FROM public.posts WHERE id = p;
  IF c <> 1 THEN RAISE EXCEPTION 'check_3_FAIL: like_count=% (esperado 1)', c; END IF;

  -- like duplicado → no-op
  INSERT INTO public.post_likes (post_id, user_id) VALUES (p, u) ON CONFLICT DO NOTHING;
  SELECT like_count INTO c FROM public.posts WHERE id = p;
  IF c <> 1 THEN RAISE EXCEPTION 'check_3_FAIL: dup like mudou count=%', c; END IF;

  -- unlike → 0
  DELETE FROM public.post_likes WHERE post_id = p AND user_id = u;
  SELECT like_count INTO c FROM public.posts WHERE id = p;
  IF c <> 0 THEN RAISE EXCEPTION 'check_3_FAIL: unlike like_count=% (esperado 0)', c; END IF;

  -- comentar → +1
  INSERT INTO public.post_comments (id, post_id, user_id, body) VALUES (cid, p, u, 'bom prato');
  SELECT comment_count INTO c FROM public.posts WHERE id = p;
  IF c <> 1 THEN RAISE EXCEPTION 'check_3_FAIL: comment_count=% (esperado 1)', c; END IF;

  -- soft-delete comentário → -1
  UPDATE public.post_comments SET deleted_at = now() WHERE id = cid;
  SELECT comment_count INTO c FROM public.posts WHERE id = p;
  IF c <> 0 THEN RAISE EXCEPTION 'check_3_FAIL: soft-del comment_count=% (esperado 0)', c; END IF;

  RAISE NOTICE 'check_3_pass: triggers de like/comment count corretos';
END $$;

-- Check 4: notification_kind aceita post_like/post_comment.
SELECT 'check_4_notif_kinds' AS check,
       'post_like'::public.notification_kind IS NOT NULL
   AND 'post_comment'::public.notification_kind IS NOT NULL AS pass;

ROLLBACK;
