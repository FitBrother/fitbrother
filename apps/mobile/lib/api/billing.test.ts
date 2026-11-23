import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockAuthedFetch = jest.fn<(path: string, init?: RequestInit) => Promise<Response>>();
jest.mock("@/lib/api", () => ({
  authedFetch: (...args: [string, RequestInit?]) => mockAuthedFetch(...args),
}));

import { createCheckout, createEmbeddedCheckout } from "./billing";

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  mockAuthedFetch.mockReset();
});

describe("checkout api", () => {
  test("hosted checkout sends ui hosted and returns the url", async () => {
    mockAuthedFetch.mockReturnValue(reply({ url: "https://c.test/s" }));
    await expect(createCheckout("month")).resolves.toEqual({ url: "https://c.test/s" });
    expect(JSON.parse(String(mockAuthedFetch.mock.calls[0]![1]!.body))).toEqual({
      interval: "month",
      ui: "hosted",
    });
  });

  test("hosted checkout without url fails", async () => {
    mockAuthedFetch.mockReturnValue(reply({ client_secret: "cs" }));
    await expect(createCheckout("month")).rejects.toThrow("checkout_without_url");
  });

  test("embedded checkout returns the client secret", async () => {
    mockAuthedFetch.mockReturnValue(reply({ client_secret: "cs_test_1" }));
    await expect(createEmbeddedCheckout("year")).resolves.toBe("cs_test_1");
    expect(JSON.parse(String(mockAuthedFetch.mock.calls[0]![1]!.body))).toEqual({
      interval: "year",
      ui: "embedded",
    });
  });

  test("embedded checkout without client secret fails", async () => {
    mockAuthedFetch.mockReturnValue(reply({ url: "https://c.test/s" }));
    await expect(createEmbeddedCheckout("year")).rejects.toThrow("checkout_without_client_secret");
  });

  test("propagates the server error code", async () => {
    mockAuthedFetch.mockReturnValue(reply({ error: "already_subscribed" }, 409));
    await expect(createEmbeddedCheckout("year")).rejects.toThrow("already_subscribed");
  });
});
