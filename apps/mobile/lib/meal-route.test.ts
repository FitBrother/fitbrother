import { describe, expect, test } from "@jest/globals";
import { mealRoute } from "@/lib/meal-route";

describe("mealRoute", () => {
  test("points at the dynamic meal screen with the id", () => {
    expect(mealRoute("abc")).toEqual({ pathname: "/(app)/meal/[id]", params: { id: "abc" } });
  });
});
