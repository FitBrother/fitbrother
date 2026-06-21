import { InsightsResponseSchema, type Insight } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

export async function fetchInsights(period?: "day" | "week" | "month"): Promise<Insight[]> {
  const qs = period ? `?period=${period}` : "";
  const res = await authedFetch(`/me/insights${qs}`);
  if (!res.ok) throw new Error(`insights_failed_${res.status}`);
  return InsightsResponseSchema.parse(await res.json()).insights;
}
