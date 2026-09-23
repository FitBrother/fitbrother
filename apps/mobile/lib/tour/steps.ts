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
  /** `tap`: o usuário toca no próprio item destacado pra avançar (o tour
   * captura o toque — ver spec). `next`: botão "Próximo". */
  action: "tap" | "next";
};

export const TOUR_STEPS: TourStep[] = [
  { id: "home-tab", copy: "Aqui você vê seu resumo do dia.", screen: "home", action: "next" },
  {
    id: "social-tab",
    copy: "Toque em Social para ver o progresso dos seus amigos.",
    screen: "home",
    action: "tap",
  },
  {
    id: "analises-tab",
    copy: "Toque em Análises para ver os gráficos da sua evolução.",
    screen: "home",
    action: "tap",
  },
  {
    id: "composer-plus",
    copy: "Toque no + para registrar por foto ou código de barras.",
    screen: "home",
    action: "tap",
  },
  {
    id: "streak",
    copy: "Sua ofensiva: dias seguidos registrando. Toque para ver seu histórico.",
    screen: "home",
    action: "tap",
  },
  {
    id: "history-day",
    copy: "Cada dia registrado fica aqui, com seus totais.",
    screen: "history",
    action: "next",
  },
  {
    id: "home-avatar",
    copy: "Toque na sua foto para abrir o perfil.",
    screen: "home",
    action: "tap",
  },
  {
    id: "profile-shortcut-card",
    copy: "Adicione o Fitbrother à tela inicial.",
    screen: "profile",
    action: "next",
  },
  {
    id: "profile-goals",
    copy: "Toque em Metas e macros para ajustar suas metas.",
    screen: "profile",
    action: "tap",
  },
  {
    id: "goals-editor",
    copy: "Aqui você ajusta calorias, macros e seus dados do corpo manualmente.",
    screen: "goals",
    action: "next",
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
