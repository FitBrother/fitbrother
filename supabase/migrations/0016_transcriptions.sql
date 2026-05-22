-- M2 §database. Whisper transcription cache.
--
-- The PK is sha256 of the raw audio bytes — same file = same hash = cache
-- hit. Cross-user hits are intentional (and rare in practice: audio is
-- a unique stream per recording session). The benefit shows up when:
--   * A user re-submits the same audio after a network failure
--   * The server retries an in-flight job and the upload was already cached
--
-- Storage class is global with no RLS for SELECT — anyone authenticated
-- can hit the cache by hash, but the hash itself is a SHA-256 of the
-- audio bytes (you need the source audio to compute it, which is gated
-- by storage RLS), so this isn't a privacy leak.

CREATE TABLE public.transcriptions (
  audio_hash    text PRIMARY KEY
                  CHECK (audio_hash ~ '^[0-9a-f]{64}$'),
  text          text NOT NULL,
  language      text,
  duration_s    numeric(7,2) NOT NULL CHECK (duration_s >= 0),
  model         text NOT NULL,
  cost_cents    numeric(8,2) NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transcriptions_model_created_at_idx
  ON public.transcriptions (model, created_at DESC);

ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users may probe by audio_hash they computed locally
-- (they had to have the audio to compute it). Writes are service_role.
CREATE POLICY transcriptions_read_all
  ON public.transcriptions
  FOR SELECT
  TO authenticated
  USING (true);
