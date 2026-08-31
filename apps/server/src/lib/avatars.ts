import { supabaseService } from "./supabase.js";

const BUCKET = "post-images";
const TTL_SECONDS = 60 * 60;

/**
 * Troca caminhos de avatar no Storage por URLs assinadas.
 *
 * Por que no servidor e não no cliente: o bucket `post-images` é privado e a
 * policy de SELECT da migration 0040 só libera a própria pasta
 * (`auth.uid()::text = (storage.foldername(name))[1]`). Um cliente consegue
 * assinar o próprio avatar, mas nunca o de outra pessoa — então a busca de
 * pessoas e o feed precisam receber a URL já pronta, assinada com service role.
 *
 * Falha de assinatura devolve o caminho ausente do Map, e quem chama cai no
 * fallback de iniciais. Avatar quebrado não pode derrubar a busca inteira.
 */
export async function signAvatarUrls(
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  if (unicos.length === 0) return new Map();

  const { data, error } = await supabaseService()
    .storage.from(BUCKET)
    .createSignedUrls(unicos, TTL_SECONDS);
  if (error || !data) return new Map();

  const assinadas = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) assinadas.set(item.path, item.signedUrl);
  }
  return assinadas;
}

/**
 * Aplica o Map de assinaturas sobre uma lista de perfis públicos, trocando
 * `avatar_url` de caminho para URL. Caminho sem assinatura vira `null`.
 */
export function withSignedAvatars<T extends { avatar_url: string | null }>(
  perfis: T[],
  assinadas: Map<string, string>,
): T[] {
  return perfis.map((perfil) => ({
    ...perfil,
    avatar_url: perfil.avatar_url ? (assinadas.get(perfil.avatar_url) ?? null) : null,
  }));
}
