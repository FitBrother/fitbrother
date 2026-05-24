import type { OnboardingPayload } from "@fitbrother/shared";
import { API_TIMEOUT_MS } from "@/lib/constants";
import { apiBaseUrl } from "@/lib/dev-host";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = apiBaseUrl();

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Only attach Content-Type when there's actually a body. Fastify rejects
    // bodiless requests (e.g. DELETE, GET) that carry application/json with
    // "FST_ERR_CTP_EMPTY_JSON_BODY".
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      Authorization: `Bearer ${token}`,
    };
    if (init.body != null) headers["Content-Type"] = "application/json";

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    // 401 means the stored JWT no longer maps to a real user (user deleted,
    // token expired beyond refresh, etc). Clear the local session so the UI
    // bounces back to /(auth)/welcome instead of looping on a dead token.
    if (res.status === 401) {
      await supabase.auth.signOut();
    }

    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("request_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function postOnboarding(payload: OnboardingPayload) {
  const res = await authedFetch("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      issues?: unknown;
    };
    throw new Error(body.error ?? `onboarding_failed_${res.status}`);
  }
  return res.json();
}

export async function getMe() {
  const res = await authedFetch("/me");
  if (!res.ok) {
    if (res.status === 404) return null;
    // 401 already triggered signOut above; report a transient error so the
    // caller can re-render against the new signed_out state.
    if (res.status === 401) return null;
    throw new Error(`me_failed_${res.status}`);
  }
  return res.json();
}
