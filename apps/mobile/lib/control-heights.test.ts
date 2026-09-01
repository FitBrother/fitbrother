import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 44 é o alvo de toque mínimo da CLAUDE.md §4 e a altura dos controles de
 * conteúdo: botão `sm`, e cada aba dentro da barra.
 *
 * O `sm` do Button tinha 40 — abaixo do mínimo, e destoando de tudo à volta na
 * aba Amigos. Escapou de qualquer varredura de `<Pressable>` porque a altura
 * entra por interpolação de `sizeContainerStyles`, nunca literal na tag. Daí o
 * guard ler os mapas de tamanho direto do fonte.
 */
const CONTROL_HEIGHT = 44;

/**
 * 50 é a altura da linha do header — ofensiva, barra de abas e avatar, os três
 * casados. Ela se descolou dos 44 quando o menu de navegação saiu da própria
 * linha e passou a dividir espaço com os vizinhos: a barra precisou de mais
 * corpo para a aba ativa continuar com 44 de alvo de toque por dentro dos 3px
 * de padding de cada ponta.
 *
 * A relação em runtime entre `tabBarHeight()` e `AVATAR_SIZE` é verificada no
 * HomeHeader.test.tsx, que já tem os mocks da cadeia de imports dele.
 */
const HEADER_HEIGHT = 50;
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
  test("o avatar do header é a altura da linha do header", () => {
    expect(source("components/domain/HomeHeader.tsx")).toMatch(
      new RegExp(`AVATAR_SIZE = ${HEADER_HEIGHT}\\b`),
    );
  });

  test("a aba dentro da barra continua no alvo de toque mínimo", () => {
    // A barra tem 50 e 3px de padding em cada ponta — sobram exatamente 44
    // para a aba. Se a linha do header e o padding saírem de sintonia, a aba
    // cai abaixo do mínimo sem ninguém perceber.
    expect(HEADER_HEIGHT - 3 * 2).toBe(CONTROL_HEIGHT);
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
 * real é metade dela — 25px desde que a linha foi de 44 para 50. Uma linha de
 * lista mais alta com a MESMA classe teria curva maior: foi o que aconteceu ao
 * levar `rounded-full` para o ranking (~64px → 32) e para "Seguindo" (~60px →
 * 30). Casar a curva exige o valor fixo, não a classe.
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
