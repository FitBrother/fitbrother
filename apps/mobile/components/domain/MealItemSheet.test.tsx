import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { FoodPer100g } from "@fitbrother/shared";

jest.mock("@/lib/hooks/useFoodSuggestions", () => ({
  useFoodSuggestions: jest.fn(),
}));

import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import type { ItemDraft } from "@/lib/meal-item-draft";
import { MealItemSheet } from "./MealItemSheet";

const food: FoodPer100g = {
  kcal_per_100g: 128,
  protein_per_100g: 2.5,
  carbs_per_100g: 28,
  fat_per_100g: 0.2,
  serving_grams: null,
};

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

const anchor: ItemDraft["link"] = {
  mode: "anchor",
  quantity: 100,
  unit: "g",
  macros: { kcal: 128, protein_g: 2.5, carbs_g: 28, fat_g: 0.2 },
};

function setup(overrides: Partial<ItemDraft> = {}) {
  const props = {
    onClose: jest.fn(),
    onRemove: jest.fn(),
    onSelectSuggestion: jest.fn(),
    onChangeDescription: jest.fn(),
    onChangeQuantity: jest.fn(),
    onChangeUnit: jest.fn(),
    onChangeMacro: jest.fn(),
    onResetCatalog: jest.fn(),
  };
  render(<MealItemSheet visible item={{ ...item, ...overrides }} {...props} />);
  return props;
}

