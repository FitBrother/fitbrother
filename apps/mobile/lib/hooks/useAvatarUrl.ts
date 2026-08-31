import { useEffect, useState } from "react";
import { getPostImageSignedUrl } from "@/lib/storage";

/**
 * Assina o caminho do avatar do próprio usuário e devolve a URL para exibir.
 *
 * Só serve para o perfil próprio: a policy do bucket `post-images` libera
 * apenas a pasta do `auth.uid()`, então avatar de terceiros já chega assinado
 * pelo servidor (ver `apps/server/src/lib/avatars.ts`) e não passa por aqui.
 *
 * Falha de assinatura devolve `null` — o chamador cai nas iniciais.
 */
export function useAvatarUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
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
