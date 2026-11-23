import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { BillingError, mapStripeSubscription } from "./billing-status.js";

const START = 1_760_000_000;
const END = 1_762_592_000;

function sub(status: string, extra: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    status,
    cancel_at_period_end: false,
    items: { data: [{ current_period_start: START, current_period_end: END }] },
    ...extra,
  } as unknown as Stripe.Subscription;
}

describe("mapStripeSubscription", () => {
  it.each([
    ["trialing", "pro", "trialing"],
    ["active", "pro", "active"],
    ["past_due", "pro", "past_due"],
    ["unpaid", "pro", "past_due"],
    ["canceled", "free", "canceled"],
    ["incomplete_expired", "free", "canceled"],
  ])("%s -> %s/%s", (stripeStatus, plan, status) => {
    expect(mapStripeSubscription(sub(stripeStatus))).toMatchObject({ plan, status });
  });

  it("keeps pro/active when cancel_at_period_end is set", () => {
    const r = mapStripeSubscription(sub("active", { cancel_at_period_end: true }));
    expect(r).toMatchObject({ plan: "pro", status: "active" });
  });

  it("converts unix seconds to ISO and sets provider fields", () => {
    const r = mapStripeSubscription(sub("active"));
    expect(r.current_period_start).toBe(new Date(START * 1000).toISOString());
    expect(r.current_period_end).toBe(new Date(END * 1000).toISOString());
    expect(r.provider).toBe("stripe");
    expect(r.provider_subscription_id).toBe("sub_123");
  });

  it("prefers top-level period fields when present", () => {
    const r = mapStripeSubscription(
      sub("active", { current_period_start: START + 10, current_period_end: END + 10 }),
    );
    expect(r.current_period_end).toBe(new Date((END + 10) * 1000).toISOString());
  });

  it("returns null periods when absent", () => {
    const r = mapStripeSubscription(sub("active", { items: { data: [] } }));
    expect(r.current_period_start).toBeNull();
    expect(r.current_period_end).toBeNull();
  });
});

describe("BillingError", () => {
  it("carries a code", () => {
    expect(new BillingError("no_customer").code).toBe("no_customer");
  });
});
