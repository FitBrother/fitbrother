import { describe, expect, test } from "@jest/globals";
import {
  arrastoParaFracao,
  ENQUADRAMENTO_PADRAO,
  escalaCover,
  folga,
  limitarEnquadramento,
  retanguloDeCorte,
  transformarFoto,
  ZOOM_MAXIMO,
} from "./crop";

/** Foto de celular em pé, e o quadro 4:5 do feed. */
const RETRATO = { width: 3024, height: 4032 };
const PAISAGEM = { width: 4032, height: 3024 };
const QUADRO_45 = { width: 400, height: 500 };

describe("escalaCover", () => {
  test("cobre pelo eixo mais apertado", () => {
    // Retrato (3:4) num quadro 4:5: o quadro é relativamente mais estreito,
    // então quem manda é a largura.
    expect(escalaCover(RETRATO, QUADRO_45)).toBeCloseTo(400 / 3024, 10);
    // Paisagem no mesmo quadro: agora falta altura.
    expect(escalaCover(PAISAGEM, QUADRO_45)).toBeCloseTo(500 / 3024, 10);
  });

  test("foto de tamanho zero não gera divisão por zero", () => {
    expect(escalaCover({ width: 0, height: 0 }, QUADRO_45)).toBe(1);
  });
});

describe("folga", () => {
  test("o eixo que define o cover não sobra nada", () => {
    // Retrato: a largura é quem cobre, então não há folga horizontal.
    const f = folga(RETRATO, QUADRO_45, 1);
    expect(f.x).toBeCloseTo(0, 6);
    expect(f.y).toBeGreaterThan(0);
  });

  test("aproximar abre folga nos dois eixos", () => {
    const f = folga(RETRATO, QUADRO_45, 2);
    expect(f.x).toBeCloseTo(QUADRO_45.width / 2, 6);
    expect(f.y).toBeGreaterThan(folga(RETRATO, QUADRO_45, 1).y);
  });
});

describe("limitarEnquadramento", () => {
  test("prende o zoom entre 1 e o teto", () => {
    expect(limitarEnquadramento({ scale: 0.2, dx: 0, dy: 0 }).scale).toBe(1);
    expect(limitarEnquadramento({ scale: 99, dx: 0, dy: 0 }).scale).toBe(ZOOM_MAXIMO);
  });

  test("prende o arrasto à folga disponível", () => {
    const e = limitarEnquadramento({ scale: 2, dx: 5, dy: -5 });
    expect(e.dx).toBe(1);
    expect(e.dy).toBe(-1);
  });
});

describe("retanguloDeCorte", () => {
  test("sem ajuste, é o recorte central do cover", () => {
    const r = retanguloDeCorte(ENQUADRAMENTO_PADRAO, RETRATO, QUADRO_45);
    // Largura inteira (é ela que cobre) e altura cortada na proporção 4:5.
    expect(r.width).toBeCloseTo(RETRATO.width, 6);
    expect(r.height).toBeCloseTo(RETRATO.width * (500 / 400), 6);
    expect(r.originX).toBeCloseTo(0, 6);
    // Centralizado na vertical: sobra metade para cada lado.
    expect(r.originY).toBeCloseTo((RETRATO.height - r.height) / 2, 6);
  });

  test("a proporção do recorte é sempre a do quadro", () => {
    for (const enq of [
      ENQUADRAMENTO_PADRAO,
      { scale: 1.7, dx: 0.4, dy: -0.8 },
      { scale: ZOOM_MAXIMO, dx: -1, dy: 1 },
    ]) {
      for (const foto of [RETRATO, PAISAGEM, { width: 800, height: 800 }]) {
        const r = retanguloDeCorte(enq, foto, QUADRO_45);
        expect(r.width / r.height).toBeCloseTo(QUADRO_45.width / QUADRO_45.height, 6);
      }
    }
  });

  test("nunca sai de dentro da foto, nem no limite do arrasto", () => {
    for (const dx of [-1, -0.5, 0, 0.5, 1]) {
      for (const dy of [-1, -0.5, 0, 0.5, 1]) {
        for (const scale of [1, 1.3, 2.5, ZOOM_MAXIMO]) {
          const r = retanguloDeCorte({ scale, dx, dy }, RETRATO, QUADRO_45);
          expect(r.originX).toBeGreaterThanOrEqual(0);
          expect(r.originY).toBeGreaterThanOrEqual(0);
          expect(r.originX + r.width).toBeLessThanOrEqual(RETRATO.width + 1e-6);
          expect(r.originY + r.height).toBeLessThanOrEqual(RETRATO.height + 1e-6);
        }
      }
    }
  });

  test("arrastar para cima mostra a parte de baixo da foto", () => {
    // `dy` negativo desloca a foto para cima, revelando o que estava abaixo.
    const centro = retanguloDeCorte(ENQUADRAMENTO_PADRAO, RETRATO, QUADRO_45);
    const baixo = retanguloDeCorte({ scale: 1, dx: 0, dy: -1 }, RETRATO, QUADRO_45);
    expect(baixo.originY).toBeGreaterThan(centro.originY);
    expect(baixo.originY + baixo.height).toBeCloseTo(RETRATO.height, 6);
  });

  test("aproximar recorta menos pixels da foto", () => {
    const um = retanguloDeCorte({ scale: 1, dx: 0, dy: 0 }, RETRATO, QUADRO_45);
    const dois = retanguloDeCorte({ scale: 2, dx: 0, dy: 0 }, RETRATO, QUADRO_45);
    expect(dois.width).toBeCloseTo(um.width / 2, 6);
    expect(dois.height).toBeCloseTo(um.height / 2, 6);
  });
});

describe("transformarFoto", () => {
  test("no zoom 1 e sem arrasto, a foto fica centrada", () => {
    const t = transformarFoto(ENQUADRAMENTO_PADRAO, RETRATO, QUADRO_45);
    expect(t.x).toBeCloseTo(0, 6);
    expect(t.y).toBeCloseTo(0, 6);
    expect(t.scale).toBeCloseTo(escalaCover(RETRATO, QUADRO_45), 10);
  });

  test("o mesmo enquadramento vale em qualquer tamanho de quadro", () => {
    // É a razão de guardar fração em vez de pixel: o preview é menor que o
    // quadro de captura, e o recorte final tem que bater com o que se viu.
    const enq = { scale: 1.8, dx: 0.5, dy: -0.25 };
    const pequeno = retanguloDeCorte(enq, RETRATO, { width: 200, height: 250 });
    const grande = retanguloDeCorte(enq, RETRATO, { width: 1080, height: 1350 });
    expect(pequeno.originX).toBeCloseTo(grande.originX, 6);
    expect(pequeno.originY).toBeCloseTo(grande.originY, 6);
    expect(pequeno.width).toBeCloseTo(grande.width, 6);
  });
});

describe("arrastoParaFracao", () => {
  test("converte pixels em fração da folga", () => {
    const f = folga(RETRATO, QUADRO_45, 2);
    const r = arrastoParaFracao({ x: f.x, y: f.y / 2 }, RETRATO, QUADRO_45, 2);
    expect(r.dx).toBeCloseTo(1, 6);
    expect(r.dy).toBeCloseTo(0.5, 6);
  });

  test("eixo sem folga devolve zero em vez de dividir por zero", () => {
    // Zoom 1 num retrato: a largura cobre exatamente, não há folga horizontal.
    const r = arrastoParaFracao({ x: 50, y: 0 }, RETRATO, QUADRO_45, 1);
    expect(r.dx).toBe(0);
    expect(Number.isFinite(r.dx)).toBe(true);
  });
});
