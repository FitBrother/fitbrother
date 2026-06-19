-- M7.2 follow-up — update source/audio constraint after app_photo enum commit.
ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_audio_path_matches_source;
ALTER TABLE public.meals
  ADD CONSTRAINT meals_audio_path_matches_source
  CHECK (
    (source IN ('app_audio', 'wa_audio') AND audio_path IS NOT NULL)
    OR
    (source IN ('app_text', 'app_photo', 'wa_text', 'wa_audio', 'manual') AND audio_path IS NULL)
  );
