-- M1 §database. `profiles` is the application-layer mirror of auth.users.
-- Schema mirrors FEATURES §3.3.

-- ── Shared updated_at trigger ─────────────────────────────────────────────
-- Defined here (first table that needs it) and reused by later tables.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── profiles ──────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            text,
  phone_e164           text UNIQUE,
  phone_verified_at    timestamptz,
  birth_date           date,
  sex                  sex,
  activity_level       activity_level,
  goal                 goal,
  timezone             text NOT NULL,
  day_start_hour       smallint NOT NULL DEFAULT 0
                          CHECK (day_start_hour BETWEEN 0 AND 23),
  locale               text NOT NULL DEFAULT 'pt-BR',
  wa_window_expires_at timestamptz,
  lgpd_consent_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- E.164 sanity check: starts with + then 8-15 digits.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_e164_format
  CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (owner_all) ───────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner_all
  ON public.profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
