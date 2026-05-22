-- M2 §database. Meal events.
--
-- Key design decisions:
--   * `id` has NO default. The client generates a UUIDv4 (`client_meal_id`)
--     before submitting, sends it as the request body, and the server uses
--     it verbatim as meals.id. This enables clean optimistic UI: the local
--     skeleton card already has the right ID before the network roundtrip,
--     and Realtime de-dups via primary key when both the POST response and
--     the WAL stream land. Retries become idempotent (ON CONFLICT DO NOTHING).
--   * total_* macros are kept by trigger from meal_items (CLAUDE.md rule #7
--     — Postgres can't GENERATED ALWAYS reference another table).
--   * Soft delete (`deleted_at`) per CLAUDE.md rule #11. The trigger filters
--     deleted rows out of `meals.total_*` and `daily_summaries`.
--   * `review_required = true` (confidence < 0.6) excludes the meal from
--     `daily_summaries` until the user confirms via POST /meals/:id/confirm.

CREATE TABLE public.meals (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source            meal_source NOT NULL,
  raw_input         text,
  audio_path        text,
  meal_type         meal_type NOT NULL,
  consumed_at       timestamptz NOT NULL DEFAULT now(),
  total_kcal        numeric(8,2) NOT NULL DEFAULT 0
                      CHECK (total_kcal >= 0),
  total_protein_g   numeric(8,2) NOT NULL DEFAULT 0
                      CHECK (total_protein_g >= 0),
  total_carbs_g     numeric(8,2) NOT NULL DEFAULT 0
                      CHECK (total_carbs_g >= 0),
  total_fat_g       numeric(8,2) NOT NULL DEFAULT 0
                      CHECK (total_fat_g >= 0),
  confidence        numeric(3,2) CHECK (confidence IS NULL
                                         OR (confidence >= 0 AND confidence <= 1)),
  review_required   boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- Sanity: app_audio/wa_audio must have an audio_path; text variants must not.
ALTER TABLE public.meals
  ADD CONSTRAINT meals_audio_path_matches_source
  CHECK (
    (source IN ('app_audio', 'wa_audio') AND audio_path IS NOT NULL)
    OR
    (source IN ('app_text', 'wa_text', 'manual') AND audio_path IS NULL)
  );

-- Bound consumed_at: refuse far-future entries and very-old backfills.
-- Server can still PATCH within this window; outside it requires explicit
-- override (not exposed in MVP).
ALTER TABLE public.meals
  ADD CONSTRAINT meals_consumed_at_sane_window
  CHECK (
    consumed_at <= now() + interval '1 day'
    AND consumed_at >= now() - interval '90 days'
  );

-- Hot-path index: home screen lists today's meals.
CREATE INDEX meals_user_consumed_at_idx
  ON public.meals (user_id, consumed_at DESC)
  WHERE deleted_at IS NULL;

-- Index para retry/processing futuro (M4 WhatsApp, M6 cron purge).
CREATE INDEX meals_deleted_at_idx
  ON public.meals (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE TRIGGER meals_set_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (owner_all) ───────────────────────────────────────────────────────
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY meals_owner_all
  ON public.meals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
