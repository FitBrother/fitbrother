import { describe, expect, it } from "vitest";
import { buildCoachContext, coachContextToneInstruction } from "./build-coach-context.js";
import type { CoachContextInput } from "./types.js";

const BASE_INPUT: CoachContextInput = {
  goal: "lose",
  soft_mode: false,
  current_goals: { kcal: 1850, protein_g: 140, carbs_g: 180, fat_g: 55 },
  onboarding_context: {},
  training_days_per_week: null,
  strength_training: null,
  today_consumption: { kcal: 1200, protein_g: 95, carbs_g: 110, fat_g: 40 },
};

describe("buildCoachContext", () => {
  it("omite metas e consumido_hoje quando soft_mode é true", () => {
    const ctx = buildCoachContext({ ...BASE_INPUT, soft_mode: true });
    expect(ctx.modo_suave).toBe(true);
    expect("metas" in ctx).toBe(false);
    expect("consumido_hoje" in ctx).toBe(false);
  });

  it("inclui metas e consumido_hoje quando soft_mode é false", () => {
    const ctx = buildCoachContext(BASE_INPUT);
    expect(ctx.metas).toEqual({ kcal: 1850, prot: 140, carb: 180, gord: 55 });
    expect(ctx.consumido_hoje).toEqual({ kcal: 1200, prot: 95, carb: 110, gord: 40 });
  });

  it("filtra 'Nenhuma' da lista de restrições", () => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { dietary_restrictions: ["Sem lactose", "Nenhuma"] },
    });
    expect(ctx.restricoes).toEqual(["Sem lactose"]);
  });

  it("barreira_principal fica ausente quando main_barriers está vazio", () => {
    const ctx = buildCoachContext({ ...BASE_INPUT, onboarding_context: { main_barriers: [] } });
    expect(ctx.barreira_principal).toBeUndefined();
  });

  it("barreira_principal é o primeiro item de main_barriers", () => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { main_barriers: ["Fins de semana", "Falta de tempo"] },
    });
    expect(ctx.barreira_principal).toBe("Fins de semana");
  });

  it("treino fica ausente quando training_days_per_week e strength_training são null", () => {
    const ctx = buildCoachContext(BASE_INPUT);
    expect(ctx.treino).toBeUndefined();
  });

  it("treino usa default 0/false pro campo que estiver null", () => {
    const ctx = buildCoachContext({ ...BASE_INPUT, strength_training: true });
    expect(ctx.treino).toEqual({ dias_semana: 0, forca: true });
  });
});

describe("coachContextToneInstruction", () => {
  const CASES: Array<[string, string]> = [
    ["Falta de tempo", "sugestões executáveis em <10 min"],
    ["Fins de semana", "antecipar, dar folga planejada, não punir retroativamente"],
    ["Ansiedade / comer emocional", 'nunca moralizar comida; sem "bom/ruim"'],
    ["Desisto rápido", "reforçar consistência acima de precisão"],
    ["Não sei o que comer", "sempre terminar com uma sugestão concreta"],
    [
      "Comer fora com frequência",
      "sugerir versões mais equilibradas de pratos comuns em restaurante/delivery, nunca como proibição de comer fora",
    ],
  ];

  it.each(CASES)("retorna a instrução certa pra '%s'", (barreira, esperado) => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { main_barriers: [barreira] },
    });
    expect(coachContextToneInstruction(ctx)).toBe(esperado);
  });

  it("retorna string vazia quando barreira_principal está ausente", () => {
    const ctx = buildCoachContext(BASE_INPUT);
    expect(coachContextToneInstruction(ctx)).toBe("");
  });

  it("retorna string vazia pra barreira não reconhecida", () => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { main_barriers: ["Barreira inventada"] },
    });
    expect(coachContextToneInstruction(ctx)).toBe("");
  });
});
