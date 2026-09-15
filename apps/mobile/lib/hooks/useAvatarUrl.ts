import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getPostImageSignedUrl } from "@/lib/storage";

export function avatarUrlKey(path: string) {
  return ["avatar-url", path] as const;
}

/** Assina a URL e já baixa os bytes da foto antes de considerá-la "pronta" — ver doc de `useAvatarUrl`. */
export async function resolveAvatarUrl(path: string): Promise<string> {
  const url = await getPostImageSignedUrl(path);
  // Sem isso, a URL contava como "resolvida" assim que a assinatura voltava,
  // mas o download da imagem em si só começava quando o <Image> real
  // montava — e a foto aparecia um instante depois do resto da tela mesmo
  // com a Home esperando a URL. `.catch` porque falha no prefetch (rede,
  // formato) não deve derrubar a URL, que ainda é válida pro <Image> tentar
  // de novo sozinho.
  //
  // `expo-image`, não o `Image` do react-native: o prefetch nativo do RN não
  // garante compartilhar cache com o <Image> real de forma confiável entre
  // plataformas — o componente ainda podia levar um tempo perceptível pra
  // disparar `onLoad` mesmo com os bytes já baixados, e a foto continuava
  // "aparecendo depois" do resto da Home. `expo-image` usa o mesmo pipeline
  // de cache pro prefetch e pro componente (ver `components/Avatar.tsx`).
  await Image.prefetch(url, "memory-disk").catch(() => {});
  return url;
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
 * Retorno em três estados — `undefined` enquanto a assinatura (+ o
 * pré-carregamento dos bytes, ver `resolveAvatarUrl`) ainda não voltou
 * (chamador deve mostrar skeleton, não as iniciais), `null` quando
 * confirmado que não há foto ou a assinatura falhou, e a URL nos demais
 * casos.
 */
export function useAvatarUrl(path: string | null | undefined): string | null | undefined {
  const query = useQuery({
    queryKey: avatarUrlKey(path ?? ""),
    queryFn: () => resolveAvatarUrl(path as string),
    enabled: Boolean(path),
    // A URL assinada é válida por 1h (`getPostImageSignedUrl`) — sem isso a
    // query herdava o staleTime default (30s) e o `refetchOnWindowFocus`
    // global (RN dispara em transições de AppState) reassinava a foto toda
    // vez que o app voltava do background, trocando a `uri` à toa e fazendo
    // o avatar "piscar" mesmo com o arquivo intacto.
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
  });

  if (!path) return null;
  if (query.isError) return null;
  return query.data;
}
