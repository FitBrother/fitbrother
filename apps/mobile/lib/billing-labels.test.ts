import { describe, expect, test } from "@jest/globals";
import { subscriptionLabel } from "./billing-labels";

const base = { current_period_end: null, has_customer: false };

describe("subscriptionLabel", () => {
  test("free plan", () => {
    expect(subscriptionLabel({ ...base, plan: "free", status: "active" })).toBe("Plano gratuito");
  });

  test("pro statuses", () => {
    expect(subscriptionLabel({ ...base, plan: "pro", status: "active" })).toBe("Premium");
    expect(subscriptionLabel({ ...base, plan: "pro", status: "trialing" })).toBe(
      "Premium (teste grátis)",
    );
    expect(subscriptionLabel({ ...base, plan: "pro", status: "past_due" })).toBe(
      "Premium (pagamento pendente)",
    );
  });

  test("canceled falls back to free label", () => {
    expect(subscriptionLabel({ ...base, plan: "free", status: "canceled" })).toBe("Plano gratuito");
    expect(subscriptionLabel({ ...base, plan: "pro", status: "canceled" })).toBe("Plano gratuito");
  });
});
