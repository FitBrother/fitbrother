-- M6 hardening: reversible account deletion, mandatory AI consent and
-- exclusion of pending-deletion accounts from public/social surfaces.

ALTER TABLE public.account_deletions
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_request_id text,
  ADD COLUMN purge_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN last_purge_attempt_at timestamptz,
  ADD COLUMN last_purge_error text;

ALTER TABLE public.meals ADD COLUMN account_deleted_at timestamptz;
ALTER TABLE public.posts ADD COLUMN account_deleted_at timestamptz;
ALTER TABLE public.post_comments ADD COLUMN account_deleted_at timestamptz;
ALTER TABLE public.post_likes ADD COLUMN account_deleted_at timestamptz;

CREATE INDEX account_deletions_open_idx
  ON public.account_deletions (scheduled_purge_at)
  WHERE cancelled_at IS NULL AND purged_at IS NULL;

CREATE INDEX post_likes_account_deleted_idx
  ON public.post_likes (user_id)
  WHERE account_deleted_at IS NOT NULL;

-- Likes remain stored for reactivation, but disappear from counters while the
-- account is pending deletion.
CREATE OR REPLACE FUNCTION public.fitbrother_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.account_deleted_at IS NULL THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.account_deleted_at IS NULL THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.account_deleted_at IS NULL AND NEW.account_deleted_at IS NOT NULL THEN
      UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = NEW.post_id;
    ELSIF OLD.account_deleted_at IS NOT NULL AND NEW.account_deleted_at IS NULL THEN
      UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_likes_count_account_delete
  AFTER UPDATE OF account_deleted_at ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_post_likes_count();

-- One canonical predicate used by views and SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.fitbrother_account_is_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.account_deletions ad
    WHERE ad.user_id = p_user_id
      AND ad.cancelled_at IS NULL
      AND ad.purged_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.fitbrother_account_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fitbrother_account_is_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
  SELECT p.user_id, p.username, p.full_name AS display_name, p.avatar_url
  FROM public.profiles p
  WHERE public.fitbrother_account_is_active(p.user_id);

CREATE OR REPLACE VIEW public.following_summaries_view
WITH (security_invoker = true) AS
  SELECT ds.user_id AS followee_id, ds.day, ds.goal_hit, ds.meals_count
  FROM public.follows f
  JOIN public.daily_summaries ds ON ds.user_id = f.followee_id
  WHERE f.follower_id = auth.uid()
    AND public.fitbrother_account_is_active(f.followee_id);

