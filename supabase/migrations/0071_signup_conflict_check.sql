-- M17 (cont.) — fecha uma lacuna do próprio linkIdentity()/updateUser() do
-- GoTrue: eles só barram colisão de e-mail contra outra conta cujo e-mail já
-- esteja CONFIRMADO (auth.users.email). Uma conta abandonada logo depois de
-- "Crie sua conta" — nunca clicou no link de confirmação — fica com o e-mail
-- só em auth.users.email_change, pendente, invisível pros checadores do
-- GoTrue (FindUserByEmailAndAudience / IsDuplicatedEmail). Resultado: uma
-- segunda tentativa com o mesmo e-mail (inclusive via "Continuar com
-- Google") passa sem erro nenhum, criando uma segunda conta real — a
-- primeira fica presa num link de confirmação morto, o que parece uma
-- "sobrescrita" pro usuário.
--
-- Esta função fecha essa lacuna checando as DUAS colunas (confirmado e
-- pendente). Roda com auth.uid() (não recebe user_id do cliente) pra não
-- virar um oráculo de e-mails pra quem quer que esteja autenticado.
CREATE OR REPLACE FUNCTION public.fitbrother_signup_conflict(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id <> auth.uid()
      AND u.deleted_at IS NULL
      AND u.is_sso_user = false
      AND (lower(u.email) = lower(p_email) OR lower(u.email_change) = lower(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.fitbrother_signup_conflict(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fitbrother_signup_conflict(text) TO authenticated;
