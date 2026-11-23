import type {
  BillingInterval,
  BillingUrlResponse,
  CheckoutResponse,
  CheckoutUi,
  SubscriptionResponse,
} from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authedFetch(path, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `request_failed_${response.status}`);
  return body;
}

const requestCheckout = (interval: BillingInterval, ui: CheckoutUi) =>
  json<CheckoutResponse>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ interval, ui }),
  });

export async function createCheckout(interval: BillingInterval): Promise<{ url: string }> {
  const response = await requestCheckout(interval, "hosted");
  if (!("url" in response)) throw new Error("checkout_without_url");
  return { url: response.url };
}

export async function createEmbeddedCheckout(interval: BillingInterval): Promise<string> {
  const response = await requestCheckout(interval, "embedded");
  if (!("client_secret" in response)) throw new Error("checkout_without_client_secret");
  return response.client_secret;
}

export const createPortal = () => json<BillingUrlResponse>("/billing/portal", { method: "POST" });

export const getSubscription = () => json<SubscriptionResponse>("/billing/subscription");
