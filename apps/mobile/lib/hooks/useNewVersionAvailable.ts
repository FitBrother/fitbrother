import { useEffect, useState } from "react";
import { checkForNewVersion } from "@/lib/version-check";

// Nem tão frequente que vira ruído/gasto de rede à toa, nem tão raro que uma
// sessão longa (aba aberta o dia inteiro) nunca percebe um deploy novo.
const POLL_MS = 20 * 60_000;

/** Checa em segundo plano se já existe um deploy mais novo — no foco da aba
 * (o momento mais natural, custo quase zero) e num intervalo de segurança
 * pra sessões longas sem nunca sair de foco. Só roda na web (ver
 * checkForNewVersion) e para de checar assim que encontra uma vez. */
export function useNewVersionAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (available || typeof document === "undefined") return;

    let cancelled = false;
    async function check() {
      const found = await checkForNewVersion();
      if (!cancelled && found) setAvailable(true);
    }

    void check();
    const interval = setInterval(() => void check(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [available]);

  return available;
}
