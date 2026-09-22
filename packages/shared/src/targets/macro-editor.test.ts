import { describe, expect, it } from "vitest";
import {
  editableRange,
  macroKcal,
  macrosMatchKcal,
  redistributeMacro,
  scaleMacrosToKcal,
  type MacroPctBounds,
} from "./macro-editor.js";

const BOUNDS: MacroPctBounds = {
  protein_g: [10, 45],
  carbs_g: [5, 65],
  fat_g: [15, 45],
};

const BASE = { protein_g: 168, carbs_g: 252, fat_g: 80 }; // 2400 kcal (28/42/30%)

describe("macroKcal", () => {
  it("soma 4P + 4C + 9G", () => {
    expect(macroKcal(BASE)).toBeCloseTo(2400, 0);
  });
});

describe("scaleMacrosToKcal", () => {
  it("mantém o % de cada macro ao mudar as calorias totais", () => {
    const next = scaleMacrosToKcal(BASE, 3000);
    expect(macroKcal(next)).toBeCloseTo(3000, 0);
    const pctBefore = (BASE.protein_g * 4) / macroKcal(BASE);
    const pctAfter = (next.protein_g * 4) / macroKcal(next);
    expect(pctAfter).toBeCloseTo(pctBefore, 5);
  });
});

describe("redistributeMacro", () => {
  it("editar um macro mantém a caloria total e redistribui os outros dois", () => {
    const next = redistributeMacro(BASE, "protein_g", 220);
    expect(next.protein_g).toBeCloseTo(220, 5);
    expect(macroKcal(next)).toBeCloseTo(macroKcal(BASE), 0);
    // carbo/gordura mantêm a proporção que tinham entre si
    const ratioBefore = BASE.carbs_g / BASE.fat_g;
    const ratioAfter = next.carbs_g / next.fat_g;
    expect(ratioAfter).toBeCloseTo(ratioBefore, 5);
  });

  it("nunca deixa o macro editado exceder o orçamento calórico total", () => {
    const next = redistributeMacro(BASE, "protein_g", 10_000);
    expect(macroKcal(next)).toBeCloseTo(macroKcal(BASE), 0);
    expect(next.carbs_g).toBeGreaterThanOrEqual(0);
    expect(next.fat_g).toBeGreaterThanOrEqual(0);
  });
});

describe("editableRange", () => {
  it("devolve a faixa própria inteira quando os outros dois têm folga de sobra", () => {
    const range = editableRange(BASE, "fat_g", BOUNDS, 2400);
    // BASE já respeita os bounds e a razão protein:carbs é folgada o
    // suficiente pra gordura poder ocupar toda a própria faixa (15–45%).
    expect(range.minGrams).toBeCloseTo((0.15 * 2400) / 9, 3);
    expect(range.maxGrams).toBeCloseTo((0.45 * 2400) / 9, 3);
  });

  it("aperta o piso da gordura quando zerá-la estouraria o teto do carboidrato", () => {
    // proteína no piso (10%), gordura no teto (45%), carbo no meio (45%) —
    // zerar a gordura ingenuamente jogaria ~69% pro carbo (teto é 65%).
    const kcalTotal = 2000;
    const macros = {
      protein_g: (0.1 * kcalTotal) / 4,
      carbs_g: (0.45 * kcalTotal) / 4,
      fat_g: (0.45 * kcalTotal) / 9,
    };
    const range = editableRange(macros, "fat_g", BOUNDS, kcalTotal);

    // Não pode ir a 15% (o piso "nu" do próprio macro) — precisa ficar acima
    // disso pra não estourar o teto do carboidrato.
    expect(range.minGrams).toBeGreaterThan((0.15 * kcalTotal) / 9);

    // No piso computado, redistribuir confirma que ninguém estoura a faixa.
    const atFloor = redistributeMacro(macros, "fat_g", range.minGrams);
    const carbsPct = (atFloor.carbs_g * 4) / kcalTotal;
    const proteinPct = (atFloor.protein_g * 4) / kcalTotal;
    expect(carbsPct).toBeLessThanOrEqual(0.65 + 1e-9);
    expect(proteinPct).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });

  it("nunca devolve max < min mesmo com faixas conflitantes", () => {
    const impossible: MacroPctBounds = {
      protein_g: [40, 45],
      carbs_g: [40, 45],
      fat_g: [40, 45], // soma dos mínimos > 100% — não tem solução exata
    };
    const range = editableRange(BASE, "fat_g", impossible, 2400);
    expect(range.maxGrams).toBeGreaterThanOrEqual(range.minGrams);
  });
});

describe("macrosMatchKcal", () => {
  it("aceita macros consistentes com a caloria declarada", () => {
    expect(macrosMatchKcal(BASE, 2400)).toBe(true);
  });

  it("rejeita macros que implicam uma caloria muito diferente da declarada", () => {
    expect(macrosMatchKcal(BASE, 1200)).toBe(false);
  });
});
