import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let _service: SupabaseClient | null = null;

/**
 * Service-role client — bypasses RLS. Use only for backend tasks that legitimately
 * need to act across users (webhooks, workers, cron). Never expose to the client.
 */
export function supabaseService(): SupabaseClient {
  if (_service) return _service;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  }
  _service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

/**
 * User-scoped client — pass the user's access token and RLS applies as usual.
 */
export function supabaseFromJwt(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
