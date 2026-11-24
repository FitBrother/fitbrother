import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { FoodSuggestion } from "@fitbrother/shared";

jest.mock("@/lib/api/foods", () => ({ searchFoods: jest.fn() }));

import { searchFoods } from "@/lib/api/foods";
import { useFoodSuggestions } from "./useFoodSuggestions";

const rice = { kind: "catalog", name: "Arroz, tipo 1, cozido" } as FoodSuggestion;

let client: QueryClient;
let unmount: (() => void) | undefined;

function setup(initial: string) {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ q }: { q: string }) => useFoodSuggestions(q, true), {
    wrapper,
    initialProps: { q: initial },
  });
  unmount = hook.unmount;
  return hook;
}

describe("useFoodSuggestions", () => {
  beforeEach(() => {
    jest.mocked(searchFoods).mockReset();
  });
  afterEach(() => {
    unmount?.();
    client.clear();
    jest.useRealTimers();
  });

  test("keeps the previous list while the next term loads", async () => {
    jest.mocked(searchFoods).mockResolvedValueOnce([rice]);
    const { result, rerender } = setup("arroz");
    await waitFor(() => expect(result.current.data).toEqual([rice]));

    jest.mocked(searchFoods).mockReturnValueOnce(new Promise<FoodSuggestion[]>(() => {}));
    rerender({ q: "arroz b" });
    await waitFor(() => expect(searchFoods).toHaveBeenCalledWith("arroz b"));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([rice]);
  });

  test("a single character disables the query and drops the previous list", async () => {
    jest.mocked(searchFoods).mockResolvedValueOnce([rice]);
    const { result, rerender } = setup("arroz");
    await waitFor(() => expect(result.current.data).toEqual([rice]));

    rerender({ q: "a" });
    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(searchFoods).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  test("retries a failed search once, then gives up", async () => {
    jest.useFakeTimers();
    jest.mocked(searchFoods).mockRejectedValue(new Error("offline"));
    const { result } = setup("arroz");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(searchFoods).toHaveBeenCalledTimes(2);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
