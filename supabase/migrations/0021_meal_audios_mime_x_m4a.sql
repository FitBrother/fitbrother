-- M2.4 follow-up. iOS' React Native FormData layer reports `audio/x-m4a`
-- as the MIME for files with a `.m4a` extension (a legacy/Apple-specific
-- alias of `audio/mp4`). Our `meal-audios` allowlist in migration 0019
-- only included the canonical `audio/mp4`, which made uploads from
-- iOS devices fail with `mime type audio/x-m4a is not supported`.
--
-- Extending the allowlist is the right fix — coercing the MIME client-side
-- doesn't help because RN's native multipart encoder sets the actual
-- Content-Type from the file extension, not from the FormData blob type
-- we pass in JS.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a'
]
WHERE id = 'meal-audios';
