import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { Avatar } from "./Avatar";

// O botão de perfil na Home mostrava as iniciais mesmo com foto cadastrada —
// nunca houve <Image> ali. Estes testes travam os dois estados do componente
// que passou a ser a única fonte de avatar no app.
describe("Avatar", () => {
  test("mostra a foto quando há uri", () => {
    const { queryByTestId } = render(<Avatar uri="https://exemplo/a.jpg" initials="AS" />);

    expect(queryByTestId("avatar-image")).not.toBeNull();
    expect(queryByTestId("avatar-initials")).toBeNull();
  });

  test("cai nas iniciais quando não há uri", () => {
    const { queryByTestId, getByTestId } = render(<Avatar initials="AS" />);

    expect(queryByTestId("avatar-image")).toBeNull();
    expect(getByTestId("avatar-initials")).toHaveTextContent("AS");
  });

  test("uri nula também cai nas iniciais", () => {
    // O servidor devolve null quando a assinatura da URL falha; o componente
    // não pode tentar renderizar uma Image sem fonte.
    const { queryByTestId } = render(<Avatar uri={null} initials="AS" />);

    expect(queryByTestId("avatar-image")).toBeNull();
  });

  test("o círculo acompanha o tamanho pedido", () => {
    const { getByTestId } = render(<Avatar initials="AS" size={64} />);

    expect(getByTestId("avatar")).toHaveStyle({ width: 64, height: 64, borderRadius: 32 });
  });
});
