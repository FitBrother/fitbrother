-- M2 §database. Per-user/day AI cost accounting.
--
-- Two write paths the server must touch:
--   1. assert_within_cap  — BEFORE calling Whisper/Gemini. Raises
--      AI_QUOTA_EXCEEDED if the user's day-bucket counter is already
--      at or above the env-defined cap. Server catches and returns 429.
--   2. record_ai_usage    — AFTER a real provider call succeeds. Cache
--      hits should NOT call record (otherwise a user with all-cached
--      inputs locks themselves out by re-submitting the same meal).
--
-- The day bucket follows the nutritional boundary, not current_date — a
-- user with day_start_hour=3 in São Paulo who registers a meal at 02:30
-- counts against the *previous* nutritional day, matching what they see
-- on the home screen.
--
-- Race notes
-- ──────────
-- Between assert and record there's a ~1-2s window where a flood of
-- requests could overshoot the cap. Acceptable for MVP given:
--   * caps are dimensioned for ~50 meals/day already (10× normal use)
--   * the server has per-user rate limit (30 req/min) as a second line
-- A future hardening would do conditional INSERT … ON CONFLICT UPDATE
-- with a WHERE clause that fails if the new value exceeds the cap,
-- atomicizing assert+record into one call.

CREATE TABLE public.ai_usage (
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day                    date NOT NULL,
  transcription_seconds  numeric(8,2) NOT NULL DEFAULT 0
                           CHECK (transcription_seconds >= 0),
  llm_input_tokens       int NOT NULL DEFAULT 0
                           CHECK (llm_input_tokens >= 0),
  llm_output_tokens      int NOT NULL DEFAULT 0
                           CHECK (llm_output_tokens >= 0),
  llm_cost_cents         numeric(8,2) NOT NULL DEFAULT 0
                           CHECK (llm_cost_cents >= 0),
  transcription_cost_cents numeric(8,2) NOT NULL DEFAULT 0
                           CHECK (transcription_cost_cents >= 0),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_owner_read
  ON public.ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Writes are server-mediated via SECURITY DEFINER functions below;
-- no INSERT/UPDATE policy needed.

-- ── assert_within_cap ─────────────────────────────────────────────────────
-- Raises 'AI_QUOTA_EXCEEDED' when the current bucket value for the kind
-- is already >= cap. Server passes the env-defined cap so config lives
-- in one place (.env), not the database.
--
-- p_kind values: 'llm_tokens' | 'whisper_seconds' | 'cost_cents'.
CREATE OR REPLACE FUNCTION public.fitbrother_assert_ai_cap(
  p_user_id uuid,
  p_kind    text,
  p_cap     numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day     date;
  v_current numeric := 0;
BEGIN
  IF p_user_id IS NULL OR p_kind IS NULL OR p_cap IS NULL THEN
    RAISE EXCEPTION 'assert_ai_cap requires user_id, kind, cap';
  END IF;

  v_day := public.fitbrother_nutritional_day(p_user_id, now());

  SELECT
    CASE p_kind
      WHEN 'llm_tokens'      THEN COALESCE(llm_input_tokens + llm_output_tokens, 0)::numeric
      WHEN 'whisper_seconds' THEN COALESCE(transcription_seconds, 0)
      WHEN 'cost_cents'      THEN COALESCE(llm_cost_cents + transcription_cost_cents, 0)
    END
    INTO v_current
  FROM public.ai_usage
  WHERE user_id = p_user_id AND day = v_day;

  v_current := COALESCE(v_current, 0);

  IF v_current >= p_cap THEN
    RAISE EXCEPTION USING
      MESSAGE = 'AI_QUOTA_EXCEEDED',
      DETAIL  = format('kind=%s current=%s cap=%s day=%s',
                       p_kind, v_current, p_cap, v_day),
      ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── record_ai_usage ───────────────────────────────────────────────────────
-- Upsert delta for the user's current nutritional day. Called only on a
-- real provider call (Whisper or LLM); cache hits skip this.
CREATE OR REPLACE FUNCTION public.fitbrother_record_ai_usage(
  p_user_id            uuid,
  p_transcription_seconds numeric DEFAULT 0,
  p_llm_input_tokens   int DEFAULT 0,
  p_llm_output_tokens  int DEFAULT 0,
  p_llm_cost_cents     numeric DEFAULT 0,
  p_transcription_cost_cents numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date;
BEGIN
  v_day := public.fitbrother_nutritional_day(p_user_id, now());

  INSERT INTO public.ai_usage (
    user_id, day,
    transcription_seconds, llm_input_tokens, llm_output_tokens,
    llm_cost_cents, transcription_cost_cents, updated_at
  ) VALUES (
    p_user_id, v_day,
    COALESCE(p_transcription_seconds, 0),
    COALESCE(p_llm_input_tokens, 0),
    COALESCE(p_llm_output_tokens, 0),
    COALESCE(p_llm_cost_cents, 0),
    COALESCE(p_transcription_cost_cents, 0),
    now()
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    transcription_seconds    = ai_usage.transcription_seconds
                                + EXCLUDED.transcription_seconds,
    llm_input_tokens         = ai_usage.llm_input_tokens
                                + EXCLUDED.llm_input_tokens,
    llm_output_tokens        = ai_usage.llm_output_tokens
                                + EXCLUDED.llm_output_tokens,
    llm_cost_cents           = ai_usage.llm_cost_cents
                                + EXCLUDED.llm_cost_cents,
    transcription_cost_cents = ai_usage.transcription_cost_cents
                                + EXCLUDED.transcription_cost_cents,
    updated_at               = now();
END;
$$;
