import { describe, expect, jest, test } from "@jest/globals";

jest.mock("@/lib/api/meals", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
  getErrorStatus: (err: unknown) =>
    err && typeof err === "object" && "status" in err
      ? (err as { status: number }).status
      : undefined,
}));

import { QuotaExceededError } from "@/lib/api/meals";
import { registerErrorKind } from "@/lib/meal-registration-errors";

function withStatus(status: number) {
  return Object.assign(new Error("request_failed"), { status });
}

describe("registerErrorKind", () => {
  test.each([
    ["quota", new QuotaExceededError("quota_exceeded"), "quota_exceeded"],
    ["timeout", new Error("request_timeout"), "offline"],
    ["backfill window", new Error("backfill_window_exceeded"), "backfill_window_exceeded"],
    ["empty transcription", new Error("empty_transcription"), "network"],
    ["server 500", withStatus(500), "server_error"],
    ["server 503", withStatus(503), "server_error"],
    ["client 400", withStatus(400), "network"],
    ["unknown", new Error("boom"), "network"],
  ])("maps %s to %s", (_label, error, kind) => {
    expect(registerErrorKind(error as Error)).toBe(kind);
  });
});
