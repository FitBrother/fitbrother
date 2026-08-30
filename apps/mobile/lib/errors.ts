/**
 * Mensagens de erro amigáveis em PT-BR. Só usado no PONTO DE EXIBIÇÃO (tela
 * mostrando texto pro usuário) — nunca na construção da exceção, pra não
 * quebrar comparações de código existentes em outros lugares (ex.:
 * `err.message === "product_not_found"`).
 */

const GENERIC_MESSAGE = "Algo deu errado. Tente novamente em instantes.";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar.",
  email_exists: "Esse e-mail já tem uma conta cadastrada.",
  phone_exists: "Esse telefone já está em uso por outra conta.",
  weak_password: "Escolha uma senha mais forte (mínimo 8 caracteres).",
  validation_failed: "Verifique os dados informados.",
  user_banned: "Essa conta está temporariamente bloqueada.",
  over_email_send_rate_limit:
    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit:
    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  over_sms_send_rate_limit:
    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  otp_expired: "Código expirado. Peça um novo.",
  otp_disabled: "Código inválido ou expirado.",
};

/** Traduz um AuthError do Supabase (login, cadastro, telefone) pra PT-BR. */
export function friendlyAuthError(error: { code?: string } | null | undefined): string {
  const code = error?.code;
  return (code && AUTH_ERROR_MESSAGES[code]) || GENERIC_MESSAGE;
}

/**
 * Rede de segurança final pra erro de API própria — nunca mostra o texto cru
 * do servidor (pode vazar detalhe interno de banco/storage).
 */
export function friendlyApiError(): string {
  return GENERIC_MESSAGE;
}
