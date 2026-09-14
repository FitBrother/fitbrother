import { describe, expect, test } from "@jest/globals";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { radii } from "./radii";

// `lib/radii.ts` é um espelho manual dos tokens do Tailwind, igual ao
// `lib/colors.ts` — existe porque o NativeWind não processa className em
// componentes do Reanimated, então esses casos precisam do valor em JS.
// Espelho manual sem guard vira divergência silenciosa.
const ROOT = resolve(__dirname, "..");
const config = readFileSync(resolve(ROOT, "tailwind.config.ts"), "utf8");

function tokenDoConfig(nome: string): number {
  const match = config.match(new RegExp(`\\b${nome}:\\s*"(\\d+)px"`));
  if (!match) throw new Error(`token de raio "${nome}" não encontrado no tailwind.config.ts`);
  return Number(match[1]);
}

describe("radii espelha o tailwind.config", () => {
  test.each(["input", "card", "banner"] as const)("%s bate com o config", (nome) => {
    expect(radii[nome]).toBe(tokenDoConfig(nome));
  });

  test("card é metade da altura de controle — a curva exata dos pills de 52pt", () => {
    // `rounded-full` sobre 52px dá 26. Cards e controles têm uma curva só: um
    // par quase igual lê pior que nenhuma diferença. E 26 não existe na escala
    // do Tailwind — daí o valor fixo em vez de uma classe da escala.
    const CONTROL_HEIGHT = 52;
    expect(radii.card).toBe(CONTROL_HEIGHT / 2);
  });

  // Os dois lados do espelho batiam entre si e mesmo assim divergiam da tela:
  // ao subir a curva dos cards de 22 para 25 direto nas classes, o token ficou
  // para trás, e os três componentes que dependem dele (MealItemRowSwipeable,
  // MealRecorder, RecorderLockHint) passaram a desenhar 22 ao lado de vizinhos
  // de 25. Nenhum guard viu, porque nenhum olhava para as classes.
  test("nenhuma classe usa uma curva de card diferente do token", () => {
    const arquivos = execFileSync(
      "git",
      ["grep", "-hoE", "rounded-\\[[0-9]+px\\]", "--", "*.tsx", "*.ts"],
      { cwd: ROOT, encoding: "utf8" },
    );
    const literais = [...new Set(arquivos.split("\n").filter(Boolean))];
    const valores = literais.map((c) => Number(c.match(/\d+/)![0]));

    // `rounded-xl` (12) entra por classe da escala, não por literal — o único
    // raio arbitrário em uso é o do card.
    expect(valores.filter((v) => v !== radii.card)).toEqual([]);
  });
});
