import type { TargetsInput } from "@fitbrother/shared";
import { create } from "zustand";

type OnboardingResult = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  blocked: boolean;
  block_reason: string | null;
  soft_mode: boolean;
} | null;

interface OnboardingResultState {
  result: OnboardingResult;
  // Input usado pra gerar `result` — guardado pra RevealBlock poder
  // rechamar computeTargets() com protein_g_override sem reconstruir tudo.
  targetsInput: TargetsInput | null;
  setResult: (result: OnboardingResult, targetsInput: TargetsInput) => void;
}

export const useOnboardingResultStore = create<OnboardingResultState>((set) => ({
  result: null,
  targetsInput: null,
  setResult: (result, targetsInput) => set({ result, targetsInput }),
}));
