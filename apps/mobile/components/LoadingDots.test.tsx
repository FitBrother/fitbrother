import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

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
});
