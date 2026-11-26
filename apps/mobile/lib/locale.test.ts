import { describe, expect, test } from "@jest/globals";
import { mealLocale } from "@/lib/locale";

describe("mealLocale", () => {
  test.each(["pt-BR", "en-US", "es", "pt"])("keeps the valid profile locale %s", (tag) => {
    expect(mealLocale(tag)).toBe(tag);
  });

  test.each([null, undefined, ""])("falls back to pt-BR for %p", (value) => {
    expect(mealLocale(value)).toBe("pt-BR");
  });

  test.each(["x", "pt_BR!", "portuguese", "pt-BRA", "12-34"])(
    "falls back to pt-BR for malformed %s",
    (value) => {
      expect(mealLocale(value)).toBe("pt-BR");
    },
  );
});
