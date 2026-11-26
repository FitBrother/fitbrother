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

type HookResult = {
  data: FoodSuggestion[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  isFetching?: boolean;
  isSettled?: boolean;
  isPlaceholderData?: boolean;
  refetch?: () => void;
};
const mockHook = (r: HookResult) =>
  jest.mocked(useFoodSuggestions).mockReturnValue({
    isError: false,
    isFetching: false,
    isSettled: true,
    isPlaceholderData: false,
    refetch: jest.fn(),
    ...r,
  } as unknown as ReturnType<typeof useFoodSuggestions>);

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

  test("placeholder invites a search", () => {
    mockHook({ data: [], isLoading: false });
    const { input } = setup("");
    expect(input.props.placeholder).toBe("Buscar alimento");
  });

  test("empty field explains the 2-letter rule above the recents", () => {
    mockHook({ data: [recent], isLoading: false });
    const { input } = setup("");
    fireEvent(input, "focus");
    expect(screen.getByText("A busca começa a partir de 2 letras.")).toBeTruthy();
    expect(screen.getByText("Usados recentemente")).toBeTruthy();
    expect(screen.getByText("Omelete de queijo")).toBeTruthy();
  });

  test("empty field without recents still shows the hint", () => {
    mockHook({ data: [], isLoading: false });
    const { input } = setup("");
    fireEvent(input, "focus");
    expect(screen.getByText("A busca começa a partir de 2 letras.")).toBeTruthy();
    expect(screen.queryByText("Usados recentemente")).toBeNull();
  });

  test("a single letter asks for one more and offers examples", () => {
    mockHook({ data: undefined, isLoading: false });
    const { input, onChangeText } = setup("a");
    fireEvent(input, "focus");
    expect(screen.getByText("Falta só mais 1 letra para buscar.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Buscar arroz"));
    expect(onChangeText).toHaveBeenCalledWith("arroz");
  });

  test("two or more letters group rows under Recentes and Catálogo", () => {
    mockHook({ data: [recent, base], isLoading: false });
    const { input } = setup("ar");
    fireEvent(input, "focus");
    expect(screen.getByText("Recentes")).toBeTruthy();
    expect(screen.getByText("Catálogo")).toBeTruthy();
    expect(screen.queryByText("Usados recentemente")).toBeNull();
  });

  test("a finished search with no rows offers to use the typed name", () => {
    mockHook({ data: [], isLoading: false });
    const { input } = setup("sushi");
    fireEvent(input, "focus");
    expect(screen.getByText("Não achamos “sushi” no catálogo")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Usar “sushi” mesmo assim"));
    expect(screen.queryByText("Não achamos “sushi” no catálogo")).toBeNull();
    expect(input.props.value).toBe("sushi");
  });

  test("no-result message waits for the search to finish", () => {
    mockHook({ data: [], isLoading: false, isFetching: true, isPlaceholderData: true });
    const { input } = setup("sushi");
    fireEvent(input, "focus");
    expect(screen.queryByText("Não achamos “sushi” no catálogo")).toBeNull();
  });

  test("no-result message waits for the debounce to settle", () => {
    mockHook({ data: [], isLoading: false, isSettled: false });
    const { input } = setup("sushi");
    fireEvent(input, "focus");
    expect(screen.queryByText("Não achamos “sushi” no catálogo")).toBeNull();
  });

  test("a failed search shows the error with retry and a free-text way out", () => {
    const refetch = jest.fn();
    mockHook({ data: undefined, isLoading: false, isError: true, refetch });
    const { input } = setup("arroz");
    fireEvent(input, "focus");
    expect(screen.getByText("Não foi possível buscar agora")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Tentar de novo"));
    expect(refetch).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("Usar “arroz” sem o catálogo"));
    expect(screen.queryByText("Não foi possível buscar agora")).toBeNull();
  });

  test("a failure does not hide rows that are already loaded", () => {
    mockHook({ data: [base], isLoading: false, isError: true });
    const { input } = setup("arr");
    fireEvent(input, "focus");
    expect(screen.getByText("Arroz, tipo 1, cozido")).toBeTruthy();
    expect(screen.queryByText("Não foi possível buscar agora")).toBeNull();
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
