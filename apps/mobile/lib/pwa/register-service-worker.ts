import { Platform } from "react-native";

/** No-op fora da web. Registra o SW mínimo (public/sw.js) para instalabilidade. */
export function registerServiceWorker(): void {
  if (Platform.OS !== "web") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
