import { describe, expect, jest, test, beforeEach } from "@jest/globals";

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: jest.fn(), signOut: jest.fn() } },
}));
jest.mock("@/lib/dev-host", () => ({ apiBaseUrl: () => "https://api.test" }));
jest.mock("@/lib/constants", () => ({ API_TIMEOUT_MS: 5000 }));

import { authedFetch } from "./api";
import { supabase } from "./supabase";

const mockAuth = supabase.auth as unknown as {
  getSession: jest.Mock<() => Promise<{ data: { session: { access_token: string } | null } }>>;
  signOut: jest.Mock<() => Promise<void>>;
};

describe("authenticated account requests", () => {
  beforeEach(() => {
    mockAuth.getSession.mockReset();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
    mockAuth.signOut.mockReset();
    mockAuth.signOut.mockResolvedValue(undefined);
    global.fetch = jest.fn() as typeof fetch;
  });

  test("keeps the session when account deletion is pending", async () => {
    jest.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "account_deletion_pending" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    await authedFetch("/me");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test("clears an invalid authenticated session", async () => {
    jest.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    await authedFetch("/me");
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });
});
