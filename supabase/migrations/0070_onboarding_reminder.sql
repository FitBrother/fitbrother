-- M17 — recuperação de cadastro abandonado: conta já virou real (e-mail +
-- senha aplicados via updateUser, is_anonymous=false) mas o onboarding nunca
-- foi concluído (sem row em public.profiles — complete_onboarding_impl é o
-- único INSERT ali, e ele apaga onboarding_progress ao concluir).
--
-- Duas funções, mesmo critério-base:
--   fitbrother_onboarding_reminder(): ~24h parado sem lembrete ainda enviado
--     → insere notifications(channel='email'); o worker dispatch-notification
--     já existente drena a fila e manda de verdade via Resend.
--   fitbrother_abandoned_signups(): ~14 dias parado → candidatos a purge
--     (worker próprio decide o delete de verdade, igual ao purge-accounts).

ALTER TABLE public.onboarding_progress
  ADD COLUMN reminder_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.fitbrother_onboarding_reminder()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   record;
  v_count int := 0;
BEGIN
  FOR v_row IN
    SELECT op.user_id, u.email
    FROM public.onboarding_progress op
    JOIN auth.users u ON u.id = op.user_id
    WHERE u.is_anonymous = false
      AND u.email IS NOT NULL
      AND op.reminder_sent_at IS NULL
      AND op.updated_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = op.user_id)
  LOOP
    INSERT INTO public.notifications (user_id, channel, kind, template, payload)
    VALUES (v_row.user_id, 'email', 'onboarding_reminder', 'onboarding_reminder',
            jsonb_build_object('email', v_row.email));

    UPDATE public.onboarding_progress
    SET reminder_sent_at = now()
    WHERE user_id = v_row.user_id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fitbrother_abandoned_signups()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT op.user_id
  FROM public.onboarding_progress op
  JOIN auth.users u ON u.id = op.user_id
  WHERE u.is_anonymous = false
    AND op.updated_at < now() - interval '14 days'
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = op.user_id);
$$;
