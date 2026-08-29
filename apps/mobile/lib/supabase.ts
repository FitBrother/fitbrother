import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";
import { supabaseLocalUrl } from "@/lib/dev-host";

const url = supabaseLocalUrl();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!anonKey) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY missing — auth and realtime will not work.",
  );
}

// SecureStore is iOS Keychain / Android Keystore — not available on web.
// On web we fall back to localStorage so the dev experience matches.
const ExpoSecureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const WebStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === "web" ? WebStorageAdapter : ExpoSecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * `supabase.channel(topic)` reaproveita um canal já registrado com o mesmo
 * tópico, mesmo que ele ainda esteja em teardown assíncrono de um
 * `removeChannel` anterior — `.on()` num canal reaproveitado que já chamou
 * `.subscribe()` lança "cannot add postgres_changes callbacks ... after
 * subscribe()". Isso acontece ao navegar pra fora de uma tela com assinatura
 * Realtime e voltar rápido (o cleanup do effect anterior ainda não terminou).
 * Chamar isso antes de criar um canal novo evita a corrida.
 */
export async function removeStaleChannel(topic: string) {
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) await supabase.removeChannel(stale);
}
