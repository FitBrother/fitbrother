import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { SubTabs, subTabLabelClass } from "./SubTabs";

const TABS = [
  { key: "posts", label: "Feed" },
  { key: "friends", label: "Amigos" },
] as const;

// As sub-abas do Social e de Análises usavam o mesmo segmented control da
// barra de navegação principal — pill branco sobre fundo cinza — e liam como
// navegação de primeiro nível. Agora é texto puro, com o ativo em negrito.
describe("subTabLabelClass", () => {
  test("destaca a aba ativa em negrito", () => {
    expect(subTabLabelClass(true)).toContain("font-sans-bold");
  });

  test("a inativa fica no peso normal e mais apagada", () => {
    expect(subTabLabelClass(false)).toContain("font-sans ");
    expect(subTabLabelClass(false)).not.toContain("bold");
    expect(subTabLabelClass(false)).toContain("text-neutral-500");
  });

  test("só peso e cor mudam — nada de fundo ou pill", () => {
    for (const classe of [subTabLabelClass(true), subTabLabelClass(false)]) {
      expect(classe).not.toMatch(/\bbg-/);
      expect(classe).not.toMatch(/\brounded-/);
    }
  });
});

describe("SubTabs", () => {
  test("marca a aba ativa para leitores de tela", () => {
    const { getByLabelText } = render(
      <SubTabs tabs={TABS} active="friends" onChange={jest.fn()} />,
    );

    expect(getByLabelText("Amigos").props.accessibilityState).toMatchObject({ selected: true });
    expect(getByLabelText("Feed").props.accessibilityState).toMatchObject({ selected: false });
  });

  test("avisa a troca de aba", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(<SubTabs tabs={TABS} active="posts" onChange={onChange} />);

    fireEvent.press(getByLabelText("Amigos"));

    expect(onChange).toHaveBeenCalledWith("friends");
  });

  test("o alvo de toque não encolhe com rótulo curto", () => {
    // Sem o pill, "Dia" mediria bem menos que os 44pt exigidos.
    const { getByLabelText } = render(
      <SubTabs tabs={[{ key: "day", label: "Dia" }] as const} active="day" onChange={jest.fn()} />,
    );

    expect(getByLabelText("Dia").props.className).toMatch(/min-w-\[44px\]/);
  });
});
