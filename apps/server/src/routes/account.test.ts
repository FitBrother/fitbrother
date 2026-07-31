import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashToken, isOwnedAvatarPath, jwtClaims } from "./account.js";

describe("account deletion authorization helpers", () => {
  it("hashes action tokens without retaining the secret", () => {
    const token = "a".repeat(43);
    expect(hashToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashToken(token)).not.toContain(token);
  });

  it("accepts only the canonical avatar path owned by the user", () => {
    const userId = "d66a1fa2-8b61-42f8-97b8-41ffc06978b7";
    expect(isOwnedAvatarPath(`${userId}/avatar.jpg`, userId)).toBe(true);
    expect(isOwnedAvatarPath(`${userId}/other.jpg`, userId)).toBe(false);
    expect(isOwnedAvatarPath(`other-user/avatar.jpg`, userId)).toBe(false);
  });

  it("reads session claims and safely rejects malformed JWTs", () => {
    const payload = Buffer.from(JSON.stringify({ session_id: "new", iat: 123 })).toString(
      "base64url",
    );
    expect(jwtClaims(`header.${payload}.signature`)).toMatchObject({ session_id: "new", iat: 123 });
    expect(jwtClaims("invalid")).toEqual({});
  });
});
