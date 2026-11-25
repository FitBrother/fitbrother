import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";
import { PendingKcalNote } from "./PendingKcalNote";

function meal(over: Partial<MealResponse>): MealResponse {
  return {
    id: "a",
    source: "app_text",
    raw_input: null,
    audio_path: null,
    meal_type: "lunch",
    consumed_at: "2026-11-25T12:00:00Z",
    total_kcal: 459.4,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: 0.9,
    review_required: true,
    ai_feedback: null,
    created_at: "2026-11-25T12:00:00Z",
    deleted_at: null,
    items: [],
    ...over,
  };
}

describe("PendingKcalNote", () => {
  test("renders nothing without pending meals", () => {
    render(<PendingKcalNote meals={[]} />);
    expect(screen.queryByText(/quando você confirmar/)).toBeNull();
  });

  test("names the meal when exactly one is pending", () => {
    render(<PendingKcalNote meals={[meal({})]} />);
    expect(screen.getByText("+459 kcal quando você confirmar o almoço")).toBeTruthy();
  });

  test("names the meal type of a dinner", () => {
    render(<PendingKcalNote meals={[meal({ meal_type: "dinner", total_kcal: 700 })]} />);
    expect(screen.getByText("+700 kcal quando você confirmar o jantar")).toBeTruthy();
  });

  test("sums the kcal when several are pending", () => {
    render(
      <PendingKcalNote
        meals={[meal({ id: "a", total_kcal: 459.4 }), meal({ id: "b", total_kcal: 200.2 })]}
      />,
    );
    expect(screen.getByText("+660 kcal quando você confirmar as refeições pendentes")).toBeTruthy();
  });
});
