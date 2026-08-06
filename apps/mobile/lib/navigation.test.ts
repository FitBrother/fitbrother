import { describe, expect, jest, test } from "@jest/globals";
import { backOrHome } from "./navigation";

function routerWithHistory(canGoBack: boolean) {
  return {
    canGoBack: jest.fn(() => canGoBack),
    back: jest.fn(),
    replace: jest.fn(),
  };
}

describe("backOrHome", () => {
  test("returns through navigation history when possible", () => {
    const router = routerWithHistory(true);

    backOrHome(router);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  test("replaces a directly opened screen with Home", () => {
    const router = routerWithHistory(false);

    backOrHome(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/(app)");
  });
});
