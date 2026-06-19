-- M7.1 identity & discovery checks.
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: profiles has username + avatar_url.
SELECT 'check_1_username_column' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username'
       )
   AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
       ) AS pass;

-- Check 2: username format rejects invalid values.
DO $$
DECLARE u uuid;
BEGIN
  SELECT user_id INTO u FROM public.profiles LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'check_2_skip: no profiles'; RETURN; END IF;
  BEGIN
    UPDATE public.profiles SET username = 'AB' WHERE user_id = u;
    RAISE EXCEPTION 'check_2_FAIL: invalid username accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'check_2_pass: invalid username rejected';
  END;
END $$;

-- Check 3: phone fields moved out of profiles.
SELECT 'check_3_phone_moved' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'profiles_private'
       )
   AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_e164'
       )
   AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_hash'
       )
   AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_verified_at'
       ) AS pass;

-- Check 4: profiles_private RLS blocks reading another user's row.
DO $$
DECLARE a uuid; b uuid; n int;
BEGIN
  SELECT user_id INTO a FROM public.profiles ORDER BY created_at LIMIT 1;
  SELECT user_id INTO b FROM public.profiles WHERE user_id <> a ORDER BY created_at LIMIT 1;
  IF a IS NULL OR b IS NULL THEN RAISE NOTICE 'check_4_skip: <2 profiles'; RETURN; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.profiles_private WHERE user_id = b;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'check_4_FAIL: read another user profiles_private row'; END IF;
  RAISE NOTICE 'check_4_pass: profiles_private isolated by RLS';
END $$;

-- Check 5: public_profiles exists and never exposes phone columns.
SELECT 'check_5_public_profiles_no_phone' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.views
         WHERE table_schema = 'public' AND table_name = 'public_profiles'
       )
   AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'public_profiles'
           AND column_name IN ('phone_e164','phone_hash','phone_verified_at')
       ) AS pass;

-- Check 6: post-images bucket exists and is private.
SELECT 'check_6_post_images_bucket' AS check,
       EXISTS (
         SELECT 1 FROM storage.buckets
         WHERE id = 'post-images' AND public = false
       ) AS pass;

ROLLBACK;
