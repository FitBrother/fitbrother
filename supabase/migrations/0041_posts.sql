-- M7.2 — Feed core. Posts are opt-in meal shares with a macro snapshot.
CREATE TABLE public.posts (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id         uuid NOT NULL REFERENCES public.meals(id) ON DELETE RESTRICT,
  caption         text,
  image_path      text,
  total_kcal      numeric(8,2) NOT NULL DEFAULT 0,
  total_protein_g numeric(8,2) NOT NULL DEFAULT 0,
  total_carbs_g   numeric(8,2) NOT NULL DEFAULT 0,
  total_fat_g     numeric(8,2) NOT NULL DEFAULT 0,
  like_count      int NOT NULL DEFAULT 0,
  comment_count   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT posts_caption_len CHECK (caption IS NULL OR length(caption) <= 280),
  CONSTRAINT posts_one_per_meal_per_user UNIQUE (user_id, meal_id)
);

CREATE INDEX posts_user_created_idx ON public.posts (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_visible_to_author_or_followers
  ON public.posts
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = posts.user_id
      )
    )
  );

CREATE POLICY posts_owner_insert
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY posts_owner_update
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY posts_owner_delete
  ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);
