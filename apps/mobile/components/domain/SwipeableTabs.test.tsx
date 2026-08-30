import { describe, expect, test } from "@jest/globals";

import { resolveIndex } from "./SwipeableTabs";

const WIDTH = 390;
const COUNT = 3;
const base = { width: WIDTH, count: COUNT };

describe("resolveIndex", () => {
  test("arrasto curto e lento não troca de aba", () => {
    expect(resolveIndex({ ...base, current: 1, translationX: -40, velocityX: -100 })).toBe(1);
  });

  test("arrasto além de 1/3 da largura para a esquerda avança", () => {
    expect(resolveIndex({ ...base, current: 0, translationX: -200, velocityX: 0 })).toBe(1);
  });

  test("arrasto além de 1/3 da largura para a direita retrocede", () => {
    expect(resolveIndex({ ...base, current: 2, translationX: 200, velocityX: 0 })).toBe(1);
  });

  test("fling rápido avança mesmo com pouca distância", () => {
    expect(resolveIndex({ ...base, current: 0, translationX: -20, velocityX: -900 })).toBe(1);
  });

  test("fling rápido para a direita retrocede mesmo com pouca distância", () => {
    expect(resolveIndex({ ...base, current: 2, translationX: 20, velocityX: 900 })).toBe(1);
  });

  test("não passa da última aba", () => {
    expect(resolveIndex({ ...base, current: 2, translationX: -300, velocityX: -900 })).toBe(2);
  });

  test("não passa da primeira aba", () => {
    expect(resolveIndex({ ...base, current: 0, translationX: 300, velocityX: 900 })).toBe(0);
  });
});
