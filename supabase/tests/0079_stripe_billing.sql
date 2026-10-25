-- Smoke test 0079: subscriptions read-only for clients, stripe_events service-only.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _t (uid uuid, uid2 uuid);
GRANT ALL ON _t TO PUBLIC;

DO $$
DECLARE
  u  uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email)
  VALUES (u,  'authenticated', 'authenticated', 'stripe-smoke-1@example.invalid'),
         (u2, 'authenticated', 'authenticated', 'stripe-smoke-2@example.invalid');
  INSERT INTO _t VALUES (u, u2);
END $$;

-- Fresh user onboarding must still create the subscriptions row (SECURITY DEFINER path).
DO $$
DECLARE
  u uuid; n int; r jsonb;
BEGIN
  SELECT uid INTO u FROM _t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.complete_onboarding(jsonb_build_object(
    'full_name', 'Smoke Test', 'username', 'stripe_smoke_1',
    'birth_date', '1990-01-01', 'sex', 'male', 'activity_level', 'moderate',
    'goal', 'maintain', 'timezone', 'America/Sao_Paulo', 'day_start_hour', 0,
    'weight_kg', 80, 'height_cm', 180, 'body_fat_pct', 20,
    'strength_training', false, 'is_pregnant_or_lactating', false,
    'has_kidney_disease', false, 'has_type1_diabetes', false,
    'uses_glp1', false, 'tca_screening_positive', false,
    'consents', jsonb_build_object('terms', true, 'privacy', true,
      'ai_processing', true, 'health_data', true, 'policy_version', 'v1.0'),
    'targets', jsonb_build_object('bmr_kcal', 1800, 'tdee_kcal', 2500, 'kcal', 2500,
      'protein_g', 150, 'carbs_g', 300, 'fat_g', 70, 'fiber_g', 30)));
  RESET ROLE;
  SELECT count(*) INTO n FROM public.subscriptions WHERE user_id = u;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL onboarding: expected 1 subscriptions row, got %', n; END IF;
  RAISE NOTICE 'PASS onboarding creates subscriptions row';
END $$;

-- Other user's row, created by the table owner.
INSERT INTO public.subscriptions (user_id) SELECT uid2 FROM _t;

-- authenticated: SELECT own row only; writes denied.
DO $$
DECLARE
  u uuid; n int;
BEGIN
  SELECT uid INTO u FROM _t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.subscriptions;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL select: expected exactly own row, got %', n; END IF;
  RAISE NOTICE 'PASS authenticated sees only own row';

  BEGIN
    UPDATE public.subscriptions SET plan = 'pro' WHERE user_id = u;
    RAISE EXCEPTION 'FAIL update: authenticated UPDATE was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated UPDATE denied';
  END;

  BEGIN
    INSERT INTO public.subscriptions (user_id) VALUES (u);
    RAISE EXCEPTION 'FAIL insert: authenticated INSERT was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated INSERT denied';
  END;

  BEGIN
    DELETE FROM public.subscriptions WHERE user_id = u;
    RAISE EXCEPTION 'FAIL delete: authenticated DELETE was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated DELETE denied';
  END;

  BEGIN
    PERFORM 1 FROM public.stripe_events;
    RAISE EXCEPTION 'FAIL stripe_events: authenticated SELECT was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated cannot read stripe_events';
  END;

  RESET ROLE;
END $$;

-- anon: no write, no stripe_events.
DO $$
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    UPDATE public.subscriptions SET plan = 'pro';
    RAISE EXCEPTION 'FAIL anon UPDATE was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS anon UPDATE denied';
  END;
  BEGIN
    PERFORM 1 FROM public.stripe_events;
    RAISE EXCEPTION 'FAIL anon stripe_events SELECT was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS anon cannot read stripe_events';
  END;
  RESET ROLE;
END $$;

-- service_role: can update subscriptions and insert stripe_events.
DO $$
DECLARE
  u uuid; n int;
BEGIN
  SELECT uid INTO u FROM _t;
  SET LOCAL ROLE service_role;
  UPDATE public.subscriptions SET plan = 'pro', stripe_customer_id = 'cus_smoke_1' WHERE user_id = u;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL service_role UPDATE affected % rows', n; END IF;
  INSERT INTO public.stripe_events (event_id, type) VALUES ('evt_smoke_1', 'checkout.session.completed');
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = u AND plan = 'pro' AND stripe_customer_id = 'cus_smoke_1') THEN
    RAISE EXCEPTION 'FAIL service_role update not persisted';
  END IF;
  RAISE NOTICE 'PASS service_role UPDATE subscriptions and INSERT stripe_events';
END $$;

-- stripe_customer_id is UNIQUE.
DO $$
DECLARE
  u2 uuid;
BEGIN
  SELECT uid2 INTO u2 FROM _t;
  BEGIN
    UPDATE public.subscriptions SET stripe_customer_id = 'cus_smoke_1' WHERE user_id = u2;
    RAISE EXCEPTION 'FAIL stripe_customer_id accepted a duplicate';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS stripe_customer_id is unique';
  END;
END $$;

-- subscriptions is in the realtime publication.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'subscriptions') THEN
    RAISE EXCEPTION 'FAIL subscriptions not in supabase_realtime';
  END IF;
  RAISE NOTICE 'PASS subscriptions in supabase_realtime';
END $$;

ROLLBACK;
