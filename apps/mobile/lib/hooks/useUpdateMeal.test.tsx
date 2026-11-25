import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";

jest.mock("@/lib/api/meals", () => ({ patchMeal: jest.fn(), listMealsForDay: jest.fn() }));
jest.mock("@/lib/api/me", () => ({}));
jest.mock("@/lib/hooks/useAuthSession", () => ({ useAuthSession: jest.fn() }));

import { patchMeal } from "@/lib/api/meals";
import { useUpdateMeal } from "./useUpdateMeal";

let client: QueryClient;
let unmount: (() => void) | undefined;

async function run(day: string, newDay?: string) {
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const spy = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useUpdateMeal("meal-1", day, newDay), { wrapper });
  unmount = hook.unmount;
  await act(async () => {
    await hook.result.current.mutateAsync({});
  });
  return spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe("useUpdateMeal", () => {
  beforeEach(() => {
    jest.mocked(patchMeal).mockReset();
    jest.mocked(patchMeal).mockResolvedValue({} as MealResponse);
  });
  afterEach(() => {
    unmount?.();
    client.clear();
  });

  test("invalidates both days when the nutritional day changes", async () => {
    const keys = await run("2026-11-25", "2026-11-24");
    expect(keys).toContainEqual(["meals", "2026-11-25"]);
    expect(keys).toContainEqual(["meals", "2026-11-24"]);
    expect(keys.filter((k) => k?.[0] === "daily-summary")).toHaveLength(2);
  });

  test("invalidates only the original day without newDay", async () => {
    const keys = await run("2026-11-25");
    expect(keys).toContainEqual(["meals", "2026-11-25"]);
    expect(keys.filter((k) => k?.[0] === "meals")).toHaveLength(1);
    expect(keys.filter((k) => k?.[0] === "daily-summary")).toHaveLength(1);
  });

  test("invalidates only the original day when newDay is equal", async () => {
    const keys = await run("2026-11-25", "2026-11-25");
    expect(keys.filter((k) => k?.[0] === "meals")).toHaveLength(1);
    expect(keys.filter((k) => k?.[0] === "daily-summary")).toHaveLength(1);
  });
});
