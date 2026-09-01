import { Platform } from "react-native";

/**
 * Descobre se o bundle já publicado (index.html servido agora) é diferente
 * do que está rodando nesta aba. Não depende de nenhum passo de build novo
 * (commit SHA, version.json etc.) — o próprio hash do arquivo já muda a cada
 * deploy (Metro gera `index-<hash>.js`), então basta comparar o <script src>
 * que o HTML aponta hoje com o que essa página carregou.
 */
function currentBundleSrc(): string | null {
  if (typeof document === "undefined") return null;
  const script = document.querySelector('script[src*="/_expo/static/js/web/"]');
  return script?.getAttribute("src") ?? null;
}

async function latestBundleSrc(): Promise<string | null> {
  const res = await fetch("/", { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/<script src="([^"]+)"/);
  return match?.[1] ?? null;
}

/** true só quando dá pra confirmar que existe um deploy mais novo — falha de
 * rede ou qualquer formato inesperado do HTML não deve alarmar o usuário. */
export async function checkForNewVersion(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  const current = currentBundleSrc();
  if (!current) return false;
  try {
    const latest = await latestBundleSrc();
    return Boolean(latest) && latest !== current;
  } catch {
    return false;
  }
}
