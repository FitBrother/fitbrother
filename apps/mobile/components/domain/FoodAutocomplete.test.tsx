import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";
import type { FoodSuggestion } from "@fitbrother/shared";

jest.mock("@/lib/hooks/useFoodSuggestions", () => ({
  useFoodSuggestions: jest.fn(),
}));

import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import { FoodAutocomplete } from "./FoodAutocomplete";

const base: FoodSuggestion = {
  kind: "catalog",
  food_id: "11111111-1111-4111-8111-111111111111",
  name: "Arroz, tipo 1, cozido",
  serving_label: "1 colher de sopa (25g)",
  serving_grams: 25,
  kcal_per_100g: 128,
  protein_per_100g: 2.5,
  carbs_per_100g: 28,
  fat_per_100g: 0.2,
  quantity: null,
  unit: null,
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
};
const recent: FoodSuggestion = {
  ...base,
  kind: "recent",
  food_id: "22222222-2222-4222-8222-222222222222",
  name: "Omelete de queijo",
  serving_label: null,
  quantity: 1,
  unit: "unit",
  kcal: 210,
};

type HookResult = { data: FoodSuggestion[] | undefined; isLoading: boolean };
const mockHook = (r: HookResult) =>
  jest
    .mocked(useFoodSuggestions)
    .mockReturnValue(r as unknown as ReturnType<typeof useFoodSuggestions>);

function setup(value = "") {
  const onSelect = jest.fn();
  const onChangeText = jest.fn();
  render(<FoodAutocomplete value={value} onChangeText={onChangeText} onSelect={onSelect} />);
  const input = screen.getByLabelText("Descrição do item");
  return { onSelect, onChangeText, input };
}

describe("FoodAutocomplete", () => {
  beforeEach(() => {
    jest.mocked(useFoodSuggestions).mockReset();
  });

  test("focused and empty shows recents", () => {
    mockHook({ data: [recent], isLoading: false });
    const { input } = setup("");
    expect(screen.queryByText("Omelete de queijo")).toBeNull();
    fireEvent(input, "focus");
    expect(screen.getByText("Omelete de queijo")).toBeTruthy();
    expect(screen.getByText("Recente")).toBeTruthy();
    expect(jest.mocked(useFoodSuggestions)).toHaveBeenLastCalledWith("", true);
  });

  test("autoFocus focuses the input and shows recents on mount", () => {
    mockHook({ data: [recent], isLoading: false });
    render(<FoodAutocomplete value="" onChangeText={jest.fn()} onSelect={jest.fn()} autoFocus />);
    expect(screen.getByLabelText("Descrição do item").props.autoFocus).toBe(true);
    expect(screen.getByText("Omelete de queijo")).toBeTruthy();
    expect(jest.mocked(useFoodSuggestions)).toHaveBeenLastCalledWith("", true);
  });

  test("typing shows matching catalog suggestion", () => {
    mockHook({ data: [base], isLoading: false });
    const { input, onChangeText } = setup("arr");
    fireEvent(input, "focus");
    fireEvent.changeText(input, "arr");
    expect(onChangeText).toHaveBeenCalledWith("arr");
    expect(screen.getByText("Arroz, tipo 1, cozido")).toBeTruthy();
    expect(screen.getByText("1 colher de sopa (25g) · 32 kcal")).toBeTruthy();
    expect(jest.mocked(useFoodSuggestions)).toHaveBeenLastCalledWith("arr", true);
  });

  test("tapping a suggestion calls onSelect with it", () => {
    mockHook({ data: [base], isLoading: false });
    const { input, onSelect } = setup("arr");
    fireEvent(input, "focus");
    fireEvent.press(
      screen.getByLabelText("Arroz, tipo 1, cozido, 1 colher de sopa (25g), 32 kcal"),
    );
    expect(onSelect).toHaveBeenCalledWith(base);
  });

  test("catalog row without a serving shows 100 g and kcal per 100 g", () => {
    mockHook({ data: [{ ...base, serving_label: null, serving_grams: null }], isLoading: false });
    const { input } = setup("arr");
    fireEvent(input, "focus");
    expect(screen.getByText("100 g · 128 kcal")).toBeTruthy();
    expect(screen.getByLabelText("Arroz, tipo 1, cozido, 100 g, 128 kcal")).toBeTruthy();
  });

  test("recent row shows the last-use quantity and its kcal, even with a catalog serving", () => {
    mockHook({
      data: [{ ...recent, serving_label: "1 unidade (50g)", serving_grams: 50 }],
      isLoading: false,
    });
    const { input } = setup("");
    fireEvent(input, "focus");
    expect(screen.getByText("1 un · 210 kcal")).toBeTruthy();
    expect(screen.getByLabelText("Omelete de queijo, recente, 1 un, 210 kcal")).toBeTruthy();
  });

  test("no suggestions hides the list and keeps the typed text", () => {
    mockHook({ data: [], isLoading: false });
    const { input } = setup("xyz");
    fireEvent(input, "focus");
    expect(screen.queryByTestId("food-suggestions")).toBeNull();
    expect(input.props.value).toBe("xyz");
  });

  test("undefined data (single char) is treated as empty", () => {
    mockHook({ data: undefined, isLoading: false });
    const { input } = setup("a");
    fireEvent(input, "focus");
    expect(screen.queryByTestId("food-suggestions")).toBeNull();
  });

  test("loading shows the skeleton and no ActivityIndicator", () => {
    mockHook({ data: undefined, isLoading: true });
    const { input } = setup("arr");
    fireEvent(input, "focus");
    expect(screen.getByTestId("food-suggestions-skeleton")).toBeTruthy();
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });

  test("list closes after blur", () => {
    jest.useFakeTimers();
    mockHook({ data: [base], isLoading: false });
    const { input } = setup("arr");
    fireEvent(input, "focus");
    expect(screen.getByTestId("food-suggestions")).toBeTruthy();
    fireEvent(input, "blur");
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId("food-suggestions")).toBeNull();
    jest.useRealTimers();
  });
});
