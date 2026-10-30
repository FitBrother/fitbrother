import { describe, expect, test } from "@jest/globals";
import { indiceAposCaptura, presetsAoVivo, presetsFor, SHARE_PRESETS } from "./presets";

describe("presetsAoVivo", () => {
  test("só os presets em que a foto preenche o quadro", () => {
    expect(presetsAoVivo({ temMacros: true }).map((p) => p.id)).toEqual([
      "noturno",
      "claro",
      "etiqueta",
      "discreto",
      "menta",
    ]);
  });

  test("exclui Moldura", () => {
    // A camada de câmera é única e fica ATRÁS do carrossel. Moldura desenha a
    // foto num retângulo interno, então no meio do arrasto a câmera apareceria
    // na área errada — e não existe buraco transparente dentro de uma View com
    // degradê.
    expect(presetsAoVivo({ temMacros: true }).some((p) => p.id === "moldura")).toBe(false);
  });

  test("exclui Pôster", () => {
    // `photo: "none"` — não há o que enquadrar.
    expect(presetsAoVivo({ temMacros: true }).some((p) => p.id === "poster")).toBe(false);
  });

  test("todo preset ao vivo preenche o quadro com a foto", () => {
    for (const p of presetsAoVivo({ temMacros: true })) expect(p.photo).toBe("fill");
  });

  test("sem macros, esconde os minimalistas", () => {
    // Etiqueta e Discreto anotam macros por cima da foto: sem macros viram
    // uma plaquinha com 0g 0g 0g. É a mesma regra que `presetsFor` aplica —
    // um preset que degenera não deve aparecer, ao vivo também não.
    expect(presetsAoVivo({ temMacros: false }).map((p) => p.id)).toEqual([
      "noturno",
      "claro",
      "menta",
    ]);
  });

  test("é subconjunto da lista completa, na mesma ordem", () => {
    // Ordem preservada: o índice do carrossel ao vivo e o da lista completa
    // precisam concordar quando a tela volta do modo câmera.
    const completos = SHARE_PRESETS.map((p) => p.id);
    const vivos = presetsAoVivo({ temMacros: true }).map((p) => p.id);
    expect(vivos).toEqual(completos.filter((id) => vivos.includes(id)));
  });
});

describe("indiceAposCaptura", () => {
  // A propriedade que importa: o preset que estava em cena na câmera tem que
  // reaparecer NELE MESMO no carrossel completo. O índice ao vivo e o da lista
  // completa não coincidem (Menta é 4 ao vivo e 5 na completa), e com macros ou
  // sem, as duas listas encolhem de formas diferentes.
  for (const temMacros of [true, false]) {
    test(`todo preset ao vivo volta nele mesmo (temMacros=${temMacros})`, () => {
      const completos = presetsFor({ temFoto: true, temMacros });
      for (const p of presetsAoVivo({ temMacros })) {
        const i = indiceAposCaptura(p.id, { temMacros });
        expect(completos[i]?.id).toBe(p.id);
      }
    });
  }
});
