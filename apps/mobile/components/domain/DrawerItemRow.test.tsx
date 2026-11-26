import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import type { ItemDraft } from "@/lib/meal-item-draft";

import { DrawerItemRow } from "./DrawerItemRow";

function item(over: Partial<ItemDraft>): ItemDraft {
  return {
    description: "Arroz cozido",
    quantity: 100,
    unit: "g",
    kcal: 128,
    protein_g: 2.5,
    carbs_g: 28,
    fat_g: 0.2,
    food_id: null,
    adjusted: false,
    ...over,
  } as ItemDraft;
}

function renderRow(over: Partial<ItemDraft>) {
  return render(
    <DrawerItemRow
      item={item(over)}
      hasError={false}
      disabled={false}
      onOpen={jest.fn()}
      onStep={jest.fn()}
    />,
  );
}

describe("DrawerItemRow", () => {
  test("a decimal quantity uses a comma", () => {
    renderRow({ quantity: 1.5, unit: "cup" });
    expect(screen.getByText("1,5 xíc")).toBeTruthy();
  });

  test("labels use the description", () => {
    renderRow({});
    expect(screen.getByLabelText("Editar Arroz cozido")).toBeTruthy();
    expect(screen.getByLabelText("Diminuir quantidade de Arroz cozido")).toBeTruthy();
    expect(screen.getByLabelText("Aumentar quantidade de Arroz cozido")).toBeTruthy();
  });

  test("an empty description falls back to the short name in the labels", () => {
    renderRow({ description: "  " });
    expect(screen.getByLabelText("Editar Item")).toBeTruthy();
    expect(screen.getByLabelText("Diminuir quantidade de Item")).toBeTruthy();
    expect(screen.getByLabelText("Aumentar quantidade de Item")).toBeTruthy();
  });
});
