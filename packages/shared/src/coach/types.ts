import type { Goal } from "../targets/types.js";

export type CoachContext = {
  objetivo: Goal;
  metas?: { kcal: number; prot: number; carb: number; gord: number };
  restricoes: string[];
  odeia?: string;
  barreira_principal?: string;
  come_fora?: string;
  treino?: { dias_semana: number; forca: boolean };
  modo_suave: boolean;
  consumido_hoje?: { kcal: number; prot: number; carb: number; gord: number };
};

export type CoachContextInput = {
  goal: Goal;
  soft_mode: boolean;
  current_goals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  onboarding_context: Record<string, unknown>;
  training_days_per_week: number | null;
  strength_training: boolean | null;
  today_consumption: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
};
