import { describe, expect, test } from "@jest/globals";
import { BILLING_UNAVAILABLE_MESSAGE } from "./billing-errors";
import { checkoutErrorMessage, parseInterval } from "./checkout-state";

describe("checkout page state", () => {
  test("maps already_subscribed to its own message", () => {
    expect(checkoutErrorMessage("already_subscribed")).toBe("Você já tem uma assinatura ativa.");
  });

  test("falls back to the unavailable message", () => {
    expect(checkoutErrorMessage("billing_not_configured")).toBe(BILLING_UNAVAILABLE_MESSAGE);
    expect(checkoutErrorMessage("")).toBe(BILLING_UNAVAILABLE_MESSAGE);
  });

  test("parseInterval accepts only month and year", () => {
    expect(parseInterval("month")).toBe("month");
    expect(parseInterval("year")).toBe("year");
    expect(parseInterval("week")).toBeNull();
    expect(parseInterval(undefined)).toBeNull();
    expect(parseInterval(["month"])).toBeNull();
  });
});
