import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MealMetaChips } from "./MealMetaChips";

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

const consumedAt = new Date(2026, 10, 25, 12, 40, 20).toISOString();

function props(overrides: Partial<Parameters<typeof MealMetaChips>[0]> = {}) {
  return {
    mealType: "lunch" as const,
    consumedAt,
    onChangeMealType: jest.fn(),
    onChangeTime: jest.fn(),
    ...overrides,
  };
}

describe("MealMetaChips", () => {
  test("shows the meal type name and the local time", () => {
    render(<MealMetaChips {...props()} />);
    expect(screen.getByText("Almoço")).toBeTruthy();
    expect(screen.getByText("12:40")).toBeTruthy();
  });

  test("exposes accessible labels on both chips", () => {
    render(<MealMetaChips {...props()} />);
    expect(screen.getByRole("button", { name: "Tipo da refeição: Almoço" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Horário: 12:40" })).toBeTruthy();
  });

  test("picking a type from the list calls onChangeMealType and closes the list", () => {
    const p = props();
    render(<MealMetaChips {...p} />);
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    expect(screen.getByText("Café da manhã")).toBeTruthy();
    fireEvent.press(screen.getByText("Jantar"));
    expect(p.onChangeMealType).toHaveBeenCalledWith("dinner");
    expect(screen.queryByText("Café da manhã")).toBeNull();
  });

  test("marks the current type as selected in the list", () => {
    render(<MealMetaChips {...props()} />);
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    const selectedRows = screen.getAllByRole("button", { selected: true });
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0].props.accessibilityLabel).toBe("Almoço");
    expect(screen.getByLabelText("Lanche").props.accessibilityState).toEqual({ selected: false });
  });

  test("closing the list via the backdrop does not change the type", () => {
    const p = props();
    render(<MealMetaChips {...p} />);
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByLabelText("Fechar lista de tipos"));
    expect(p.onChangeMealType).not.toHaveBeenCalled();
    expect(screen.queryByText("Café da manhã")).toBeNull();
  });

  test("opens the time picker at the current time and reports the new ISO on confirm", () => {
    const p = props();
    render(<MealMetaChips {...p} />);
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    expect(screen.getByText("roda 23: 12")).toBeTruthy();
    expect(screen.getByText("roda 55: 40")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Roda 23"));
    fireEvent.press(screen.getByLabelText("Roda 55"));
    fireEvent.press(screen.getByLabelText("Confirmar"));
    expect(p.onChangeTime).toHaveBeenCalledWith(new Date(2026, 10, 25, 23, 55, 0, 0).toISOString());
    expect(screen.queryByText("roda 23: 23")).toBeNull();
  });

  test("confirming the picker untouched does not change the time", () => {
    const p = props({ consumedAt: new Date(2026, 10, 25, 12, 58).toISOString() });
    render(<MealMetaChips {...p} />);
    fireEvent.press(screen.getByLabelText("Horário: 12:58"));
    fireEvent.press(screen.getByLabelText("Confirmar"));
    expect(p.onChangeTime).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Confirmar")).toBeNull();
  });

  test("a meal at 12:58 with only the hour changed keeps the rounded minute", () => {
    const p = props({ consumedAt: new Date(2026, 10, 25, 12, 58).toISOString() });
    render(<MealMetaChips {...p} />);
    fireEvent.press(screen.getByLabelText("Horário: 12:58"));
    fireEvent.press(screen.getByLabelText("Roda 23"));
    fireEvent.press(screen.getByLabelText("Confirmar"));
    expect(p.onChangeTime).toHaveBeenCalledWith(new Date(2026, 10, 25, 23, 55, 0, 0).toISOString());
  });

  test("reopening the picker after consumedAt changes shows the new time", () => {
    const p = props();
    const { rerender } = render(<MealMetaChips {...p} />);
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    fireEvent.press(screen.getByLabelText("Cancelar"));

    rerender(<MealMetaChips {...p} consumedAt={new Date(2026, 10, 25, 7, 5).toISOString()} />);
    fireEvent.press(screen.getByLabelText("Horário: 07:05"));
    expect(screen.getByText("roda 23: 7")).toBeTruthy();
    expect(screen.getByText("roda 55: 5")).toBeTruthy();
  });

  test("cancelling after scrolling the wheels discards the draft on reopen", () => {
    render(<MealMetaChips {...props()} />);
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    fireEvent.press(screen.getByLabelText("Roda 23"));
    expect(screen.getByText("roda 23: 23")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Cancelar"));
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    expect(screen.getByText("roda 23: 12")).toBeTruthy();
  });
});
