import { describe, expect, test } from "@jest/globals";
import { morphEndpoints, morphHeight, morphPath, MORPH_STEPS } from "./morph-path";

const RAIO = 73;
const LARGURA = 296;

function pontos(d: string): { x: number; y: number }[] {
  return d
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((seg) => {
      const [x, y] = seg.slice(1).split(" ").map(Number);
      return { x: x!, y: y! };
    });
}

describe("morphEndpoints", () => {
  const e = morphEndpoints(RAIO, LARGURA, LARGURA);

  test("os dois extremos têm o mesmo número de pontos", () => {
    // É o que permite interpolar par a par sem reamostrar nada em tempo real.
    expect(e.ring).toHaveLength((MORPH_STEPS + 1) * 2);
    expect(e.bar).toHaveLength(e.ring.length);
  });

  test("o anel começa no topo e corre em sentido horário", () => {
    // Mesma origem do anel antigo: o preenchimento cresce a partir das 12h.
    expect(e.ring[0]).toBeCloseTo(LARGURA / 2);
    expect(e.ring[1]).toBeCloseTo(0);
    // Um quarto de volta adiante está na borda direita, na altura do centro.
    const q = (MORPH_STEPS / 4) * 2;
    expect(e.ring[q]).toBeCloseTo(LARGURA / 2 + RAIO);
    expect(e.ring[q + 1]).toBeCloseTo(RAIO);
  });

  test("a barra corre da esquerda para a direita, colada no topo", () => {
    expect(e.bar[0]).toBeCloseTo(0);
    expect(e.bar[1]).toBeCloseTo(0);
    expect(e.bar[e.bar.length - 2]).toBeCloseTo(LARGURA);
    expect(e.bar[e.bar.length - 1]).toBeCloseTo(0);
  });
});

// A propriedade que fez escolher esta técnica no lugar de desenrolar o anel
// mantendo o comprimento do traço: lá o raio cresce durante o morph e o
// container fica MAIS ALTO que o estado expandido no meio do caminho.
describe("morphHeight", () => {
  test("o expandido é o teto, e a altura só decresce", () => {
    let anterior = Infinity;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const h = morphHeight(t, RAIO, 14 - 4 * t);
      expect(h).toBeLessThanOrEqual(morphHeight(0, RAIO, 14) + 1e-9);
      expect(h).toBeLessThan(anterior);
      anterior = h;
    }
  });

  test("expandido é o diâmetro mais a espessura; colapsado é só a espessura", () => {
    expect(morphHeight(0, RAIO, 14)).toBe(2 * RAIO + 14);
    expect(morphHeight(1, RAIO, 10)).toBe(10);
  });
});

describe("morphPath", () => {
  const e = morphEndpoints(RAIO, LARGURA, LARGURA);

  test("em t=0 o traço fecha um círculo", () => {
    const p = pontos(morphPath(e, 0, 1, 7));
    const primeiro = p[0]!;
    const ultimo = p[p.length - 1]!;
    expect(ultimo.x).toBeCloseTo(primeiro.x, 0);
    expect(ultimo.y).toBeCloseTo(primeiro.y, 0);
    // Todo ponto fica na circunferência.
    for (const q of p) {
      const dx = q.x - LARGURA / 2;
      const dy = q.y - (RAIO + 7);
      expect(Math.hypot(dx, dy)).toBeCloseTo(RAIO, 0);
    }
  });

  test("em t=1 o traço é uma reta horizontal cobrindo a largura", () => {
    const p = pontos(morphPath(e, 1, 1, 5));
    for (const q of p) expect(q.y).toBeCloseTo(5, 5);
    expect(p[0]!.x).toBeCloseTo(0);
    expect(p[p.length - 1]!.x).toBeCloseTo(LARGURA);
  });

  test("nenhum estado intermediário passa da altura do expandido", () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const p = pontos(morphPath(e, t, 1, 0));
      const alto = Math.max(...p.map((q) => q.y));
      expect(alto).toBeLessThanOrEqual(2 * RAIO + 1e-6);
    }
  });

  test("o preenchimento é a mesma fração do caminho nos dois estados", () => {
    // 25% do anel é um quarto de volta; 25% da barra é um quarto da largura.
    const anel = pontos(morphPath(e, 0, 0.25, 0));
    expect(anel[anel.length - 1]!.x).toBeCloseTo(LARGURA / 2 + RAIO, 0);
    const barra = pontos(morphPath(e, 1, 0.25, 0));
    expect(barra[barra.length - 1]!.x).toBeCloseTo(LARGURA * 0.25, 0);
  });

  test("a ponta é interpolada, não arredondada para o ponto mais próximo", () => {
    // Sem isso o preenchimento anda aos saltos de 1/64 enquanto o valor anima.
    const a = pontos(morphPath(e, 1, 0.5, 0));
    const b = pontos(morphPath(e, 1, 0.5 + 0.5 / MORPH_STEPS, 0));
    expect(b[b.length - 1]!.x).toBeGreaterThan(a[a.length - 1]!.x);
  });

  test("progresso zero e progresso acima de 1 não estouram o caminho", () => {
    expect(pontos(morphPath(e, 0, 0, 0))).toHaveLength(1);
    const cheio = pontos(morphPath(e, 1, 1.5, 0));
    expect(cheio[cheio.length - 1]!.x).toBeCloseTo(LARGURA);
  });
});
