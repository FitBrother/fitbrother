import type { BillingInterval, BillingUrlResponse, SubscriptionResponse } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authedFetch(path, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `request_failed_${response.status}`);
  return body;
}

export const createCheckout = (interval: BillingInterval) =>
  json<BillingUrlResponse>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ interval }),
  });

export const createPortal = () => json<BillingUrlResponse>("/billing/portal", { method: "POST" });

export const getSubscription = () => json<SubscriptionResponse>("/billing/subscription");
