import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screens = [
  "app/(app)/profile.tsx",
  "app/(app)/settings.tsx",
  "app/(app)/privacy.tsx",
  "app/(app)/about.tsx",
  "app/(app)/delete-account.tsx",
  "app/account-reactivation.tsx",
  "components/account/AccountScreen.tsx",
];

describe("M10 design-system guard", () => {
  test.each(screens)("%s uses tokens and named font families", (file) => {
    const source = readFileSync(resolve(__dirname, "..", file), "utf8");
    expect(source).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(source).not.toMatch(/\bfont-(?:medium|semibold|bold|extrabold)\b/);
  });
});
