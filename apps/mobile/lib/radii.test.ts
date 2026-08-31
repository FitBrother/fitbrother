import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { radii } from "./radii";

// `lib/radii.ts` é um espelho manual dos tokens do Tailwind, igual ao
// `lib/colors.ts` — existe porque o NativeWind não processa className em
// componentes do Reanimated, então esses casos precisam do valor em JS.
// Espelho manual sem guard vira divergência silenciosa.
const config = readFileSync(resolve(__dirname, "..", "tailwind.config.ts"), "utf8");

function tokenDoConfig(nome: string): number {
  const match = config.match(new RegExp(`\\b${nome}:\\s*"(\\d+)px"`));
  if (!match) throw new Error(`token de raio "${nome}" não encontrado no tailwind.config.ts`);
  return Number(match[1]);
}

describe("radii espelha o tailwind.config", () => {
  test.each(["input", "card", "banner"] as const)("%s bate com o config", (nome) => {
    expect(radii[nome]).toBe(tokenDoConfig(nome));
  });

  test("card é metade da altura de controle — a curva exata dos pills de 44pt", () => {
    // `rounded-full` sobre 44px dá 22. Cards e controles passam a ter uma
    // curva só: 24 deixava duas quase iguais, o que lê pior que nenhuma
    // diferença. E 22 não existe na escala do Tailwind — daí o valor fixo.
    const CONTROL_HEIGHT = 44;
    expect(radii.card).toBe(CONTROL_HEIGHT / 2);
  });
});
