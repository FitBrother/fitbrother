-- M7.2 follow-up — Allow achievement shares in the same feed as meal posts.
ALTER TABLE public.posts
  ALTER COLUMN meal_id DROP NOT NULL,
  ADD COLUMN achievement_id uuid REFERENCES public.achievements(id) ON DELETE RESTRICT,
  ADD COLUMN post_type text NOT NULL DEFAULT 'meal';

ALTER TABLE public.posts
  ADD CONSTRAINT posts_type_valid
  CHECK (post_type IN ('meal', 'achievement'));

ALTER TABLE public.posts
  ADD CONSTRAINT posts_type_payload
  CHECK (
    (post_type = 'meal' AND meal_id IS NOT NULL AND achievement_id IS NULL)
    OR
    (post_type = 'achievement' AND meal_id IS NULL AND achievement_id IS NOT NULL)
  );

CREATE UNIQUE INDEX posts_one_per_achievement_per_user_idx
  ON public.posts (user_id, achievement_id)
  WHERE achievement_id IS NOT NULL AND deleted_at IS NULL;
