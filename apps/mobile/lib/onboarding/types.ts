import type { ComponentType } from "react";

export type OnboardingBlockProps = {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
};

export type OnboardingBlockDef = {
  id: string;
  Component: ComponentType<OnboardingBlockProps>;
  skippable?: boolean;
};
