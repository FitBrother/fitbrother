import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";
import { MealCard } from "./MealCard";

function meal(review_required: boolean): MealResponse {
  return {
    id: "a",
    source: "app_text",
    raw_input: null,
    audio_path: null,
    meal_type: "lunch",
    consumed_at: "2026-11-25T12:00:00Z",
    total_kcal: 459,
    total_protein_g: 30,
    total_carbs_g: 50,
    total_fat_g: 12,
    confidence: 0.9,
    review_required,
    ai_feedback: null,
    created_at: "2026-11-25T12:00:00Z",
    deleted_at: null,
    items: [],
  };
}

describe("MealCard", () => {
  test("shows the Confirmar badge for a pending meal", () => {
    render(<MealCard meal={meal(true)} />);
    expect(screen.getByText("Confirmar")).toBeTruthy();
    expect(screen.queryByText("Revisar")).toBeNull();
  });

  test("announces a pending meal as waiting for confirmation", () => {
    render(<MealCard meal={meal(true)} />);
    expect(screen.getByLabelText(/aguardando confirmação/)).toBeTruthy();
  });

  test("shows no badge for a confirmed meal", () => {
    render(<MealCard meal={meal(false)} />);
    expect(screen.queryByText("Confirmar")).toBeNull();
    expect(screen.queryByLabelText(/aguardando confirmação/)).toBeNull();
  });
});
