import { describe, expect, test } from "@jest/globals";
import { billingReturnState } from "./billing-return";

describe("billingReturnState", () => {
  test("session_id means success", () => {
    expect(billingReturnState({ session_id: "cs_test_1" })).toBe("success");
  });

  test("status success and cancel map directly", () => {
    expect(billingReturnState({ status: "success" })).toBe("success");
    expect(billingReturnState({ status: "cancel" })).toBe("cancel");
  });

  test("portal return and empty params are neutral", () => {
    expect(billingReturnState({ status: "portal" })).toBe("neutral");
    expect(billingReturnState({})).toBe("neutral");
  });
});
