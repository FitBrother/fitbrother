import Constants from "expo-constants";

/**
 * Derive the local dev machine's LAN IP from the Metro packager host.
 *
 * Why: when developing against the local Supabase + Fastify on the same
 * machine that runs Metro, the LAN IP shifts whenever Wi-Fi assigns a new
 * lease. The packager already knows the right address (that's how Expo Go
 * fetches the bundle and how the QR code is built), so we reuse it instead
 * of asking the user to keep `.env.local` in sync.
 *
 * In production / EAS builds `hostUri` is undefined; callers must provide
 * EXPO_PUBLIC_* env vars there (they're baked into the bundle at build time).
 */
function packagerHost(): string | null {
  // hostUri shape: "192.168.1.107:8081" in dev. May be undefined on
  // standalone/preview builds.
  const hostUri = Constants.expoConfig?.hostUri ?? null;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host && host.length > 0 ? host : null;
}

/**
 * Resolve the Fastify base URL. Order:
 *   1. EXPO_PUBLIC_API_BASE_URL (explicit override — staging, ngrok, etc.)
 *   2. Metro hostUri at port 3000 (local dev default)
 */
export function apiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (override && override.length > 0) return override;
  const host = packagerHost();
  if (host) return `http://${host}:3000`;
  throw new Error(
    "API base URL unresolved: set EXPO_PUBLIC_API_BASE_URL or run via Expo dev (Metro)",
  );
}

/**
 * Resolve the Supabase URL with the same fallback chain as apiBaseUrl.
 */
export function supabaseLocalUrl(): string {
  const override = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (override && override.length > 0) return override;
  const host = packagerHost();
  if (host) return `http://${host}:54321`;
  throw new Error(
    "Supabase URL unresolved: set EXPO_PUBLIC_SUPABASE_URL or run via Expo dev (Metro)",
  );
}