describe("MealItemSheet", () => {
  beforeEach(() => {
    jest
      .mocked(useFoodSuggestions)
      .mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<
        typeof useFoodSuggestions
      >);
  });

  test("shows the name and quantity", () => {
    setup();
    expect(screen.getByDisplayValue("Arroz cozido")).toBeTruthy();
    expect(screen.getByLabelText("Quantidade").props.value).toBe("150");
  });

  test("renders nothing without an item", () => {
    render(
      <MealItemSheet
        visible
        item={null}
        onClose={jest.fn()}
        onRemove={jest.fn()}
        onSelectSuggestion={jest.fn()}
        onChangeDescription={jest.fn()}
        onChangeQuantity={jest.fn()}
        onChangeUnit={jest.fn()}
        onChangeMacro={jest.fn()}
        onResetCatalog={jest.fn()}
      />,
    );
    expect(screen.queryByText("Concluir item")).toBeNull();
  });

  test("plus steps the quantity by the unit step", () => {
    const { onChangeQuantity } = setup();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade"));
    expect(onChangeQuantity).toHaveBeenCalledWith(160);
  });

  test("minus steps down and is disabled at the minimum", () => {
    const { onChangeQuantity } = setup();
    fireEvent.press(screen.getByLabelText("Diminuir quantidade"));
    expect(onChangeQuantity).toHaveBeenCalledWith(140);
  });

  test("minus is disabled when it would reach zero", () => {
    const { onChangeQuantity } = setup({ quantity: 10 });
    fireEvent.press(screen.getByLabelText("Diminuir quantidade"));
    expect(onChangeQuantity).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Diminuir quantidade")).toBeDisabled();
  });

  test("quick amount 100 sets the quantity and the current one is selected", () => {
    const { onChangeQuantity } = setup();
    expect(screen.getByLabelText("150 g")).toBeSelected();
    expect(screen.getByLabelText("100 g")).not.toBeSelected();
    fireEvent.press(screen.getByLabelText("100 g"));
    expect(onChangeQuantity).toHaveBeenCalledWith(100);
  });

  test("a non-standard current quantity gets its own chip", () => {
    setup({ quantity: 120 });
    expect(screen.getByLabelText("120 g")).toBeSelected();
  });

  test("zero quantity shows only the base chips", () => {
    setup({ quantity: 0 });
    expect(screen.queryByLabelText("0 g")).toBeNull();
    expect(screen.getByLabelText("50 g")).toBeTruthy();
  });

  test("typing a comma decimal updates the quantity", () => {
    const { onChangeQuantity } = setup({ quantity: 1, unit: "cup" });
    fireEvent.changeText(screen.getByLabelText("Quantidade"), "1,5");
    expect(onChangeQuantity).toHaveBeenCalledWith(1.5);
  });

  test("emptying the quantity field reports zero", () => {
    const { onChangeQuantity } = setup();
    fireEvent.changeText(screen.getByLabelText("Quantidade"), "");
    expect(onChangeQuantity).toHaveBeenCalledWith(0);
    expect(screen.getByLabelText("Quantidade").props.value).toBe("");
  });

  test("picking another unit calls onChangeUnit", () => {
    const { onChangeUnit } = setup();
    fireEvent.press(screen.getByLabelText("Unidade xíc"));
    expect(onChangeUnit).toHaveBeenCalledWith("cup");
  });

  test("catalog item shows the TACO badge and catalog label", () => {
    setup({ link: { mode: "food", food } });
    expect(screen.getByText("TACO")).toBeTruthy();
    expect(screen.getByText("Calculado pelo catálogo")).toBeTruthy();
  });

  test("no TACO badge without a catalog link", () => {
    setup({ link: anchor });
    expect(screen.queryByText("TACO")).toBeNull();
    expect(screen.getByText("Proporcional ao registro original")).toBeTruthy();
  });

  test("adjusted catalog item offers to go back to the catalog", () => {
    const { onResetCatalog } = setup({ link: { mode: "food", food }, adjusted: true });
    expect(screen.getByText("Ajustado manualmente")).toBeTruthy();
    fireEvent.press(screen.getByText("Voltar ao catálogo"));
    expect(onResetCatalog).toHaveBeenCalled();
  });

  test("no back-to-catalog button for anchor items", () => {
    setup({ link: anchor, adjusted: true });
    expect(screen.queryByText("Voltar ao catálogo")).toBeNull();
  });

  test("the switch reveals the four macro fields", () => {
    const { onChangeMacro } = setup({ link: anchor });
    expect(screen.queryByLabelText("kcal, valor numérico")).toBeNull();
    fireEvent(screen.getByRole("switch"), "valueChange", true);
    fireEvent.changeText(screen.getByLabelText("kcal, valor numérico"), "200");
    expect(onChangeMacro).toHaveBeenCalledWith({ kcal: 200 });
    fireEvent.changeText(screen.getByLabelText("Proteína (g), valor numérico"), "4,5");
    expect(onChangeMacro).toHaveBeenCalledWith({ protein_g: 4.5 });
    expect(screen.getByLabelText("Carboidrato (g), valor numérico")).toBeTruthy();
    expect(screen.getByLabelText("Gordura (g), valor numérico")).toBeTruthy();
  });

  test("an adjusted item opens with the fields visible", () => {
    setup({ link: anchor, adjusted: true });
    expect(screen.getByLabelText("kcal, valor numérico")).toBeTruthy();
  });

  test("an unlinked item shows the fields without a switch", () => {
    setup();
    expect(screen.getByText("Informe os macros")).toBeTruthy();
    expect(screen.getByLabelText("kcal, valor numérico")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("warns when a linked item's unit has no conversion", () => {
    setup({ link: { mode: "food", food }, unit: "cup" });
    expect(screen.getByText("Sem conversão para esta unidade")).toBeTruthy();
  });

  test("no warning when the unit converts", () => {
    setup({ link: { mode: "food", food } });
    expect(screen.queryByText("Sem conversão para esta unidade")).toBeNull();
  });

  test("Concluir item and the backdrop close the sheet", () => {
    const { onClose } = setup();
    fireEvent.press(screen.getByText("Concluir item"));
    fireEvent.press(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("the trash button removes the item", () => {
    const { onRemove } = setup();
    fireEvent.press(screen.getByLabelText("Remover item"));
    expect(onRemove).toHaveBeenCalled();
  });

  test("macro grams use a decimal comma", () => {
    setup({ protein_g: 2.5 });
    expect(screen.getByText("2,5 g P")).toBeTruthy();
  });

  test("a new unnamed item focuses the name field", () => {
    setup({ description: "" });
    expect(screen.getByLabelText("Descrição do item").props.autoFocus).toBe(true);
  });

  test("a saved or named item does not autofocus", () => {
    setup({ id: "item-1", description: "" });
    expect(screen.getByLabelText("Descrição do item").props.autoFocus).toBeFalsy();
  });

  test("editing the name reports the new description", () => {
    const { onChangeDescription } = setup();
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Arroz integral");
    expect(onChangeDescription).toHaveBeenCalledWith("Arroz integral");
  });

  test("an adjusted anchor item shows the switch on and disabled with the fields", () => {
    setup({ link: anchor, adjusted: true });
    const sw = screen.getByRole("switch");
    expect(sw.props.value).toBe(true);
    expect(sw).toBeDisabled();
    expect(screen.getByLabelText("kcal, valor numérico")).toBeTruthy();
  });

  test("resetting an adjusted catalog item frees the switch", () => {
    const props = setup({ link: { mode: "food", food }, adjusted: true });
    expect(screen.getByRole("switch")).toBeDisabled();
    fireEvent.press(screen.getByText("Voltar ao catálogo"));
    expect(props.onResetCatalog).toHaveBeenCalled();

    screen.rerender(
      <MealItemSheet visible item={{ ...item, link: { mode: "food", food } }} {...props} />,
    );
    const sw = screen.getByRole("switch");
    expect(sw).not.toBeDisabled();
    expect(sw.props.value).toBe(false);
    expect(screen.queryByLabelText("kcal, valor numérico")).toBeNull();
    fireEvent(sw, "valueChange", true);
    expect(screen.getByLabelText("kcal, valor numérico")).toBeTruthy();
    fireEvent(screen.getByRole("switch"), "valueChange", false);
    expect(screen.queryByLabelText("kcal, valor numérico")).toBeNull();
  });

  test("reopening starts with the switch off for a different item", () => {
    const props = setup({ link: anchor });
    fireEvent(screen.getByRole("switch"), "valueChange", true);
    expect(screen.getByLabelText("kcal, valor numérico")).toBeTruthy();

    const other = { ...item, description: "Feijão", link: anchor };
    screen.rerender(<MealItemSheet visible={false} item={other} {...props} />);
    screen.rerender(<MealItemSheet visible item={other} {...props} />);
    expect(screen.getByRole("switch").props.value).toBe(false);
    expect(screen.queryByLabelText("kcal, valor numérico")).toBeNull();
  });
});
