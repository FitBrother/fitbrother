import type { CoachContext, CoachContextInput } from "./types.js";

const BARRIER_TONE: Record<string, string> = {
  "Falta de tempo": "sugestões executáveis em <10 min",
  "Fins de semana": "antecipar, dar folga planejada, não punir retroativamente",
  "Ansiedade / comer emocional": 'nunca moralizar comida; sem "bom/ruim"',
  "Desisto rápido": "reforçar consistência acima de precisão",
  "Não sei o que comer": "sempre terminar com uma sugestão concreta",
  "Comer fora com frequência":
    "sugerir versões mais equilibradas de pratos comuns em restaurante/delivery, nunca como proibição de comer fora",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const restricoes = asStringArray(input.onboarding_context.dietary_restrictions).filter(
    (r) => r !== "Nenhuma",
  );
  const barreira_principal = asStringArray(input.onboarding_context.main_barriers)[0];
  const odeia = asString(input.onboarding_context.disliked_foods);
  const come_fora = asString(input.onboarding_context.eats_out_frequency);

  const treino =
    input.training_days_per_week !== null || input.strength_training !== null
      ? {
          dias_semana: input.training_days_per_week ?? 0,
          forca: input.strength_training ?? false,
        }
      : undefined;

  const context: CoachContext = {
    objetivo: input.goal,
    restricoes,
    modo_suave: input.soft_mode,
    ...(barreira_principal !== undefined ? { barreira_principal } : {}),
    ...(odeia !== undefined ? { odeia } : {}),
    ...(come_fora !== undefined ? { come_fora } : {}),
    ...(treino !== undefined ? { treino } : {}),
  };

  if (!input.soft_mode) {
    if (input.current_goals) {
      context.metas = {
        kcal: input.current_goals.kcal,
        prot: input.current_goals.protein_g,
        carb: input.current_goals.carbs_g,
        gord: input.current_goals.fat_g,
      };
    }
    if (input.today_consumption) {
      context.consumido_hoje = {
        kcal: input.today_consumption.kcal,
        prot: input.today_consumption.protein_g,
        carb: input.today_consumption.carbs_g,
        gord: input.today_consumption.fat_g,
      };
    }
  }

  return context;
}

export function coachContextToneInstruction(ctx: CoachContext): string {
  if (!ctx.barreira_principal) return "";
  return BARRIER_TONE[ctx.barreira_principal] ?? "";
}
