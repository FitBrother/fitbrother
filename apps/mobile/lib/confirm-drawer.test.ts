import { describe, expect, test } from "@jest/globals";
import {
  drawerLabel,
  drawerViewReducer,
  headlineText,
  shortName,
  summarizeItems,
  type DrawerView,
} from "./confirm-drawer";

const items = (...names: string[]) => names.map((description) => ({ description }));

describe("shortName", () => {
  test("keeps only the first comma-separated segment", () => {
    expect(shortName("Arroz, tipo 1, cozido")).toBe("Arroz");
  });

  test("keeps multi-word names without commas", () => {
    expect(shortName("Feijão carioca")).toBe("Feijão carioca");
  });

  test("falls back to Item when empty", () => {
    expect(shortName("")).toBe("Item");
    expect(shortName("  , x")).toBe("Item");
  });
});

describe("summarizeItems", () => {
  test("lists the first unique names in order", () => {
    expect(summarizeItems(items("Arroz", "Feijão", "Frango", "Salada"))).toEqual({
      names: ["Arroz", "Feijão", "Frango"],
      extra: 1,
    });
  });

  test("does not count repeated names as extra", () => {
    expect(summarizeItems(items("Arroz, tipo 1", "Arroz, integral"))).toEqual({
      names: ["Arroz"],
      extra: 0,
    });
  });

  test("counts repeats of hidden names as extra items", () => {
    expect(summarizeItems(items("A", "B", "C", "D, x", "D, y"))).toEqual({
      names: ["A", "B", "C"],
      extra: 2,
    });
  });

  test("respects a custom max", () => {
    expect(summarizeItems(items("A", "B", "C"), 2)).toEqual({ names: ["A", "B"], extra: 1 });
  });
});

describe("headlineText", () => {
  test("one item", () => {
    expect(headlineText(items("Arroz, tipo 1"))).toBe("Arroz");
  });

  test("two items", () => {
    expect(headlineText(items("Arroz", "Feijão"))).toBe("Arroz e feijão");
  });

  test("three items", () => {
    expect(headlineText(items("Arroz", "Feijão", "Frango"))).toBe("Arroz, feijão e frango");
  });

  test("twelve items", () => {
    const many = items(
      "Arroz",
      "Feijão",
      "Frango",
      ...Array.from({ length: 9 }, (_, i) => `Extra ${i}`),
    );
    expect(headlineText(many)).toBe("Arroz, feijão, frango e mais 9");
  });

  test("repeated names collapse into one", () => {
    expect(headlineText(items("Arroz, tipo 1", "Arroz, integral"))).toBe("Arroz");
  });

  test("empty list", () => {
    expect(headlineText([])).toBe("");
  });
});

describe("drawerLabel", () => {
  test("up to three items", () => {
    expect(drawerLabel(1)).toBe("Entendi isto");
    expect(drawerLabel(3)).toBe("Entendi isto");
  });

  test("more than three items", () => {
    expect(drawerLabel(4)).toBe("Entendi 4 itens");
    expect(drawerLabel(12)).toBe("Entendi 12 itens");
  });
});

describe("drawerViewReducer", () => {
  const compact: DrawerView = { name: "compact" };
  const adjust: DrawerView = { name: "adjust" };
  const item: DrawerView = { name: "item", index: 2 };

  test("adjust opens the adjust view", () => {
    expect(drawerViewReducer(compact, { type: "adjust" })).toEqual(adjust);
  });

  test("back from adjust returns to compact", () => {
    expect(drawerViewReducer(adjust, { type: "back" })).toEqual(compact);
  });

  test("back on compact keeps compact", () => {
    expect(drawerViewReducer(compact, { type: "back" })).toEqual(compact);
  });

  test("edit_item opens the item view", () => {
    expect(drawerViewReducer(adjust, { type: "edit_item", index: 2 })).toEqual(item);
  });

  test("done_item and back from item return to adjust", () => {
    expect(drawerViewReducer(item, { type: "done_item" })).toEqual(adjust);
    expect(drawerViewReducer(item, { type: "back" })).toEqual(adjust);
  });
});
