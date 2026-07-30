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
  setResult: (result: OnboardingResult) => void;
}

export const useOnboardingResultStore = create<OnboardingResultState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
