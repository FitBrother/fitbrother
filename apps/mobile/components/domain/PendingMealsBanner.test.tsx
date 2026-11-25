import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";
import { PendingMealsBanner } from "./PendingMealsBanner";

function meal(id: string, consumed_at: string): MealResponse {
  return {
    id,
    source: "app_text",
    raw_input: null,
    audio_path: null,
    meal_type: "lunch",
    consumed_at,
    total_kcal: 100,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: 0.9,
    review_required: true,
    ai_feedback: null,
    created_at: consumed_at,
    deleted_at: null,
    items: [],
  };
}

describe("PendingMealsBanner", () => {
  test("renders nothing without pending meals", () => {
    render(<PendingMealsBanner meals={[]} onOpen={jest.fn()} />);
    expect(screen.queryByText(/aguardando confirmação/)).toBeNull();
    expect(screen.queryByText("Confirmar")).toBeNull();
  });

  test("uses the singular text for one meal", () => {
    render(<PendingMealsBanner meals={[meal("a", "2026-11-25T12:00:00Z")]} onOpen={jest.fn()} />);
    expect(screen.getByText("1 refeição aguardando confirmação")).toBeTruthy();
  });

  test("uses the plural text for several meals", () => {
    const meals = [meal("a", "2026-11-25T12:00:00Z"), meal("b", "2026-11-25T13:00:00Z")];
    render(<PendingMealsBanner meals={meals} onOpen={jest.fn()} />);
    expect(screen.getByText("2 refeições aguardando confirmação")).toBeTruthy();
  });

  test("the button opens the oldest pending meal", () => {
    const onOpen = jest.fn();
    const meals = [meal("late", "2026-11-25T19:00:00Z"), meal("early", "2026-11-25T08:00:00Z")];
    render(<PendingMealsBanner meals={meals} onOpen={onOpen} />);
    fireEvent.press(screen.getByRole("button", { name: "Confirmar refeição pendente" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("early");
  });

  test("keeps the Confirmar button reachable instead of grouping the banner", () => {
    render(<PendingMealsBanner meals={[meal("a", "2026-11-25T12:00:00Z")]} onOpen={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Confirmar refeição pendente" });
    for (let node = button.parent; node; node = node.parent) {
      if (node.props.accessibilityRole === "button") continue;
      expect(node.props.accessible).not.toBe(true);
    }
  });
});
