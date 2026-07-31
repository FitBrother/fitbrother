import { describe, expect, test } from "@jest/globals";
import { exportFilename, profileInitials } from "./account-utils";

describe("M10 account helpers", () => {
  test("creates stable avatar initials", () => {
    expect(profileInitials("Samuel Oliveira", "s@example.com")).toBe("SO");
    expect(profileInitials(null, "samuel@example.com")).toBe("S");
    expect(profileInitials(null, null)).toBe("FB");
  });

  test("uses the backend export filename and a safe fallback", () => {
    expect(exportFilename('attachment; filename="fitbrother-export-2026-07-30.zip"')).toBe(
      "fitbrother-export-2026-07-30.zip",
    );
    expect(exportFilename(null)).toBe("fitbrother-export.zip");
  });
});
