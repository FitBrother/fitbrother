import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TimePicker } from "./TimePicker";

jest.mock("@/components/WheelPicker", () => ({ WheelPicker: () => null }));

function confirmWith(initialHour: number, initialMinute: number) {
  const onConfirm = jest.fn();
  render(
    <TimePicker
      visible
      initialHour={initialHour}
      initialMinute={initialMinute}
      onCancel={jest.fn()}
      onConfirm={onConfirm}
    />,
  );
  fireEvent.press(screen.getByLabelText("Confirmar"));
  return onConfirm;
}

describe("TimePicker", () => {
  test.each([
    [12, 58, 55],
    [12, 59, 55],
    [12, 57, 55],
    [12, 42, 40],
    [12, 0, 0],
  ])("opening at %i:%i confirms minute %i", (hour, minute, expected) => {
    expect(confirmWith(hour, minute)).toHaveBeenCalledWith(hour, expected);
  });
});
