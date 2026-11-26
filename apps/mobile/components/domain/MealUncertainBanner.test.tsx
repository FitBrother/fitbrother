import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { MealUncertainBanner } from "./MealUncertainBanner";

describe("MealUncertainBanner", () => {
  test("is announced as an alert", () => {
    render(<MealUncertainBanner />);
    const banner = screen.getByTestId("meal-uncertain-banner");
    expect(banner.props.accessibilityRole).toBe("alert");
    expect(banner.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByText("Não tive certeza de alguns itens")).toBeTruthy();
  });
});
