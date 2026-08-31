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

const API_ERROR_MESSAGES: Record<string, string> = {
  // O único jeito de bater aqui é um payload que o próprio app monta não
  // bater mais com o que o servidor exige — ex.: app desatualizado ainda
  // sem um campo novo (aconteceu com o consentimento de dado de saúde,
  // LGPD art. 11, adicionado numa migration antes de todo mundo atualizar
  // o app). "Tentar de novo" reenvia o mesmo payload e falha do mesmo
  // jeito — por isso a mensagem aponta pra atualizar o app, não repetir.
  invalid_payload:
    "Alguns dados não foram aceitos pelo servidor. Atualize o app na loja e tente concluir o cadastro de novo.",
  request_timeout: "A conexão demorou demais. Verifique sua internet e tente de novo.",
};

/**
 * Rede de segurança final pra erro de API própria — nunca mostra o texto cru
 * do servidor (pode vazar detalhe interno de banco/storage). `code` é o
 * `err.message` que authedFetch/postOnboarding já lançam com o campo
 * `error` da resposta — só reconhece um punhado de códigos conhecidos e
 * seguros de mostrar; qualquer coisa fora disso (incluindo "internal_error",
 * de propósito) cai no genérico.
 */
export function friendlyApiError(code?: string): string {
  return (code && API_ERROR_MESSAGES[code]) || GENERIC_MESSAGE;
}
