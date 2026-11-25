import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { MealSummaryCard } from "./MealSummaryCard";

const totals = { kcal: 459, protein_g: 30, carbs_g: 50, fat_g: 12 };

describe("MealSummaryCard", () => {
  test("shows the total kcal", () => {
    render(<MealSummaryCard totals={totals} deltaKcal={0} />);
    expect(screen.getByText("459")).toBeTruthy();
    expect(screen.getByText("kcal")).toBeTruthy();
  });

  test("shows a positive delta chip", () => {
    render(<MealSummaryCard totals={totals} deltaKcal={32} />);
    expect(screen.getByText("+32 kcal")).toBeTruthy();
  });

  test("shows a negative delta chip with a minus sign", () => {
    render(<MealSummaryCard totals={totals} deltaKcal={-12.4} />);
    expect(screen.getByText("−12 kcal")).toBeTruthy();
  });

  test.each([0, 0.3, -0.4])("hides the chip when delta rounds to zero (%s)", (delta) => {
    render(<MealSummaryCard totals={totals} deltaKcal={delta} />);
    expect(screen.queryByText(/^[+−]\d+ kcal$/)).toBeNull();
  });

  test("describes kcal and delta for screen readers", () => {
    render(<MealSummaryCard totals={totals} deltaKcal={32} />);
    expect(screen.getByLabelText("Total: 459 kcal, 32 kcal a mais que ao abrir")).toBeTruthy();
  });

  test("renders the macro grams", () => {
    render(<MealSummaryCard totals={totals} deltaKcal={0} />);
    expect(screen.getByText("30g")).toBeTruthy();
    expect(screen.getByText("50g")).toBeTruthy();
    expect(screen.getByText("12g")).toBeTruthy();
  });
});
