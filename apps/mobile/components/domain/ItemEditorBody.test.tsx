import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Modal } from "react-native";

jest.mock("@/lib/hooks/useFoodSuggestions", () => ({
  useFoodSuggestions: jest.fn(),
}));

import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import type { ItemDraft } from "@/lib/meal-item-draft";
import { ItemEditorBody } from "./ItemEditorBody";

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

function setup(variant?: "sheet" | "drawer") {
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
  render(<ItemEditorBody item={item} variant={variant} {...props} />);
  return props;
}

describe("ItemEditorBody", () => {
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

  test("plus calls onChangeQuantity with the next step", () => {
    const { onChangeQuantity } = setup();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade"));
    expect(onChangeQuantity).toHaveBeenCalledWith(160);
  });

  test("Concluir item calls onClose", () => {
    const { onClose } = setup();
    fireEvent.press(screen.getByText("Concluir item"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the trash calls onRemove", () => {
    const { onRemove } = setup();
    fireEvent.press(screen.getByLabelText("Remover item"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("the sheet variant is the default and has its own outer scroll", () => {
    setup();
    expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    expect(screen.getByTestId("item-editor-scroll")).toBeTruthy();
  });

  test("the drawer variant renders the content without a Modal or outer scroll", () => {
    setup("drawer");
    expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    expect(screen.queryByTestId("item-editor-scroll")).toBeNull();
    expect(screen.getByDisplayValue("Arroz cozido")).toBeTruthy();
    expect(screen.getByText("Concluir item")).toBeTruthy();
  });
});
