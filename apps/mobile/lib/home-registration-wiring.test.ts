import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";

const ROOT = resolve(__dirname, "..");
const home = readFileSync(resolve(ROOT, "app/(app)/index.tsx"), "utf8");

describe("Home registration wiring", () => {
  test("opens the meal screen on success of text, audio and photo registration", () => {
    expect(home).toContain("useOpenMealAfterRegister()");
    expect(home.match(/onSuccess: \(r\) => openMeal\(r\.meal\)/g)).toHaveLength(3);
  });

  test("no longer offers the share prompt after registering", () => {
    expect(home).not.toContain("ShareMealPrompt");
    expect(home).not.toContain("refeicaoRecente");
    expect(existsSync(resolve(ROOT, "components/domain/ShareMealPrompt.tsx"))).toBe(false);
  });

  test("only confirmed meals trigger the tour notification", () => {
    expect(home).toContain("hasConfirmedMeal(items)");
    expect(home).not.toContain('m.__status !== "processing")');
  });
});
