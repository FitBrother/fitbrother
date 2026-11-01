import { describe, expect, test } from "@jest/globals";
import {
  alvoDoToque,
  arranjoInicial,
  deveSalvarFoto,
  estiloFoto,
  estiloSticker,
  FOTO_ESCALA_MIN,
  FOTO_PADRAO,
  LOGO_ESCALA_MIN,
  moverFoto,
  moverSticker,
  prenderLogo,
  prenderSticker,
  STICKER_ESCALA_MAX,
  STICKER_ESCALA_MIN,
  stickersDoPreset,
  tamanhoDoQuadro,
  trazerParaFrente,
  Z_LOGO,
  zoomDaRoda,
  type Caixa,
  type ConteudoStory,
  type Sticker,
} from "./story";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "./geometry";
import { ZOOM_MAXIMO } from "@/lib/media/crop";

const REFEICAO: ConteudoStory = {
  kind: "meal",
  temLegenda: true,
  temMacros: true,
  temNota: false,
};
const ANALISE: ConteudoStory = {
  kind: "insight",
  temLegenda: true,
  temMacros: false,
  temNota: true,
};

function sticker(parcial: Partial<Sticker> = {}): Sticker {
  return { id: "calorias", dx: 0, dy: 0, scale: 1, rotation: 0, z: 1, removido: false, ...parcial };
}
const logo = sticker({ id: "logo", z: Z_LOGO });
const CAIXA_LOGO: Caixa = { x: 26, y: 520, width: 112, height: 34 };

/** Os quatro cantos do sticker depois do transform, em coordenadas do card. */
function cantosGirados(s: Sticker, c: Caixa) {
  const cx = c.x + c.width / 2 + s.dx;
  const cy = c.y + c.height / 2 + s.dy;
  const cos = Math.cos(s.rotation);
  const sen = Math.sin(s.rotation);
  const hw = (c.width * s.scale) / 2;
  const hh = (c.height * s.scale) / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: cx + x * cos - y * sen, y: cy + x * sen + y * cos }));
}

describe("stickersDoPreset", () => {
  test("refeição completa e pôster têm os cinco elementos, logo por último", () => {
    const esperado = ["data", "itens", "calorias", "macros", "logo"];
    expect(stickersDoPreset("completo", REFEICAO)).toEqual(esperado);
    expect(stickersDoPreset("poster", REFEICAO)).toEqual(esperado);
  });

  test("Etiqueta é a placa e o logo fora dela", () => {
    expect(stickersDoPreset("etiqueta", REFEICAO)).toEqual(["placa", "logo"]);
  });

  test("Discreto mostra só os números", () => {
    expect(stickersDoPreset("discreto", REFEICAO)).toEqual(["calorias", "macros", "logo"]);
  });

  test("análise tem tópicos no Completo e não no Pôster", () => {
    expect(stickersDoPreset("completo", ANALISE)).toEqual([
      "data",
      "nota",
      "titulo",
      "resumo",
      "topicos",
      "logo",
    ]);
    expect(stickersDoPreset("poster", ANALISE)).toEqual([
      "data",
      "nota",
      "titulo",
      "resumo",
      "logo",
    ]);
  });

  test("sem legenda, macros ou nota, nenhum sticker vazio", () => {
    expect(
      stickersDoPreset("completo", {
        kind: "meal",
        temLegenda: false,
        temMacros: false,
        temNota: false,
      }),
    ).toEqual(["data", "calorias", "logo"]);
    expect(stickersDoPreset("poster", { ...ANALISE, temNota: false })).toEqual([
      "data",
      "titulo",
      "resumo",
      "logo",
    ]);
  });
});

describe("arranjoInicial", () => {
  test("todo mundo na posição natural, e o logo por cima", () => {
    const arranjo = arranjoInicial(["data", "calorias", "logo"]);
    expect(arranjo.map((s) => s.z)).toEqual([1, 2, Z_LOGO]);
    for (const s of arranjo) {
      expect(s).toMatchObject({ dx: 0, dy: 0, scale: 1, rotation: 0, removido: false });
    }
  });
});

describe("moverSticker", () => {
  test("soma o deslocamento e o giro, e multiplica a escala", () => {
    const s = moverSticker(sticker({ dx: 10, dy: 20, scale: 2, rotation: 0.1 }), {
      dx: 5,
      dy: -5,
      k: 1.5,
      rot: 0.2,
    });
    expect(s).toMatchObject({ dx: 15, dy: 15, scale: 3 });
    expect(s.rotation).toBeCloseTo(0.3);
  });

  test("prende a escala nos limites", () => {
    expect(moverSticker(sticker(), { dx: 0, dy: 0, k: 100, rot: 0 }).scale).toBe(
      STICKER_ESCALA_MAX,
    );
    expect(moverSticker(sticker(), { dx: 0, dy: 0, k: 0.01, rot: 0 }).scale).toBe(
      STICKER_ESCALA_MIN,
    );
  });
});

