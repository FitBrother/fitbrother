import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type React from "react";

import { SliderInput } from "./SliderInput";

function setup(overrides: Partial<React.ComponentProps<typeof SliderInput>> = {}) {
  const onChange = jest.fn();
  const utils = render(
    <SliderInput
      label="Altura"
      value={170}
      min={120}
      max={220}
      step={1}
      unit="cm"
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

describe("SliderInput — stepper", () => {
  test("os botões têm rótulo acessível derivado do label", () => {
    const { getByLabelText } = setup();
    expect(getByLabelText("Diminuir altura")).toBeTruthy();
    expect(getByLabelText("Aumentar altura")).toBeTruthy();
  });

  test("+ avança um passo e − recua um passo", () => {
    const { getByLabelText, onChange } = setup();
    fireEvent.press(getByLabelText("Aumentar altura"));
    expect(onChange).toHaveBeenCalledWith(171);

    onChange.mockClear();
    fireEvent.press(getByLabelText("Diminuir altura"));
    expect(onChange).toHaveBeenCalledWith(169);
  });

  test("respeita o step fracionário sem sujeira de ponto flutuante", () => {
    const { getByLabelText, onChange } = setup({ value: 0.5, min: 0.1, max: 1, step: 0.05 });
    fireEvent.press(getByLabelText("Aumentar altura"));
    expect(onChange).toHaveBeenCalledWith(0.55);
  });

  test("− fica desabilitado no mínimo e não chama onChange", () => {
    const { getByLabelText, onChange } = setup({ value: 120 });
    const botao = getByLabelText("Diminuir altura");
    expect(botao.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(botao);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("+ fica desabilitado no máximo alcançável e não chama onChange", () => {
    const { getByLabelText, onChange } = setup({ value: 220 });
    const botao = getByLabelText("Aumentar altura");
    expect(botao.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(botao);
    expect(onChange).not.toHaveBeenCalled();
  });

  // Os limites calculados (computeRateBounds, computeTargetWeightBounds) não
  // caem na grade min + n*step. Sem alinhar, o usuário arrasta até o fim e
  // para antes do máximo.
  test("o + para no maior múltiplo de step que cabe no max", () => {
    const { getByLabelText, onChange } = setup({ value: 0.7, min: 0.1, max: 0.75, step: 0.05 });
    fireEvent.press(getByLabelText("Aumentar altura"));
    expect(onChange).toHaveBeenCalledWith(0.75);

    const noTeto = setup({ value: 0.73, min: 0.1, max: 0.73, step: 0.05 });
    fireEvent.press(noTeto.getByLabelText("Aumentar altura"));
    expect(noTeto.onChange).not.toHaveBeenCalled();
  });

  test("o campo de texto continua commitando no blur, com clamp", () => {
    const { getByLabelText, onChange } = setup();
    const campo = getByLabelText("Altura — valor exato");
    fireEvent.changeText(campo, "999");
    fireEvent(campo, "blur");
    expect(onChange).toHaveBeenCalledWith(220);
  });
});
