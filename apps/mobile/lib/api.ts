import type { OnboardingPayload } from "@fitbrother/shared";
import { API_TIMEOUT_MS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