describe("prenderSticker", () => {
  test("o centro nunca sai do quadro, para o sticker não sumir", () => {
    const caixa: Caixa = { x: 100, y: 100, width: 100, height: 40 };
    const s = prenderSticker(sticker({ dx: 5000, dy: -5000 }), caixa);
    expect(caixa.x + caixa.width / 2 + s.dx).toBe(SHARE_CARD_WIDTH);
    expect(caixa.y + caixa.height / 2 + s.dy).toBe(0);
  });

  test("dentro do quadro não muda nada", () => {
    const caixa: Caixa = { x: 100, y: 100, width: 100, height: 40 };
    expect(prenderSticker(sticker({ dx: 30, dy: 30 }), caixa)).toMatchObject({ dx: 30, dy: 30 });
  });
});

describe("prenderLogo", () => {
  test("logo girado na borda continua inteiro no quadro", () => {
    const s = prenderLogo({ ...logo, dx: 400, dy: 400, rotation: 0.8, scale: 2 }, CAIXA_LOGO);
    for (const p of cantosGirados(s, CAIXA_LOGO)) {
      expect(p.x).toBeGreaterThanOrEqual(-0.01);
      expect(p.x).toBeLessThanOrEqual(SHARE_CARD_WIDTH + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(-0.01);
      expect(p.y).toBeLessThanOrEqual(SHARE_CARD_HEIGHT + 0.01);
    }
  });

  test("também no canto oposto", () => {
    const s = prenderLogo({ ...logo, dx: -900, dy: -900, rotation: 2.4 }, CAIXA_LOGO);
    for (const p of cantosGirados(s, CAIXA_LOGO)) {
      expect(p.x).toBeGreaterThanOrEqual(-0.01);
      expect(p.y).toBeGreaterThanOrEqual(-0.01);
    }
  });

  test("zoom gigante encolhe até caber", () => {
    const s = prenderLogo({ ...logo, scale: 40 }, CAIXA_LOGO);
    expect(CAIXA_LOGO.width * s.scale).toBeLessThanOrEqual(SHARE_CARD_WIDTH + 0.01);
  });

  test("encolher para no mínimo", () => {
    expect(prenderLogo({ ...logo, scale: 0.1 }, CAIXA_LOGO).scale).toBe(LOGO_ESCALA_MIN);
  });
});

describe("moverFoto", () => {
  test("aplica o gesto à foto", () => {
    const f = moverFoto(FOTO_PADRAO, { dx: 10, dy: -4, k: 2, rot: 0.5 });
    expect(f).toEqual({ x: 10, y: -4, scale: 2, rotation: 0.5 });
  });

  test("pode ficar menor que o quadro, até o mínimo", () => {
    expect(moverFoto(FOTO_PADRAO, { dx: 0, dy: 0, k: 0.01, rot: 0 }).scale).toBe(FOTO_ESCALA_MIN);
  });

  test("prende no teto de zoom", () => {
    expect(moverFoto(FOTO_PADRAO, { dx: 0, dy: 0, k: 100, rot: 0 }).scale).toBe(ZOOM_MAXIMO);
  });

  test("o centro da foto não sai do quadro", () => {
    const f = moverFoto(FOTO_PADRAO, { dx: 9000, dy: -9000, k: 1, rot: 0 });
    expect(f.x).toBe(SHARE_CARD_WIDTH / 2);
    expect(f.y).toBe(-SHARE_CARD_HEIGHT / 2);
  });
});

describe("alvoDoToque", () => {
  const caixas: Partial<Record<Sticker["id"], Caixa>> = {
    calorias: { x: 100, y: 100, width: 100, height: 60 },
    macros: { x: 100, y: 120, width: 100, height: 60 },
  };

  test("fora de tudo não há alvo", () => {
    expect(alvoDoToque({ x: 10, y: 400 }, [sticker()], caixas)).toBeNull();
  });

  test("com dois sobrepostos, ganha o de cima", () => {
    const stickers = [sticker({ z: 1 }), sticker({ id: "macros", z: 2 })];
    expect(alvoDoToque({ x: 150, y: 140 }, stickers, caixas)).toBe("macros");
  });

  test("toque num sticker removido passa direto", () => {
    expect(alvoDoToque({ x: 150, y: 130 }, [sticker({ removido: true })], caixas)).toBeNull();
  });

  test("considera o deslocamento do sticker", () => {
    const s = sticker({ dx: 150, dy: 200 });
    expect(alvoDoToque({ x: 300, y: 330 }, [s], caixas)).toBe("calorias");
    expect(alvoDoToque({ x: 150, y: 130 }, [s], caixas)).toBeNull();
  });

  test("considera a rotação", () => {
    const fina: Partial<Record<Sticker["id"], Caixa>> = {
      calorias: { x: 80, y: 295, width: 200, height: 50 },
    };
    const girado = sticker({ rotation: Math.PI / 2 });
    expect(alvoDoToque({ x: 180, y: 400 }, [girado], fina)).toBe("calorias");
    expect(alvoDoToque({ x: 260, y: 320 }, [girado], fina)).toBeNull();
  });

  test("sticker pequeno tem área de toque mínima", () => {
    const pequeno: Partial<Record<Sticker["id"], Caixa>> = {
      calorias: { x: 100, y: 100, width: 10, height: 10 },
    };
    expect(alvoDoToque({ x: 125, y: 125 }, [sticker()], pequeno)).toBe("calorias");
  });

  test("sticker sem medida ainda não é alvo", () => {
    expect(alvoDoToque({ x: 150, y: 130 }, [sticker({ id: "data" })], caixas)).toBeNull();
  });
});

describe("trazerParaFrente", () => {
  test("sobe acima dos outros, sem passar do logo", () => {
    const stickers = [sticker({ z: 1 }), sticker({ id: "macros", z: 2 }), logo];
    const r = trazerParaFrente(stickers, "calorias");
    expect(r.find((s) => s.id === "calorias")?.z).toBe(3);
    expect(r.find((s) => s.id === "logo")?.z).toBe(Z_LOGO);
  });

  test("nunca encosta no logo", () => {
    const stickers = [sticker({ z: 1 }), sticker({ id: "macros", z: Z_LOGO - 1 }), logo];
    expect(trazerParaFrente(stickers, "calorias").find((s) => s.id === "calorias")?.z).toBe(
      Z_LOGO - 1,
    );
  });

  test("o logo não muda", () => {
    const stickers = [sticker({ z: 5 }), logo];
    expect(trazerParaFrente(stickers, "logo")).toEqual(stickers);
  });
});

describe("estilos", () => {
  test("sticker removido some sem sair do fluxo", () => {
    expect(estiloSticker(sticker({ removido: true })).opacity).toBe(0);
  });

  test("transform do sticker, na ordem certa", () => {
    expect(estiloSticker(sticker({ dx: 3, dy: 4, rotation: 0.5, scale: 2, z: 7 }))).toEqual({
      zIndex: 7,
      opacity: 1,
      transform: [{ translateX: 3 }, { translateY: 4 }, { rotate: "0.5rad" }, { scale: 2 }],
    });
  });

  test("a escala da foto parte do cover", () => {
    const { transform } = estiloFoto(
      { x: 1, y: 2, scale: 2, rotation: 0 },
      { width: 1080, height: 1920 },
      { width: 360, height: 640 },
    );
    expect(transform).toEqual([
      { translateX: 1 },
      { translateY: 2 },
      { rotate: "0rad" },
      { scale: (1 / 3) * 2 },
    ]);
  });
});

describe("tamanhoDoQuadro", () => {
  test("ocupa a largura quando sobra altura", () => {
    expect(tamanhoDoQuadro({ width: 390, height: 760 }, 9 / 16)).toEqual({
      width: 390,
      height: 693,
    });
  });

  test("encolhe pela altura em tela baixa", () => {
    expect(tamanhoDoQuadro({ width: 375, height: 591 }, 9 / 16)).toEqual({
      width: 332,
      height: 590,
    });
  });

  test("4:5 também", () => {
    expect(tamanhoDoQuadro({ width: 400, height: 800 }, 4 / 5)).toEqual({
      width: 400,
      height: 500,
    });
  });
});

describe("zoomDaRoda", () => {
  test("rolar para baixo afasta, para cima aproxima", () => {
    expect(zoomDaRoda(100)).toBeLessThan(1);
    expect(zoomDaRoda(-100)).toBeGreaterThan(1);
    expect(zoomDaRoda(0)).toBe(1);
  });
});

describe("deveSalvarFoto", () => {
  const base = { type: "meal", fotoLocal: "blob:x", temFotoSalva: false, jaSalvou: false };

  test("refeição sem foto ganha a foto exportada", () => {
    expect(deveSalvarFoto(base)).toBe(true);
  });

  test("foto salva nunca é sobrescrita", () => {
    expect(deveSalvarFoto({ ...base, temFotoSalva: true })).toBe(false);
  });

  test("só o primeiro export salva", () => {
    expect(deveSalvarFoto({ ...base, jaSalvou: true })).toBe(false);
  });

  test("post e análise não salvam", () => {
    expect(deveSalvarFoto({ ...base, type: "post" })).toBe(false);
  });

  test("sem foto local não há o que salvar", () => {
    expect(deveSalvarFoto({ ...base, fotoLocal: null })).toBe(false);
  });
});
