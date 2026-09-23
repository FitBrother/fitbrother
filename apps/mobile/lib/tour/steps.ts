import type { InstallPromptState } from "@/lib/hooks/useInstallPrompt";

export type TourStepId =
  | "home-tab"
  | "social-tab"
  | "analises-tab"
  | "composer-plus"
  | "streak"
  | "history-day"
  | "home-avatar"
  | "profile-shortcut-card"
  | "profile-goals"
  | "goals-editor";

export type TourScreen = "home" | "history" | "profile" | "goals";

export type TourStep = {
  id: TourStepId;
  copy: string;
  screen: TourScreen;
};

export const TOUR_STEPS: TourStep[] = [
  { id: "home-tab", copy: "Aqui você vê seu resumo do dia.", screen: "home" },
  {
    id: "social-tab",
    copy: "Veja o progresso dos seus amigos.",
    screen: "home",
  },
  {
    id: "analises-tab",
    copy: "Gráficos da sua evolução.",
    screen: "home",
  },
  {
    id: "composer-plus",
    copy: "No + você registra por foto ou código de barras.",
    screen: "home",
  },
  {
    id: "streak",
    copy: "Sua ofensiva: dias seguidos registrando. Tocando nela você vê seu histórico.",
    screen: "home",
  },
  {
    id: "history-day",
    copy: "Cada dia registrado fica aqui, com seus totais.",
    screen: "history",
  },
  {
    id: "home-avatar",
    copy: "Na sua foto você abre seu perfil e suas configurações.",
    screen: "home",
  },
  {
    id: "profile-shortcut-card",
    copy: "Adicione o Fitbrother à tela inicial.",
    screen: "profile",
  },
  {
    id: "profile-goals",
    copy: "Em Metas e macros você ajusta suas metas.",
    screen: "profile",
  },
  {
    id: "goals-editor",
    copy: "Aqui você ajusta calorias, macros e seus dados do corpo manualmente.",
    screen: "goals",
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
