import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { OAuthResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type OAuthProvider = "google" | "apple";

export class OAuthCallbackError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/**
 * O GoTrue às vezes manda o erro na query string, às vezes no fragment
 * (#) — espelha o parseParametersFromURL do próprio supabase-js: junta os
 * dois, com a query tendo prioridade.
 */
function paramsFromCallbackUrl(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.hash.replace(/^#/, ""));
  url.searchParams.forEach((value, key) => merged.set(key, value));
  return merged;
}

/**
 * Abre o navegador de autenticação do provider e devolve a sessão final pro
 * cliente local. `startSession` decide o que a chamada faz do lado do
 * Supabase (criar sessão nova vs. vincular a uma sessão já ativa) — o resto
 * do fluxo (abrir o browser, extrair os tokens da URL de retorno,
 * `setSession`) é idêntico nos dois casos.
 */
async function runOAuthFlow(
  startSession: (redirectTo: string) => Promise<OAuthResponse>,
): Promise<void> {
  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await startSession(redirectTo);
  if (error || !data.url) throw error ?? new Error("oauth_start_failed");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new Error("oauth_cancelled");
  const callback = new URL(result.url);
  const params = paramsFromCallbackUrl(callback);

  // O GoTrue só descobre o e-mail da conta do provider DEPOIS que o usuário
  // completa o consentimento — por isso um conflito (ex.: esse e-mail já é
  // de outra conta) só aparece aqui, como erro na URL de retorno, nunca na
  // chamada inicial que só gera o link de autorização.
  const errorCode = params.get("error_code") ?? params.get("error");
  if (errorCode) {
    throw new OAuthCallbackError(params.get("error_description") ?? errorCode, errorCode);
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("oauth_session_missing");

  const session = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (session.error) throw session.error;
}

/** Login normal — cria/retoma uma sessão pro provider escolhido. */
export async function authenticateWithOAuth(provider: OAuthProvider): Promise<void> {
  return runOAuthFlow((redirectTo) =>
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    }),
  );
}

/**
 * Vincula um provider à sessão ANÔNIMA já ativa (onboarding) em vez de criar
 * uma sessão nova — assim não perde o progresso já salvo pro user_id
 * anônimo atual. Exige "Enable Manual Linking" habilitado no projeto
 * Supabase (config.toml local + painel do Supabase Cloud em produção).
 */
export async function linkOAuthIdentity(provider: OAuthProvider): Promise<void> {
  return runOAuthFlow((redirectTo) =>
    supabase.auth.linkIdentity({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    }),
  );
}
