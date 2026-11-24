import { FoodSearchResponseSchema, type FoodSuggestion } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function searchFoods(q: string): Promise<FoodSuggestion[]> {
  const res = await authedFetch(`/foods/search?q=${encodeURIComponent(q)}`);
  const body = await parseOrThrow(res);
  return FoodSearchResponseSchema.parse(body).suggestions;
}
