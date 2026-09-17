import type { InstallPromptState } from "@/lib/hooks/useInstallPrompt";

export type TourStepId =
  | "home-tab"
  | "social-tab"
  | "analises-tab"
  | "profile-avatar"
  | "profile-shortcut-card";

export type TourStep = {
  id: TourStepId;
  copy: string;
  screen: "home" | "profile";
};

export const TOUR_STEPS: TourStep[] = [
  { id: "home-tab", copy: "Aqui você vê seu resumo do dia.", screen: "home" },
  { id: "social-tab", copy: "Veja o progresso dos seus amigos.", screen: "home" },
  { id: "analises-tab", copy: "Gráficos da sua evolução.", screen: "home" },
  { id: "profile-avatar", copy: "Seu perfil e configurações ficam aqui.", screen: "profile" },
  {
    id: "profile-shortcut-card",
    copy: "Adicione o Fitbrother à tela inicial.",
    screen: "profile",
  },
];

const SHORTCUT_SKIPPED_STATUSES: ReadonlyArray<InstallPromptState["status"]> = [
  "native",
  "installed",
  "unsupported",
];

/**
 * O passo do atalho só entra quando `useInstallPrompt` tem algo pra mostrar —
 * mesmos status em que `InstallPrompt.tsx` já retorna `null`.
 */
export function visibleSteps(installStatus: InstallPromptState["status"]): TourStep[] {
  if (SHORTCUT_SKIPPED_STATUSES.includes(installStatus)) {
    return TOUR_STEPS.filter((step) => step.id !== "profile-shortcut-card");
  }
  return TOUR_STEPS;
}
