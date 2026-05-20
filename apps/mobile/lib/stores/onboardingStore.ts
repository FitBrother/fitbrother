import type {
  ActivityLevelSchema,
  GoalSchema,
  OnboardingPayload,
  SexSchema,
} from "@fitbrother/shared";
import { create } from "zustand";
import type { z } from "zod";

type Sex = z.infer<typeof SexSchema>;
type ActivityLevel = z.infer<typeof ActivityLevelSchema>;
type Goal = z.infer<typeof GoalSchema>;

interface OnboardingState {
  full_name: string;
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

  setField: <
    K extends keyof Omit<OnboardingState, "setField" | "setConsent" | "reset" | "toPayload">,
  >(
    key: K,
    value: OnboardingState[K],
  ) => void;
  setConsent: (scope: keyof OnboardingState["consents"], granted: boolean) => void;
  reset: () => void;
  toPayload: () => OnboardingPayload | null;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const INITIAL: Omit<OnboardingState, "setField" | "setConsent" | "reset" | "toPayload"> = {
  full_name: "",
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
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...INITIAL,

  setField: (key, value) => set({ [key]: value } as Partial<OnboardingState>),

  setConsent: (scope, granted) => set((s) => ({ consents: { ...s.consents, [scope]: granted } })),

  reset: () => set({ ...INITIAL, timezone: detectTimezone() }),

  toPayload: () => {
    const s = get();
    if (
      !s.full_name ||
      !s.birth_date ||
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
      full_name: s.full_name,
      phone_e164: s.phone_e164 || undefined,
      birth_date: s.birth_date,
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
        policy_version: "v1.0",
      },
    };
  },
}));
