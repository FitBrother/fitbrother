import { describe, expect, it } from "vitest";
import { CheckoutResponseSchema, CreateCheckoutRequestSchema } from "./schemas.js";

describe("checkout contract", () => {
  it("defaults ui to hosted", () => {
    expect(CreateCheckoutRequestSchema.parse({ interval: "month" }).ui).toBe("hosted");
  });

  it("rejects an unknown ui", () => {
    expect(CreateCheckoutRequestSchema.safeParse({ interval: "month", ui: "x" }).success).toBe(
      false,
    );
  });

  it("accepts url or client_secret responses", () => {
    expect(CheckoutResponseSchema.safeParse({ url: "https://c.test/s" }).success).toBe(true);
    expect(CheckoutResponseSchema.safeParse({ client_secret: "cs_test_1" }).success).toBe(true);
    expect(CheckoutResponseSchema.safeParse({}).success).toBe(false);
  });
});
