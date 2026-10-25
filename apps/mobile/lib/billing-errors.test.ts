import { describe, expect, test } from "@jest/globals";
import { billingErrorMessage } from "@/lib/billing-errors";

describe("billingErrorMessage", () => {
  test("already_subscribed is handled by opening the portal", () => {
    expect(billingErrorMessage("already_subscribed")).toBeNull();
  });

  test.each(["no_customer", "billing_not_configured", "not_authenticated", "boom"])(
    "%s maps to a friendly message",
    (code) => {
      expect(billingErrorMessage(code)).toBe(
        "Assinatura indisponível no momento. Tente novamente mais tarde.",
      );
    },
  );
});
