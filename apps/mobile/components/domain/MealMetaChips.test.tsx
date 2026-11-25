import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MealMetaChips } from "./MealMetaChips";

jest.mock("./TimePicker", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TimePicker: ({
      visible,
      initialHour,
      initialMinute,
      onConfirm,
    }: {
      visible: boolean;
      initialHour: number;
      initialMinute: number;
      onConfirm: (h: number, m: number) => void;
    }) =>
      visible ? (
        <Pressable accessibilityLabel="Confirmar horário" onPress={() => onConfirm(18, 5)}>
          <Text>{`picker ${initialHour}:${initialMinute}`}</Text>
        </Pressable>
      ) : null,
  };
});

const consumedAt = new Date(2026, 10, 25, 12, 40, 20).toISOString();

function setup(overrides: Partial<Parameters<typeof MealMetaChips>[0]> = {}) {
  const onChangeMealType = jest.fn();
  const onChangeTime = jest.fn();
  render(
    <MealMetaChips
      mealType="lunch"
      consumedAt={consumedAt}
      onChangeMealType={onChangeMealType}
      onChangeTime={onChangeTime}
      {...overrides}
    />,
  );
  return { onChangeMealType, onChangeTime };
}

describe("MealMetaChips", () => {
  test("shows the meal type name and the local time", () => {
    setup();
    expect(screen.getByText("Almoço")).toBeTruthy();
    expect(screen.getByText("12:40")).toBeTruthy();
  });

  test("exposes accessible labels on both chips", () => {
    setup();
    expect(screen.getByRole("button", { name: "Tipo da refeição: Almoço" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Horário: 12:40" })).toBeTruthy();
  });

  test("picking a type from the list calls onChangeMealType and closes the list", () => {
    const { onChangeMealType } = setup();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    expect(screen.getByText("Café da manhã")).toBeTruthy();
    fireEvent.press(screen.getByText("Jantar"));
    expect(onChangeMealType).toHaveBeenCalledWith("dinner");
    expect(screen.queryByText("Café da manhã")).toBeNull();
  });

  test("marks the current type as selected in the list", () => {
    setup();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    const selectedRows = screen.getAllByRole("button", { selected: true });
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0].props.accessibilityLabel).toBe("Almoço");
    expect(screen.getByLabelText("Lanche").props.accessibilityState).toEqual({ selected: false });
  });

  test("closing the list via the backdrop does not change the type", () => {
    const { onChangeMealType } = setup();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByLabelText("Fechar lista de tipos"));
    expect(onChangeMealType).not.toHaveBeenCalled();
    expect(screen.queryByText("Café da manhã")).toBeNull();
  });

  test("opens the time picker with the current local time and reports the new ISO", () => {
    const { onChangeTime } = setup();
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    expect(screen.getByText("picker 12:40")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Confirmar horário"));
    expect(onChangeTime).toHaveBeenCalledWith(new Date(2026, 10, 25, 18, 5, 0, 0).toISOString());
    expect(screen.queryByText("picker 12:40")).toBeNull();
  });
});
