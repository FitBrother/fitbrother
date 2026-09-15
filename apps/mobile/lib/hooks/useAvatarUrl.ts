import { useEffect, useState } from "react";
import { getPostImageSignedUrl } from "@/lib/storage";

/**
 * Assina o caminho do avatar do próprio usuário e devolve a URL para exibir.
 *
 * Só serve para o perfil próprio: a policy do bucket `post-images` libera
 * apenas a pasta do `auth.uid()`, então avatar de terceiros já chega assinado
 * pelo servidor (ver `apps/server/src/lib/avatars.ts`) e não passa por aqui.
 *
 * Retorno em três estados — `undefined` enquanto a assinatura ainda não
 * voltou (chamador deve mostrar skeleton, não as iniciais), `null` quando
 * confirmado que não há foto ou a assinatura falhou, e a URL nos demais
 * casos. Sem essa distinção, todo primeiro carregamento mostrava as iniciais
 * por um instante antes da foto de verdade aparecer.
 */
export function useAvatarUrl(path: string | null | undefined): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(path ? undefined : null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    setUrl(undefined);
    // `ativo` evita setState depois do unmount e descarta a resposta de um
    // caminho antigo que chegue atrasada depois da troca de foto.
    let ativo = true;
    void getPostImageSignedUrl(path)
      .then((signed) => ativo && setUrl(signed))
      .catch(() => ativo && setUrl(null));
    return () => {
      ativo = false;
    };
  }, [path]);

  return url;
}
