-- M2 §database. LLM extraction cache + per-user hit log.
--
-- Two tables on purpose:
--
-- ai_extractions  → the cached LLM output. Global, keyed by sha256(text +
--                   prompt_version + locale). Same text from any user gets
--                   the same answer (it's a function of the input). Bumping
--                   LLM_PROMPT_VERSION invalidates the entire cache without
--                   a TRUNCATE: new requests miss because their hash differs.
--
-- ai_extraction_hits → per-user log of which cached extractions each user
--                   touched, with timestamps. Used for:
--                     * Cost-per-user analytics (sum hits * cost_cents
--                       from extractions JOIN)
--                     * LGPD scrubbing (delete hits for a user without
--                       breaking the shared cache)
--                     * Detecting abuse patterns (one user hitting same
--                       hash 1k times in an hour → likely a script)
--
-- Keeping these separate means the cache table stays small and clean while
-- the hits table absorbs the per-user write volume.

CREATE TABLE public.ai_extractions (
  input_hash      text PRIMARY KEY
                    CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  result_json     jsonb NOT NULL,
  model           text NOT NULL,
  prompt_version  text NOT NULL,
  tokens_input    int NOT NULL DEFAULT 0 CHECK (tokens_input >= 0),
  tokens_output   int NOT NULL DEFAULT 0 CHECK (tokens_output >= 0),
  cost_cents      numeric(8,2) NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  confidence      numeric(3,2)
                    CHECK (confidence IS NULL
                           OR (confidence >= 0 AND confidence <= 1)),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_extractions_prompt_version_idx
  ON public.ai_extractions (prompt_version, created_at DESC);

ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_extractions_read_all
  ON public.ai_extractions
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Per-user hit log ─────────────────────────────────────────────────────
CREATE TABLE public.ai_extraction_hits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_hash   text NOT NULL REFERENCES public.ai_extractions(input_hash)
                 ON DELETE CASCADE,
  was_cache_hit boolean NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_extraction_hits_user_at_idx
  ON public.ai_extraction_hits (user_id, occurred_at DESC);

CREATE INDEX ai_extraction_hits_hash_idx
  ON public.ai_extraction_hits (input_hash);

ALTER TABLE public.ai_extraction_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_extraction_hits_owner_read
  ON public.ai_extraction_hits
  FOR SELECT
  USING (auth.uid() = user_id);
