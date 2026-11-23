import { describe, expect, it, vi } from "vitest";

vi.mock("./env.js", () => ({ env: { STRIPE_SECRET_KEY: "" } }));

import { stripeClient } from "./stripe.js";

describe("stripeClient", () => {
  it("throws billing_not_configured when the key is empty", () => {
    expect(() => stripeClient()).toThrowError(
      expect.objectContaining({ name: "BillingError", code: "billing_not_configured" }),
    );
  });
});
