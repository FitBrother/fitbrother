-- M7.3 — Likes em posts. Contagem denormalizada em posts.like_count via trigger
-- (mesmo padrão de meals.total_*). Realtime em posts para contagem ao vivo.
CREATE TABLE public.post_likes (
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: só likes de posts que o caller enxerga. O EXISTS sobre posts respeita
-- a RLS de visibilidade de posts (autor ou segue o autor).
CREATE POLICY post_likes_visible
  ON public.post_likes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id));

-- INSERT: só como você mesmo, e só em post visível.
CREATE POLICY post_likes_owner_insert
  ON public.post_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id)
  );

-- DELETE: só o próprio like.
CREATE POLICY post_likes_owner_delete
  ON public.post_likes FOR DELETE
  USING (user_id = auth.uid());

-- ── Contagem denormalizada ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fitbrother_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_post_likes_count();

-- Realtime: o app assina mudanças em posts para refletir like_count/comment_count
-- ao vivo no feed; post_likes fica disponível para quem quiser ouvir o evento bruto.
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
