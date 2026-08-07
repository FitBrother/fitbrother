import type { MealResponse, PatchMealRequest } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";
import { AI_API_TIMEOUT_MS } from "@/lib/constants";

export class QuotaExceededError extends Error {
  code = "AI_QUOTA_EXCEEDED" as const;
  constructor(public kind: string) {
    super("quota_exceeded");
  }
}

export function getErrorStatus(err: unknown): number | undefined {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { kind?: string };
    throw new QuotaExceededError(body.kind ?? "llm");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function createMealText(input: {
  client_meal_id: string;
  text: string;
  consumed_at?: string;
  locale: string;
}): Promise<{ meal: MealResponse; cache_hit: boolean; already_existed: boolean }> {
  const res = await authedFetch("/meals/text", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return (await parseOrThrow(res)) as {
    meal: MealResponse;
    cache_hit: boolean;
    already_existed: boolean;
  };
}

export async function createMealAudio(input: {
  client_meal_id: string;
  audio_path: string;
  duration_s: number;
  consumed_at?: string;
  locale: string;
}): Promise<{
  meal: MealResponse;
  cache_hit_transcription: boolean;
  cache_hit_extraction: boolean;
  already_existed: boolean;
}> {
  const res = await authedFetch("/meals/audio", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: AI_API_TIMEOUT_MS,
  });
  return (await parseOrThrow(res)) as {
    meal: MealResponse;
    cache_hit_transcription: boolean;
    cache_hit_extraction: boolean;
    already_existed: boolean;
  };
}

export async function createMealPhoto(input: {
  client_meal_id: string;
  image_path: string;
  consumed_at?: string;
  locale: string;
}): Promise<{ meal: MealResponse; cache_hit: boolean; already_existed: boolean }> {
  const res = await authedFetch("/meals/photo", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: AI_API_TIMEOUT_MS,
  });
  return (await parseOrThrow(res)) as {
    meal: MealResponse;
    cache_hit: boolean;
    already_existed: boolean;
  };
}

export async function listMealsForDay(day: string): Promise<MealResponse[]> {
  const res = await authedFetch(`/meals?day=${encodeURIComponent(day)}`);
  const body = (await parseOrThrow(res)) as { meals: MealResponse[] };
  return body.meals;
}

export async function getMeal(id: string): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}`);
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}

export async function confirmMeal(id: string): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}/confirm`, { method: "POST" });
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}

export async function patchMeal(id: string, patch: PatchMealRequest): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}

export async function deleteMeal(id: string): Promise<void> {
  const res = await authedFetch(`/meals/${id}`, { method: "DELETE" });
  if (!res.ok) {
    await parseOrThrow(res);
  }
}
