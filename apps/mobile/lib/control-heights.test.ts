import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 44 é a altura de controle do app: barra de abas, avatar, pill de ofensivas,
 * botão `sm`. É também o alvo de toque mínimo da CLAUDE.md §4.
 *
 * O `sm` do Button tinha 40 — abaixo do mínimo, e destoando de tudo à volta na
 * aba Amigos. Escapou de qualquer varredura de `<Pressable>` porque a altura
 * entra por interpolação de `sizeContainerStyles`, nunca literal na tag. Daí o
 * guard ler os mapas de tamanho direto do fonte.
 *
 * A relação em runtime entre `tabBarHeight()` e `AVATAR_SIZE` é verificada no
 * HomeHeader.test.tsx, que já tem os mocks da cadeia de imports dele.
 */
const CONTROL_HEIGHT = 44;
const ROOT = resolve(__dirname, "..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function buttonHeight(size: "sm" | "md" | "lg"): number {
  const match = source("components/Button.tsx").match(new RegExp(`${size}:\\s*"h-\\[(\\d+)px\\]`));
  if (!match) throw new Error(`altura do Button "${size}" não encontrada`);
  return Number(match[1]);
}

describe("alturas de controle", () => {
  test("o avatar do header é a altura de controle", () => {
    expect(source("components/domain/HomeHeader.tsx")).toMatch(
      new RegExp(`AVATAR_SIZE = ${CONTROL_HEIGHT}\\b`),
    );
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
 * A barra de abas é `rounded-full` sobre 44px, então sua curva real é 22px.
 * Uma linha de lista mais alta com a MESMA classe teria curva maior — foi o
 * que aconteceu ao levar `rounded-full` para o ranking (~64px → 32) e para
 * "Seguindo" (~60px → 30). Casar a curva exige o valor fixo, não a classe.
 */
describe("curva dos itens de lista da aba Amigos", () => {
  const CONTROL_RADIUS = CONTROL_HEIGHT / 2;

  // Reverter para `rounded-full` faz este teste falhar por si só — não há
  // asserção negativa separada.
  test.each([["components/domain/LeaderboardRow.tsx"], ["components/domain/FriendsPanel.tsx"]])(
    "%s usa a curva da barra de abas",
    (file) => {
      expect(source(file)).toContain(`rounded-[${CONTROL_RADIUS}px]`);
    },
  );
});
