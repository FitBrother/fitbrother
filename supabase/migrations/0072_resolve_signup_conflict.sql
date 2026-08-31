-- M17 (cont., parte 2) — a v1 (0071) só detectava a colisão de e-mail e
-- bloqueava o cadastro novo, mandando "faça login". Mas login não funciona
-- pra essa conta: o e-mail dela nunca chegou a ser confirmado de verdade, só
-- ficou pendente em email_change — vira um beco sem saída pro usuário.
--
-- A resolução correta: se a conta conflitante nunca foi adiante (ainda
-- anônima, sem row em profiles, e a troca de e-mail pendente há tempo
-- suficiente pra presumir abandono), ela é apagada e o cadastro novo segue
-- — reaproveitando a mesma infraestrutura de purge de conta abandonada
-- (removeUserStorage/deleteAuthUserAndAudit, apps/server/src/lib/account-purge.ts).
-- Só bloqueia de verdade quando a colisão não parece abandonada (troca de
-- e-mail recente demais pra presumir).
--
-- fitbrother_signup_conflict (0071) fazia só a detecção, com um boolean —
-- não dava pra decidir "resolver vs bloquear" sem expor dados de outra conta
-- pro cliente. Substituída por uma versão só pro service_role, que devolve o
-- suficiente pro server (não o app) decidir com segurança.
DROP FUNCTION IF EXISTS public.fitbrother_signup_conflict(text);

CREATE OR REPLACE FUNCTION public.fitbrother_find_signup_conflict(p_user_id uuid, p_email text)
RETURNS TABLE(user_id uuid, is_anonymous boolean, email_change_sent_at timestamptz, has_profile boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.is_anonymous, u.email_change_sent_at,
         EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = u.id) AS has_profile
  FROM auth.users u
  WHERE u.id <> p_user_id
    AND u.deleted_at IS NULL
    AND u.is_sso_user = false
    AND (lower(u.email) = lower(p_email) OR lower(u.email_change) = lower(p_email));
$$;

REVOKE ALL ON FUNCTION public.fitbrother_find_signup_conflict(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fitbrother_find_signup_conflict(uuid, text) TO service_role;