CREATE OR REPLACE FUNCTION public.fitbrother_weekly_leaderboard(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  weekly_hits int,
  window_streak int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  IF p_user_id IS NULL OR NOT public.fitbrother_account_is_active(p_user_id) THEN
    RETURN;
  END IF;
  v_today := public.fitbrother_today(p_user_id);

  RETURN QUERY
  WITH network AS (
    SELECT p_user_id AS uid
    UNION
    SELECT f.followee_id
    FROM public.follows f
    WHERE f.follower_id = p_user_id
      AND public.fitbrother_account_is_active(f.followee_id)
  ),
  hits AS (
    SELECT n.uid,
           count(*) FILTER (
             WHERE ds.goal_hit AND ds.day BETWEEN v_today - 7 AND v_today - 1
           )::int AS weekly_hits
    FROM network n
    LEFT JOIN public.daily_summaries ds ON ds.user_id = n.uid
    GROUP BY n.uid
  ),
  runs AS (
    SELECT n.uid,
           COALESCE((
             SELECT min(gs.offset_d)::int
             FROM generate_series(0, 6) AS gs(offset_d)
             WHERE NOT EXISTS (
               SELECT 1 FROM public.daily_summaries ds2
               WHERE ds2.user_id = n.uid
                 AND ds2.day = v_today - 1 - gs.offset_d
                 AND ds2.goal_hit
             )
           ), 7) AS window_streak
    FROM network n
  )
  SELECT n.uid, pp.display_name, h.weekly_hits, r.window_streak
  FROM network n
  JOIN hits h ON h.uid = n.uid
  JOIN runs r ON r.uid = n.uid
  JOIN public.public_profiles pp ON pp.user_id = n.uid
  ORDER BY h.weekly_hits DESC, r.window_streak DESC;
END;
$$;

-- Atomic, idempotent request. Rows already soft-deleted by the user are not
-- tagged, so cancellation never resurrects them.
CREATE OR REPLACE FUNCTION public.fitbrother_request_account_deletion(
  p_reason text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS TABLE (requested_at timestamptz, scheduled_purge_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_row public.account_deletions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_row
  FROM public.account_deletions
  WHERE user_id = v_uid
  FOR UPDATE;

  IF FOUND AND v_row.cancelled_at IS NULL AND v_row.purged_at IS NULL THEN
    RETURN QUERY SELECT v_row.requested_at, v_row.scheduled_purge_at;
    RETURN;
  END IF;

  INSERT INTO public.account_deletions (
    user_id, requested_at, scheduled_purge_at, reason, purged_at,
    cancelled_at, cancelled_request_id, purge_attempts,
    last_purge_attempt_at, last_purge_error
  )
  VALUES (
    v_uid, v_now, v_now + interval '30 days', p_reason, NULL,
    NULL, NULL, 0, NULL, NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    requested_at = EXCLUDED.requested_at,
    scheduled_purge_at = EXCLUDED.scheduled_purge_at,
    reason = EXCLUDED.reason,
    purged_at = NULL,
    cancelled_at = NULL,
    cancelled_request_id = NULL,
    purge_attempts = 0,
    last_purge_attempt_at = NULL,
    last_purge_error = NULL
  RETURNING account_deletions.* INTO v_row;

  UPDATE public.meals
  SET deleted_at = v_now, account_deleted_at = v_now
  WHERE user_id = v_uid AND deleted_at IS NULL;

  UPDATE public.posts
  SET deleted_at = v_now, account_deleted_at = v_now
  WHERE user_id = v_uid AND deleted_at IS NULL;

  UPDATE public.post_comments
  SET deleted_at = v_now, account_deleted_at = v_now
  WHERE user_id = v_uid AND deleted_at IS NULL;

  UPDATE public.post_likes
  SET account_deleted_at = v_now
  WHERE user_id = v_uid AND account_deleted_at IS NULL;

  UPDATE public.push_tokens
  SET revoked_at = COALESCE(revoked_at, v_now)
  WHERE user_id = v_uid;

  INSERT INTO public.account_audit_log (
    user_id, action, status, request_id, metadata
  ) VALUES (
    v_uid, 'account_delete', 'success', p_request_id,
    jsonb_build_object('scheduled_purge_at', v_row.scheduled_purge_at)
  );

  RETURN QUERY SELECT v_row.requested_at, v_row.scheduled_purge_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.fitbrother_cancel_account_deletion(
  p_request_id text DEFAULT NULL
)
RETURNS TABLE (reactivated boolean, cancelled_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_row public.account_deletions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_row
  FROM public.account_deletions
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_row.purged_at IS NOT NULL OR v_row.scheduled_purge_at <= v_now THEN
    RAISE EXCEPTION 'account purge window expired';
  END IF;
  IF v_row.cancelled_at IS NOT NULL THEN
    RETURN QUERY SELECT true, v_row.cancelled_at;
    RETURN;
  END IF;

  UPDATE public.meals
  SET deleted_at = NULL, account_deleted_at = NULL
  WHERE user_id = v_uid AND account_deleted_at = v_row.requested_at;

  UPDATE public.posts
  SET deleted_at = NULL, account_deleted_at = NULL
  WHERE user_id = v_uid AND account_deleted_at = v_row.requested_at;

  UPDATE public.post_comments
  SET deleted_at = NULL, account_deleted_at = NULL
  WHERE user_id = v_uid AND account_deleted_at = v_row.requested_at;

  UPDATE public.post_likes
  SET account_deleted_at = NULL
  WHERE user_id = v_uid AND account_deleted_at = v_row.requested_at;

  UPDATE public.account_deletions
  SET cancelled_at = v_now, cancelled_request_id = p_request_id
  WHERE user_id = v_uid;

  INSERT INTO public.account_audit_log (
    user_id, action, status, request_id
  ) VALUES (v_uid, 'account_reactivate', 'success', p_request_id);

  RETURN QUERY SELECT true, v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fitbrother_request_account_deletion(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fitbrother_cancel_account_deletion(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fitbrother_increment_purge_attempt(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.account_deletions
  SET purge_attempts = purge_attempts + 1
  WHERE user_id = p_user_id
    AND cancelled_at IS NULL
    AND purged_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.fitbrother_increment_purge_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fitbrother_increment_purge_attempt(uuid) TO service_role;

-- The product cannot operate without these three consents. The API validates
-- this too, but the database RPC must not accept a forged direct payload.
CREATE OR REPLACE FUNCTION public.fitbrother_assert_required_consents(payload jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF payload->'consents'->'terms' IS DISTINCT FROM 'true'::jsonb
     OR payload->'consents'->'privacy' IS DISTINCT FROM 'true'::jsonb
     OR payload->'consents'->'ai_processing' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'REQUIRED_CONSENT_MISSING';
  END IF;
  IF COALESCE(NULLIF(payload->'consents'->>'policy_version', ''), '') = '' THEN
    RAISE EXCEPTION 'POLICY_VERSION_REQUIRED';
  END IF;
END;
$$;

-- Wrap the evolving onboarding implementation so direct PostgREST calls are
-- protected too, without copying its calculation body into this migration.
ALTER FUNCTION public.complete_onboarding(jsonb) RENAME TO complete_onboarding_impl;
REVOKE ALL ON FUNCTION public.complete_onboarding_impl(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.complete_onboarding(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM public.fitbrother_assert_required_consents(payload);
  RETURN public.complete_onboarding_impl(payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(jsonb) TO authenticated;
