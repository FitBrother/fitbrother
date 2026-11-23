import type Stripe from "stripe";

export type BillingErrorCode = "billing_not_configured" | "already_subscribed" | "no_customer";

export class BillingError extends Error {
  constructor(public readonly code: BillingErrorCode) {
    super(code);
    this.name = "BillingError";
  }
}

export type SubscriptionUpdate = {
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "trialing";
  current_period_start: string | null;
  current_period_end: string | null;
  provider: "stripe";
  provider_subscription_id: string;
};

type Mapped = Pick<SubscriptionUpdate, "plan" | "status">;

function mapStatus(status: string): Mapped {
  switch (status) {
    case "trialing":
      return { plan: "pro", status: "trialing" };
    case "active":
      return { plan: "pro", status: "active" };
    case "past_due":
    case "unpaid":
      return { plan: "pro", status: "past_due" };
    default:
      return { plan: "free", status: "canceled" };
  }
}

function toIso(seconds: number | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

export function mapStripeSubscription(sub: Stripe.Subscription): SubscriptionUpdate {
  const top = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const item = sub.items?.data?.[0];
  return {
    ...mapStatus(sub.status),
    current_period_start: toIso(top.current_period_start ?? item?.current_period_start),
    current_period_end: toIso(top.current_period_end ?? item?.current_period_end),
    provider: "stripe",
    provider_subscription_id: sub.id,
  };
}
