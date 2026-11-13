import { describe, expect, test } from "@jest/globals";
import { presetPorId, presetsDoStory, STORY_PRESETS } from "./story-presets";

const ids = (a: { temFoto: boolean; temMacros: boolean }) => presetsDoStory(a).map((p) => p.id);

describe("presetsDoStory", () => {
  test("com foto e macros", () => {
    expect(ids({ temFoto: true, temMacros: true })).toEqual(["completo", "etiqueta", "discreto"]);
  });

  test("com foto, sem macros", () => {
    expect(ids({ temFoto: true, temMacros: false })).toEqual(["completo"]);
  });

  test("sem foto", () => {
    expect(ids({ temFoto: false, temMacros: true })).toEqual(["poster", "completo"]);
    expect(ids({ temFoto: false, temMacros: false })).toEqual(["poster", "completo"]);
  });
});

describe("STORY_PRESETS", () => {
  test("nenhum preset define fundo: o gradiente colorido acabou", () => {
    for (const p of STORY_PRESETS) expect(p).not.toHaveProperty("background");
  });

  test("a vinheta vem ligada, menos na Etiqueta", () => {
    expect(STORY_PRESETS.filter((p) => !p.vinheta).map((p) => p.id)).toEqual(["etiqueta"]);
  });

  test("presetPorId acha cada um", () => {
    for (const p of STORY_PRESETS) expect(presetPorId(p.id)).toBe(p);
  });
});
