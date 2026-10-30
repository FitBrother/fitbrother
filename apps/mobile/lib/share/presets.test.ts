import { describe, expect, test } from "@jest/globals";
import { presetsAoVivo, SHARE_PRESETS } from "./presets";

describe("presetsAoVivo", () => {
  test("só os presets em que a foto preenche o quadro", () => {
    expect(presetsAoVivo().map((p) => p.id)).toEqual([
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
    expect(presetsAoVivo().some((p) => p.id === "moldura")).toBe(false);
  });

  test("exclui Pôster", () => {
    // `photo: "none"` — não há o que enquadrar.
    expect(presetsAoVivo().some((p) => p.id === "poster")).toBe(false);
  });

  test("todo preset ao vivo preenche o quadro com a foto", () => {
    for (const p of presetsAoVivo()) expect(p.photo).toBe("fill");
  });

  test("é subconjunto da lista completa, na mesma ordem", () => {
    // Ordem preservada: o índice do carrossel ao vivo e o da lista completa
    // precisam concordar quando a tela volta do modo câmera.
    const completos = SHARE_PRESETS.map((p) => p.id);
    const vivos = presetsAoVivo().map((p) => p.id);
    expect(vivos).toEqual(completos.filter((id) => vivos.includes(id)));
  });
});
