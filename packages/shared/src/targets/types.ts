export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export type TargetsInput = {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  // % de gordura corporal (0-100) — usado pra calcular proteína sobre massa
  // magra em vez de peso total. Sempre coletado no onboarding (obrigatório).
  body_fat_pct: number;
  // Opcionais — ausentes = gate/ajuste correspondente não dispara.
  target_weight_kg?: number;
  rate_kg_per_week?: number;
  // Sobrescreve o protein_g calculado (clampado a 1.2-3.0 g/kg de massa
  // magra dentro de computeTargets) — ajuste manual na tela de revelação.
  protein_g_override?: number;
  strength_training?: boolean;
  is_pregnant_or_lactating?: boolean;
  has_kidney_disease?: boolean;
  has_type1_diabetes?: boolean;
  uses_glp1?: boolean;
};

export type WarningCode =
  | "rate_clamped"
  | "deficit_clamped"
  | "surplus_clamped"
  | "below_bmr"
  | "hard_floor"
  | "low_carb"
  | "very_low_carb";

export type Warning = { code: WarningCode; message: string };

export type Targets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  bmr_kcal: number;
  tdee_kcal: number;
  tdee_source: "declared";
  projected_rate_kg_per_week: number;
  warnings: Warning[];
  blocked: boolean;
  block_reason: string | null;
};

export type GateSeverity = "BLOCK" | "SOFT_MODE" | "REFER" | "WARN";

export type GateResult = {
  condition: string;
  severity: GateSeverity;
  message: string;
};
