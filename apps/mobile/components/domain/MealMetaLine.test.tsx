import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MealMetaLine } from "./MealMetaLine";

jest.mock("@/components/WheelPicker", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    WheelPicker: ({
      max,
      value,
      onChange,
    }: {
      max: number;
      value: number;
      onChange: (v: number) => void;
    }) => (
      <Pressable accessibilityLabel={`Roda ${max}`} onPress={() => onChange(max)}>
        <Text>{`roda ${max}: ${value}`}</Text>
      </Pressable>
    ),
  };
});

const consumedAt = new Date(2026, 10, 25, 12, 40).toISOString();

function props(overrides: Partial<Parameters<typeof MealMetaLine>[0]> = {}) {
  return {
    mealType: "lunch" as const,
    consumedAt,
    onChangeMealType: jest.fn(),
    onChangeTime: jest.fn(),
    ...overrides,
  };
}

describe("MealMetaLine", () => {
  test("renders the type and the time as two tappable parts", () => {
    render(<MealMetaLine {...props()} />);
    expect(screen.getByRole("button", { name: "Tipo da refeição: Almoço" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Horário: 12:40" })).toBeTruthy();
    expect(screen.getByText("Almoço")).toBeTruthy();
    expect(screen.getByText("12:40")).toBeTruthy();
  });

  test("the type part opens the type list", () => {
    const p = props();
    render(<MealMetaLine {...p} />);
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    expect(p.onChangeMealType).toHaveBeenCalledWith("dinner");
    expect(screen.queryByText("Café da manhã")).toBeNull();
  });

  test("the time part opens the time picker", () => {
    const p = props();
    render(<MealMetaLine {...p} />);
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    fireEvent.press(screen.getByLabelText("Roda 23"));
    fireEvent.press(screen.getByLabelText("Confirmar"));
    expect(p.onChangeTime).toHaveBeenCalledWith(new Date(2026, 10, 25, 23, 40, 0, 0).toISOString());
  });

  test("disabled blocks both parts", () => {
    render(<MealMetaLine {...props({ disabled: true })} />);
    expect(
      screen.getByLabelText("Tipo da refeição: Almoço").props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(screen.getByLabelText("Horário: 12:40").props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
