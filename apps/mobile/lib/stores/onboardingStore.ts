import type {
  ActivityLevelSchema,
  GoalSchema,
  OnboardingPayload,
  SexSchema,
} from "@fitbrother/shared";
import { create } from "zustand";
import type { z } from "zod";
import { POLICY_VERSION } from "@/lib/constants";
import { brDateToIso } from "@/lib/masks";

type Sex = z.infer<typeof SexSchema>;
type ActivityLevel = z.infer<typeof ActivityLevelSchema>;
type Goal = z.infer<typeof GoalSchema>;

interface OnboardingState {
  full_name: string;
  username: string;
  avatar_url: string | undefined;
  phone_e164: string;
  birth_date: string;
  sex: Sex | undefined;
  weight_kg: number | undefined;
  height_cm: number | undefined;
  activity_level: ActivityLevel | undefined;
  goal: Goal | undefined;
  timezone: string;
  day_start_hour: number;
  locale: string;
  consents: {
    terms: boolean;
    privacy: boolean;
    ai_processing: boolean;
  };
  target_weight_kg: number | undefined;
  rate_kg_per_week: number | undefined;
  strength_training: boolean;
  training_days_per_week: number | undefined;
  main_barriers: string[];
  dietary_restrictions: string[];
  disliked_foods: string;
  budget: string | undefined;
  meal_times: string;
  cooks_own_food: string | undefined;
  eats_out_frequency: string | undefined;
  is_pregnant_or_lactating: boolean;
  has_kidney_disease: boolean;
  has_type1_diabetes: boolean;
  uses_glp1: boolean;
  tca_screening_positive: boolean;

  setField: <
    K extends keyof Omit<
      OnboardingState,
      "setField" | "setConsent" | "reset" | "toPayload" | "toAnswers" | "hydrate"
    >,
  >(
    key: K,
    value: OnboardingState[K],
  ) => void;
  setConsent: (scope: keyof OnboardingState["consents"], granted: boolean) => void;
  reset: () => void;
  toPayload: () => OnboardingPayload | null;
  toAnswers: () => Record<string, unknown>;
  hydrate: (answers: Record<string, unknown>) => void;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const INITIAL: Omit<
  OnboardingState,
  "setField" | "setConsent" | "reset" | "toPayload" | "toAnswers" | "hydrate"
> = {
  full_name: "",
  username: "",
  avatar_url: undefined,
  phone_e164: "",
  birth_date: "",
  sex: undefined,
  weight_kg: undefined,
  height_cm: undefined,
  activity_level: undefined,
  goal: undefined,
  timezone: detectTimezone(),
  day_start_hour: 0,
  locale: "pt-BR",
  consents: { terms: false, privacy: false, ai_processing: false },
  target_weight_kg: undefined,
  rate_kg_per_week: undefined,
  strength_training: false,
  training_days_per_week: undefined,
  main_barriers: [],
  dietary_restrictions: [],
  disliked_foods: "",
  budget: undefined,
  meal_times: "",
  cooks_own_food: undefined,
  eats_out_frequency: undefined,
  is_pregnant_or_lactating: false,
  has_kidney_disease: false,
  has_type1_diabetes: false,
  uses_glp1: false,
  tca_screening_positive: false,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...INITIAL,

  setField: (key, value) => set({ [key]: value } as Partial<OnboardingState>),

  setConsent: (scope, granted) => set((s) => ({ consents: { ...s.consents, [scope]: granted } })),

  reset: () => set({ ...INITIAL, timezone: detectTimezone() }),

  toAnswers: () => {
    const s = get();
    return {
      full_name: s.full_name,
      username: s.username,
      avatar_url: s.avatar_url,
      phone_e164: s.phone_e164,
      birth_date: s.birth_date,
      sex: s.sex,
      weight_kg: s.weight_kg,
      height_cm: s.height_cm,
      activity_level: s.activity_level,
      goal: s.goal,
      timezone: s.timezone,
      day_start_hour: s.day_start_hour,
      locale: s.locale,
      consents: s.consents,
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      strength_training: s.strength_training,
      training_days_per_week: s.training_days_per_week,
      main_barriers: s.main_barriers,
      dietary_restrictions: s.dietary_restrictions,
      disliked_foods: s.disliked_foods,
      budget: s.budget,
      meal_times: s.meal_times,
      cooks_own_food: s.cooks_own_food,
      eats_out_frequency: s.eats_out_frequency,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
      tca_screening_positive: s.tca_screening_positive,
    };
  },

  hydrate: (answers) => set(answers as Partial<OnboardingState>),

  toPayload: () => {
    const s = get();
    const full_name = s.full_name.trim();
    const phone_e164 = s.phone_e164.trim();
    const birth_date_iso = brDateToIso(s.birth_date);
    if (
      !full_name ||
      !birth_date_iso ||
      !s.sex ||
      s.weight_kg === undefined ||
      s.height_cm === undefined ||
      !s.activity_level ||
      !s.goal ||
      !s.consents.terms ||
      !s.consents.privacy ||
      !s.consents.ai_processing
    ) {
      return null;
    }
    return {
      full_name,
      username: s.username.trim() || undefined,
      avatar_url: s.avatar_url || undefined,
      phone_e164: phone_e164 || undefined,
      birth_date: birth_date_iso,
      sex: s.sex,
      weight_kg: s.weight_kg,
      height_cm: s.height_cm,
      activity_level: s.activity_level,
      goal: s.goal,
      timezone: s.timezone,
      day_start_hour: s.day_start_hour,
      locale: s.locale,
      consents: {
        terms: true,
        privacy: true,
        ai_processing: true,
        policy_version: POLICY_VERSION,
      },
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      strength_training: s.strength_training,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
      tca_screening_positive: s.tca_screening_positive,
      onboarding_context: {
        main_barriers: s.main_barriers,
        dietary_restrictions: s.dietary_restrictions,
        disliked_foods: s.disliked_foods,
        budget: s.budget,
        meal_times: s.meal_times,
        cooks_own_food: s.cooks_own_food,
        eats_out_frequency: s.eats_out_frequency,
      },
    };
  },
}));
