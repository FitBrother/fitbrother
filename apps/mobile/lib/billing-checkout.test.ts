import { describe, expect, test } from "@jest/globals";
import { checkoutHref, embeddedCheckoutSupported } from "./billing-checkout";

describe("embedded checkout routing", () => {
  test("only web embeds the checkout", () => {
    expect(embeddedCheckoutSupported("web")).toBe(true);
    expect(embeddedCheckoutSupported("ios")).toBe(false);
    expect(embeddedCheckoutSupported("android")).toBe(false);
  });

  test("builds the checkout href", () => {
    expect(checkoutHref("year")).toBe("/checkout?interval=year");
  });
});
