-- M3.1. "Hoje" do user respeitando timezone + day_start_hour.
-- Wrapper sobre fitbrother_nutritional_day (0014) sem ts argument.
CREATE OR REPLACE FUNCTION public.fitbrother_today(p_user_id uuid)
RETURNS date
LANGUAGE sql STABLE
AS $$
  SELECT public.fitbrother_nutritional_day(p_user_id, now());
$$;

-- View: row de daily_summaries para o dia "hoje" do user autenticado.
-- security_invoker=true → RLS de daily_summaries aplica ao caller.
-- Retorna 0 rows se user não tem refeições hoje.
CREATE OR REPLACE VIEW public.vw_today_summary
WITH (security_invoker = true)
AS
  SELECT ds.*
  FROM public.daily_summaries ds
  WHERE ds.user_id = auth.uid()
    AND ds.day = public.fitbrother_today(auth.uid());

-- GRANT SELECT pro role anon/authenticated (views novas não herdam por padrão).
GRANT SELECT ON public.vw_today_summary TO anon, authenticated;
