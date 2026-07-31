import { describe, expect, it } from "vitest";
import {
  CompleteAccountDeletionOAuthRequestSchema,
  DeleteAccountRequestSchema,
  PatchAccountProfileRequestSchema,
  PostAccountConsentRequestSchema,
  StartAccountDeletionOAuthRequestSchema,
} from "./schemas";

describe("M10 account contracts", () => {
  it("requires a recent authorization to delete an account", () => {
    expect(DeleteAccountRequestSchema.safeParse({ confirm: true }).success).toBe(false);
    expect(
      DeleteAccountRequestSchema.safeParse({
        confirm: true,
        authorization_token: "a".repeat(32),
      }).success,
    ).toBe(true);
  });

  it("allows only a path or null in the avatar patch", () => {
    expect(PatchAccountProfileRequestSchema.safeParse({ avatar_url: null }).success).toBe(true);
    expect(PatchAccountProfileRequestSchema.safeParse({ avatar_url: "" }).success).toBe(false);
  });

  it("limits deletion OAuth to Google and Apple", () => {
    expect(StartAccountDeletionOAuthRequestSchema.safeParse({ provider: "google" }).success).toBe(
      true,
    );
    expect(StartAccountDeletionOAuthRequestSchema.safeParse({ provider: "facebook" }).success).toBe(
      false,
    );
    expect(
      CompleteAccountDeletionOAuthRequestSchema.safeParse({
        provider: "apple",
        challenge_token: "c".repeat(32),
      }).success,
    ).toBe(true);
  });

  it("keeps AI consent in the contract while backend policy makes it mandatory", () => {
    expect(
      PostAccountConsentRequestSchema.safeParse({
        scope: "ai_processing",
        granted: true,
        policy_version: "v1.0",
      }).success,
    ).toBe(true);
  });
});
