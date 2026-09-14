import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { ConfirmDialog } from "./ConfirmDialog";

function montar(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <ConfirmDialog
      visible
      title="Sair da conta?"
      confirmLabel="Sair"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { ...utils, onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  test("confirmar e cancelar chamam callbacks diferentes", () => {
    const { getByLabelText, onConfirm, onCancel } = montar();

    fireEvent.press(getByLabelText("Sair"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // O ponto do diálogo é justamente a saída acidental. Se o fundo confirmasse,
  // ele passaria a CAUSAR o toque errado que existe para evitar.
  test("tocar no fundo cancela, nunca confirma", () => {
    const { getByTestId, onConfirm, onCancel } = montar();

    fireEvent.press(getByTestId("confirm-dialog-backdrop", { includeHiddenElements: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // `accessibilityViewIsModal` no card faz o leitor de tela ignorar os irmãos
  // dele. O fundo é um deles, então marcar um `role="button"` ali anunciaria
  // um alvo inalcançável — a busca padrão do RNTL, que pula o que está oculto
  // para acessibilidade, é o que reproduz esse comportamento aqui.
  test("o fundo não se anuncia como alvo para leitor de tela", () => {
    const { queryByTestId } = montar();

    expect(queryByTestId("confirm-dialog-backdrop")).toBeNull();
  });

  test("a descrição é opcional", () => {
    const { queryByText, rerender } = montar();
    expect(queryByText(/dados continuam/)).toBeNull();

    rerender(
      <ConfirmDialog
        visible
        title="Sair da conta?"
        description="Seus dados continuam salvos."
        confirmLabel="Sair"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(queryByText("Seus dados continuam salvos.")).not.toBeNull();
  });

  test("fechado não renderiza os botões", () => {
    const { queryByLabelText } = montar({ visible: false });

    expect(queryByLabelText("Sair")).toBeNull();
  });
});
