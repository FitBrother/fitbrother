import { describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// O MealComposer arrasta lib/audio/recorder → expo-av, que precisa de módulo
// nativo. Aqui só interessa uma função pura de espaçamento.
jest.mock("@/lib/audio/recorder", () => ({}));

import { MEAL_CARD_GAP } from "@/components/domain/MealCardSwipeable";
import { composerBottomPad } from "@/components/domain/MealComposer";

/**
 * Régua vertical da Home no mobile. Antes cada gap tinha nascido de um padding
 * diferente e nenhum conversava com o outro:
 *
 *   gap                        | antes | agora
 *   ---------------------------|-------|------
 *   pill de ofensivas → abas   |     8 |     8
 *   abas → dashboard           |    16 |     8
 *   dashboard → "Refeições"    |     8 |    16
 *   "Refeições" → 1º card      |    20 |     8
 *   entre cards                |    12 |     8
 *   abaixo do composer (web)   |     6 |     8
 *
 * O passo é 8. O único 16 é a quebra entre a seção do dashboard e a das
 * refeições — e é de propósito que ele seja maior que o gap do rótulo para a
 * lista: proximidade é o que agrupa o rótulo com o que ele nomeia. Antes era o
 * contrário, e "Refeições" parecia pertencer ao dashboard.
 *
 * São classes do Tailwind, então o guard lê o fonte. Blunt, mas espaçamento em
 * className é justamente o que ninguém percebe quando volta a divergir.
 */
const ROOT = resolve(__dirname, "..");
const home = readFileSync(resolve(ROOT, "app/(app)/index.tsx"), "utf8");
const header = readFileSync(resolve(ROOT, "components/domain/HomeHeader.tsx"), "utf8");

describe("régua vertical da Home", () => {
  test("o header não adiciona padding inferior próprio", () => {
    // Com `pb` aqui, o gap até o dashboard viraria a soma de dois paddings de
    // arquivos diferentes — que foi como ele virou 16 sem ninguém decidir.
    expect(header).toContain('className="gap-2 px-4 pt-2 md:hidden"');
  });

  test("o painel de macros abre com 8 e fecha com 16", () => {
    expect(home).toContain('className="gap-2 px-4 pb-4 pt-2"');
  });

  test("o rótulo 'Refeições' não empurra a lista", () => {
    expect(home).toMatch(/<View className="px-4">\s*<View className="flex-row items-baseline/);
  });

  test("os cards andam no mesmo passo do header", () => {
    expect(MEAL_CARD_GAP).toBe(8);
  });

  test("o respiro abaixo do composer cai no mesmo passo quando não há safe area", () => {
    expect(composerBottomPad(0)).toBe(MEAL_CARD_GAP);
  });

  test("o skeleton usa o mesmo passo do card real", () => {
    // Divergir aqui faz a lista pular no instante em que o card carrega.
    const skeleton = readFileSync(resolve(ROOT, "components/domain/MealCardSkeleton.tsx"), "utf8");
    expect(skeleton).toContain(`mt-${MEAL_CARD_GAP / 4}`);
  });
});
