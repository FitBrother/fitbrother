import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ItemDraft } from "@/lib/meal-item-draft";
import { MealItemRow } from "./MealItemRow";

const item: ItemDraft = {
  description: "Arroz cozido",
  quantity: 150,
  unit: "g",
  kcal: 192,
  protein_g: 3.8,
  carbs_g: 42,
  fat_g: 0.3,
  food_id: null,
  link: { mode: "none" },
  adjusted: false,
};

function setup(overrides: Partial<ItemDraft> = {}, hasError = false) {
  const onOpen = jest.fn();
  const onStep = jest.fn();
  render(
    <MealItemRow
      item={{ ...item, ...overrides }}
      hasError={hasError}
      onOpen={onOpen}
      onStep={onStep}
    />,
  );
  return { onOpen, onStep };
}

describe("MealItemRow", () => {
  test("shows name, kcal and formatted quantity", () => {
    setup();
    expect(screen.getByText("Arroz cozido")).toBeTruthy();
    expect(screen.getByText("192 kcal")).toBeTruthy();
    expect(screen.getByText("150 g")).toBeTruthy();
  });

  test("formats unit quantities with the unit label", () => {
    setup({ quantity: 1, unit: "unit" });
    expect(screen.getByText("1 un")).toBeTruthy();
  });

  test("tapping the name opens the item", () => {
    const { onOpen } = setup();
    fireEvent.press(screen.getByLabelText("Editar Arroz cozido"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("plus steps up and minus steps down", () => {
    const { onStep } = setup();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz cozido"));
    expect(onStep).toHaveBeenLastCalledWith(1);
    fireEvent.press(screen.getByLabelText("Diminuir quantidade de Arroz cozido"));
    expect(onStep).toHaveBeenLastCalledWith(-1);
  });

  test("stepper buttons expose the current quantity", () => {
    setup();
    expect(
      screen.getByLabelText("Aumentar quantidade de Arroz cozido").props.accessibilityValue,
    ).toEqual({ text: "150 g" });
    expect(
      screen.getByLabelText("Diminuir quantidade de Arroz cozido").props.accessibilityValue,
    ).toEqual({ text: "150 g" });
  });

  test("minus is disabled at the minimum quantity", () => {
    const { onStep } = setup({ quantity: 10, unit: "g" });
    const minus = screen.getByLabelText("Diminuir quantidade de Arroz cozido");
    expect(minus.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(minus);
    expect(onStep).not.toHaveBeenCalled();
  });

  test("shows the Ajustado badge only when adjusted and linked", () => {
    const anchor = {
      mode: "anchor",
      quantity: 100,
      unit: "g",
      macros: { kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 },
    } as const;
    const { unmount } = render(
      <MealItemRow
        item={{ ...item, adjusted: true, link: anchor }}
        hasError={false}
        onOpen={jest.fn()}
        onStep={jest.fn()}
      />,
    );
    expect(screen.getByText("Ajustado")).toBeTruthy();
    unmount();

    render(
      <MealItemRow
        item={{ ...item, adjusted: true }}
        hasError={false}
        onOpen={jest.fn()}
        onStep={jest.fn()}
      />,
    );
    expect(screen.queryByText("Ajustado")).toBeNull();
  });

  test("no badge when linked but not adjusted", () => {
    const anchor = {
      mode: "anchor",
      quantity: 100,
      unit: "g",
      macros: { kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 },
    } as const;
    setup({ link: anchor });
    expect(screen.queryByText("Ajustado")).toBeNull();
  });

  test("hasError adds the danger border", () => {
    setup({}, true);
    expect(screen.getByTestId("meal-item-row").props.className).toContain("border-danger-500");
  });

  test("no danger border without error", () => {
    setup();
    expect(screen.getByTestId("meal-item-row").props.className ?? "").not.toContain(
      "border-danger-500",
    );
  });
});
