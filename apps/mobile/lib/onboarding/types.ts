import type { ComponentType } from "react";

export type OnboardingBlockProps = {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  /** Presente só nos blocos da Fase A (capítulos 1-3) — dirige o painel
   * lateral e a barra de progresso segmentada do OnboardingChapterShell. */
  chapter?: { num: 1 | 2 | 3; name: string };
};

export type OnboardingBlockDef = {
  id: string;
  Component: ComponentType<OnboardingBlockProps>;
  skippable?: boolean;
  /** undefined = bloco de Fase B/C: sem painel lateral, sem progresso segmentado. */
  chapter?: 1 | 2 | 3;
};

export const CHAPTER_NAMES: Record<1 | 2 | 3, string> = {
  1: "Você",
  2: "Objetivo",
  3: "Metas",
};

export const CHAPTER_TOTAL = 3;
