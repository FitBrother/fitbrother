import { DailySummaryResponseSchema, type DailySummary } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function fetchDailySummary(day: string): Promise<DailySummary> {
  const res = await authedFetch(`/me/daily-summary?day=${encodeURIComponent(day)}`);
  const body = await parseOrThrow(res);
  return DailySummaryResponseSchema.parse(body).summary;
}
