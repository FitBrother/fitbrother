import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 44 é o alvo de toque mínimo da CLAUDE.md §4 e a altura do botão `sm`. É um
 * piso, não a altura padrão: o controle `md` do app tem 52.
 *
 * O `sm` do Button tinha 40 — abaixo do mínimo, e destoando de tudo à volta na
 * aba Amigos. Escapou de qualquer varredura de `<Pressable>` porque a altura
 * entra por interpolação de `sizeContainerStyles`, nunca literal na tag. Daí o
 * guard ler os mapas de tamanho direto do fonte.
 */
const CONTROL_HEIGHT = 44;

const ROOT = resolve(__dirname, "..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/**
 * A altura da linha do header — ofensiva, barra de abas e avatar, os três
 * casados — e das barras flutuantes do composer. Ela se descolou dos 44 quando
 * o menu de navegação saiu da própria linha e passou a dividir espaço com os
 * vizinhos: a barra precisou de mais corpo para a aba ativa manter o alvo de
 * toque por dentro dos 3px de padding de cada ponta.
 *
 * Não é um número próprio: é a altura de controle `md` do app, a mesma do
 * Button e do Input. Lida do config em vez de repetida aqui — repetir era
 * exatamente como `radii.card` ficou em 22 enquanto a tela toda já usava 25.
 *
 * A relação em runtime entre `tabBarHeight()` e `AVATAR_SIZE` é verificada no
 * HomeHeader.test.tsx, que já tem os mocks da cadeia de imports dele.
 */
const HEADER_HEIGHT = Number(
  source("tailwind.config.ts").match(/"button-height":\s*"(\d+)px"/)?.[1],
);

function buttonHeight(size: "sm" | "md" | "lg"): number {
  const match = source("components/Button.tsx").match(new RegExp(`${size}:\\s*"h-\\[(\\d+)px\\]`));
  if (!match) throw new Error(`altura do Button "${size}" não encontrada`);
  return Number(match[1]);
}

describe("alturas de controle", () => {
  test("o header fecha na altura de controle do app", () => {
    expect(HEADER_HEIGHT).toBe(52);
  });

  test("o avatar do header é a altura da linha do header", () => {
    expect(source("components/domain/HomeHeader.tsx")).toMatch(
      new RegExp(`AVATAR_SIZE = ${HEADER_HEIGHT}\\b`),
    );
  });

  test("as barras do composer fecham na mesma altura da linha do header", () => {
    // O pill de texto e o da gravação se alternam no mesmo lugar da tela; se
    // divergirem, o composer muda de altura ao começar a gravar.
    expect(source("components/domain/MealComposer.tsx")).toContain(`min-h-[${HEADER_HEIGHT}px]`);
    expect(source("components/domain/MealRecorder.tsx")).toContain(`minHeight: ${HEADER_HEIGHT}`);
  });

  test("a aba dentro da barra continua no alvo de toque mínimo", () => {
    // A barra tem a altura do header e 3px de padding em cada ponta. Se os
    // dois saírem de sintonia, a aba cai abaixo do mínimo sem ninguém
    // perceber — e ela não tem hitSlop para compensar.
    expect(HEADER_HEIGHT - 3 * 2).toBeGreaterThanOrEqual(CONTROL_HEIGHT);
  });

  test("o botão sm acompanha a altura de controle", () => {
    expect(buttonHeight("sm")).toBe(CONTROL_HEIGHT);
  });

  test("nenhum tamanho de botão fica abaixo do alvo de toque mínimo", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      expect(buttonHeight(size)).toBeGreaterThanOrEqual(CONTROL_HEIGHT);
    }
  });

  test("o token do Tailwind acompanha o componente", () => {
    expect(source("tailwind.config.ts")).toMatch(/"button-height-sm":\s*"44px"/);
  });
});

/**
 * A barra de abas é `rounded-full` sobre a linha do header, então sua curva
 * real é metade dela — 26px desde que a linha fechou nos 52 dos controles. Uma
 * linha de lista mais alta com a MESMA classe teria curva maior: foi o que
 * aconteceu ao levar `rounded-full` para o ranking (~64px → 32) e para
 * "Seguindo" (~60px → 30). Casar a curva exige o valor fixo, não a classe.
 */
describe("curva dos itens de lista da aba Amigos", () => {
  const CONTROL_RADIUS = HEADER_HEIGHT / 2;

  // Reverter para `rounded-full` faz este teste falhar por si só — não há
  // asserção negativa separada.
  test.each([["components/domain/LeaderboardRow.tsx"], ["components/domain/FriendsPanel.tsx"]])(
    "%s usa a curva da barra de abas",
    (file) => {
      expect(source(file)).toContain(`rounded-[${CONTROL_RADIUS}px]`);
    },
  );
});
