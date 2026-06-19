-- M7.3 — Comentários (lista plana) em posts. Contagem denormalizada em
-- posts.comment_count via trigger. Soft-delete (deleted_at) como em meals.
CREATE TABLE public.post_comments (
  id         uuid PRIMARY KEY,
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT post_comments_body_len CHECK (length(body) BETWEEN 1 AND 500)
);

CREATE INDEX post_comments_post_created_idx
  ON public.post_comments (post_id, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: comentários não-deletados de posts que o caller enxerga.
CREATE POLICY post_comments_visible
  ON public.post_comments FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id)
  );

-- INSERT: como você mesmo, em post visível.
CREATE POLICY post_comments_owner_insert
  ON public.post_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id)
  );

-- UPDATE: só o autor (usado pra soft-delete).
CREATE POLICY post_comments_owner_update
  ON public.post_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Contagem denormalizada ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fitbrother_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_comments_count_ins
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_post_comments_count();

CREATE TRIGGER trg_post_comments_count_upd
  AFTER UPDATE OF deleted_at ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_post_comments_count();

ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
