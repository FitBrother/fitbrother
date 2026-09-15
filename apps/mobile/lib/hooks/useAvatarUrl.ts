import { useQuery } from "@tanstack/react-query";
import { getPostImageSignedUrl } from "@/lib/storage";

export function avatarUrlKey(path: string) {
  return ["avatar-url", path] as const;
}

/**
 * Assina o caminho do avatar do próprio usuário e devolve a URL para exibir.
 *
 * Só serve para o perfil próprio: a policy do bucket `post-images` libera
 * apenas a pasta do `auth.uid()`, então avatar de terceiros já chega assinado
 * pelo servidor (ver `apps/server/src/lib/avatars.ts`) e não passa por aqui.
 *
 * É `useQuery`, não `useState`+`useEffect`, de propósito: `ProfileProvider`
 * (`lib/profile/profile-context.tsx`) dispara um `prefetchQuery` com a mesma
 * chave assim que o perfil carrega — bem antes do `HomeHeader` montar. Sem
 * isso, a assinatura só começava quando o header aparecia, e a foto do
 * avatar sempre chegava um instante depois do resto da tela.
 *
 * Retorno em três estados — `undefined` enquanto a assinatura ainda não
 * voltou (chamador deve mostrar skeleton, não as iniciais), `null` quando
 * confirmado que não há foto ou a assinatura falhou, e a URL nos demais
 * casos.
 */
export function useAvatarUrl(path: string | null | undefined): string | null | undefined {
  const query = useQuery({
    queryKey: avatarUrlKey(path ?? ""),
    queryFn: () => getPostImageSignedUrl(path as string),
    enabled: Boolean(path),
  });

  if (!path) return null;
  if (query.isError) return null;
  return query.data;
}
