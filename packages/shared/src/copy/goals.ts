/**
 * Copy de metas/calorias do app — fonte única.
 *
 * No Brasil, prescrição de plano alimentar é atividade privativa de
 * nutricionista/médico (não é aconselhamento jurídico — ver
 * docs/superpowers/specs/2026-07-14-onboarding-spec-original.md Fase 6).
 * `LEGAL_BLOCKLIST` é verificado em CI por `scripts/check-legal-copy.ts`:
 * nenhum termo abaixo pode aparecer em `apps/mobile` fora deste arquivo.
 */

export const LEGAL_BLOCKLIST = [
  "prescrição",
  "sua dieta",
  "plano alimentar prescrito",
  "recomendação médica",
] as const;

/** Termos preferidos ao escrever copy nova sobre metas/calorias (guia de redação, não verificado por lint). */
export const ALLOWED_GOAL_TERMS = [
  "metas estimadas",
  "estimativa",
  "ferramenta de acompanhamento",
] as const;

export const GOALS_DISCLAIMER_TEXT =
  "Suas metas aqui são estimativas geradas por esta ferramenta de acompanhamento nutricional — não substituem uma avaliação profissional. Consulte um nutricionista ou médico para orientação individualizada.";
