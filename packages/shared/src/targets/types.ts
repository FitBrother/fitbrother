export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain" | "recomp";

export type TargetsInput = {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  // Opcionais — sem UI própria até o M16. Ausentes = gate correspondente não dispara.
  target_weight_kg?: number;
  rate_kg_per_week?: number;
  strength_training?: boolean;
  is_pregnant_or_lactating?: boolean;
  has_kidney_disease?: boolean;
  has_type1_diabetes?: boolean;
  uses_glp1?: boolean;
  tca_screening_positive?: boolean;
};

export type WarningCode =
  | "rate_clamped"
  | "deficit_clamped"
  | "surplus_clamped"
  | "below_bmr"
  | "hard_floor"
  | "low_carb"
  | "very_low_carb"
  | "protein_on_current_weight_imc_over_30";

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
