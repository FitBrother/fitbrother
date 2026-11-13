import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { presetsDoStory } from "@/lib/share/story-presets";
import { PresetRow, proximoIndice } from "./PresetRow";

const TRES = presetsDoStory({ temFoto: true, temMacros: true });
const UM = presetsDoStory({ temFoto: true, temMacros: false });

function montar(over: Partial<Parameters<typeof PresetRow>[0]> = {}) {
  const onSelecionar = jest.fn();
  const onCentro = jest.fn();
  const r = render(
    <PresetRow
      presets={TRES}
      index={0}
      onSelecionar={onSelecionar}
      onCentro={onCentro}
      rotuloCentro="Tirar foto"
      {...over}
    />,
  );
  return { ...r, onSelecionar, onCentro };
}

describe("proximoIndice", () => {
  test("arrasto para a esquerda avança", () => {
    expect(proximoIndice(0, -30, 3)).toBe(1);
  });

  test("arrasto para a direita volta", () => {
    expect(proximoIndice(1, 30, 3)).toBe(0);
  });

  test("não passa das pontas", () => {
    expect(proximoIndice(0, 30, 3)).toBe(0);
    expect(proximoIndice(2, -30, 3)).toBe(2);
  });

  test("arrasto curto não troca", () => {
    expect(proximoIndice(1, 10, 3)).toBe(1);
  });
});

describe("PresetRow", () => {
  test("mostra o nome do preset em cena", () => {
    expect(montar({ index: 1 }).getByText("Etiqueta")).toBeTruthy();
  });

  test("tocar numa bolinha lateral seleciona", () => {
    const { getByLabelText, onSelecionar, onCentro } = montar();
    fireEvent.press(getByLabelText("Preset Discreto"));
    expect(onSelecionar).toHaveBeenCalledWith(2);
    expect(onCentro).not.toHaveBeenCalled();
  });

  test("tocar no centro dispara", () => {
    const { getByLabelText, onCentro, onSelecionar } = montar();
    fireEvent.press(getByLabelText("Tirar foto"));
    expect(onCentro).toHaveBeenCalledTimes(1);
    expect(onSelecionar).not.toHaveBeenCalled();
  });

  test("centro desabilitado não dispara", () => {
    const { getByLabelText, onCentro } = montar({ centroDesabilitado: true });
    fireEvent.press(getByLabelText("Tirar foto"));
    expect(onCentro).not.toHaveBeenCalled();
  });

  test("com um preset só, não há bolinha lateral", () => {
    const { queryByLabelText } = montar({ presets: UM });
    expect(queryByLabelText("Preset Etiqueta")).toBeNull();
    expect(queryByLabelText("Preset Completo")).toBeNull();
  });
});
