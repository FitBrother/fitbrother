import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { colors } from "@/lib/colors";
import { LoadingDots } from "./LoadingDots";

describe("LoadingDots", () => {
  test("renderiza três pontos", () => {
    const { getAllByTestId } = render(<LoadingDots />);
    expect(getAllByTestId("loading-dot")).toHaveLength(3);
  });

  test("expõe o estado de carregamento para leitores de tela", () => {
    const { getByLabelText } = render(<LoadingDots />);
    expect(getByLabelText("Carregando")).toBeTruthy();
  });

  // O NativeWind não processa className em componentes do Reanimated: uma
  // versão anterior estilizava os pontos por className e eles saíam sem
  // tamanho nem cor. O estilo precisa chegar de fato ao ponto.
  test("cada ponto tem tamanho e a cor da marca", () => {
    const { getAllByTestId } = render(<LoadingDots />);

    for (const dot of getAllByTestId("loading-dot")) {
      const style = StyleSheet.flatten(dot.props.style);
      expect(style.width).toBeGreaterThan(0);
      expect(style.height).toBeGreaterThan(0);
      expect(style.backgroundColor).toBe(colors.primary[400]);
    }
  });
});
