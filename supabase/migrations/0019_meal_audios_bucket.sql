-- M2 §storage. Private bucket for meal audio uploads.
--
-- Path convention: {user_id}/{meal_id}.opus
-- This shape is already what apps/mobile/lib/storage.ts produces, so the
-- RLS check below — auth.uid()::text = (storage.foldername(name))[1] —
-- locks each user to their own folder. The first path segment carries
-- the owner id; nothing else needs validation server-side.
--
-- Signed upload URLs (FEATURES §7.1): the server generates them via
-- service_role, which bypasses RLS on PUT. That's intentional — the
-- server is the authorization boundary at upload time. RLS still gates
-- subsequent reads, updates, and deletes.
--
-- Size & MIME enforcement happen at the application layer:
--   * Max 25 MB enforced by Fastify route (reject before download)
--   * MIME check via HEAD on the object after upload (services/meals.ts)
--   * Duration ≤ 600 s enforced post-Whisper

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-audios',
  'meal-audios',
  false,
  26214400,  -- 25 MiB
  ARRAY['audio/ogg', 'audio/opus', 'audio/webm', 'audio/mpeg', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies on storage.objects ───────────────────────────────────────
-- One policy per operation. The bucket_id filter narrows the policy's
-- scope; the foldername match locks ownership.

CREATE POLICY meal_audios_owner_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meal-audios'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY meal_audios_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'meal-audios'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY meal_audios_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'meal-audios'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'meal-audios'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY meal_audios_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'meal-audios'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
