import { describe, expect, test } from "@jest/globals";

import { clampOffset, resolveIndex } from "./SwipeableTabs";

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

// Sem limite no arrasto, a última aba podia ser puxada além do fim e revelar
// espaço vazio depois da última cena — a "tela em branco" relatada.
describe("clampOffset", () => {
  const limiteEsquerdo = -(COUNT - 1) * WIDTH; // -780 para 3 abas de 390

  test("mantém deslocamentos válidos intactos", () => {
    expect(clampOffset(-WIDTH, WIDTH, COUNT)).toBe(-WIDTH);
    expect(clampOffset(-200, WIDTH, COUNT)).toBe(-200);
  });

  test("não deixa arrastar antes da primeira aba", () => {
    expect(clampOffset(120, WIDTH, COUNT)).toBe(0);
    expect(clampOffset(5000, WIDTH, COUNT)).toBe(0);
  });

  test("não deixa arrastar além da última aba", () => {
    expect(clampOffset(limiteEsquerdo - 120, WIDTH, COUNT)).toBe(limiteEsquerdo);
    expect(clampOffset(-5000, WIDTH, COUNT)).toBe(limiteEsquerdo);
  });

  test("as duas bordas exatas são posições válidas", () => {
    expect(clampOffset(0, WIDTH, COUNT)).toBe(0);
    expect(clampOffset(limiteEsquerdo, WIDTH, COUNT)).toBe(limiteEsquerdo);
  });
});
