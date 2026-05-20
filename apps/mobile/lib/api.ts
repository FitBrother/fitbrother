import type { OnboardingPayload } from "@fitbrother/shared";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
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
    throw new Error(`me_failed_${res.status}`);
  }
  return res.json();
}
