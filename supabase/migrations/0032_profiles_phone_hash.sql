-- M5.3 — phone_hash em profiles. Gravado quando o telefone é verificado
-- (POST /me/verify-phone): SHA-256 hex do phone_e164. É a chave que casa contra
-- contact_links.phone_hash. phone_e164 já é UNIQUE (0003), então dois usuários
-- não podem verificar o mesmo número.
ALTER TABLE public.profiles ADD COLUMN phone_hash text;
CREATE INDEX profiles_phone_hash_idx ON public.profiles (phone_hash)
  WHERE phone_hash IS NOT NULL;
