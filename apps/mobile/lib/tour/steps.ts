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

export type TourScreen = "home" | "history" | "profile" | "goals" | "feed" | "insights";

export type TourLayout = "compact" | "desktop";

/** A partir daqui a navegação é a Sidebar (mesmo corte do `isDesktop` da Home
 * e do `lg` da Sidebar) e os passos usam a variante `desktop`. */
export const DESKTOP_MIN_WIDTH = 1024;

export function tourLayout(width: number): TourLayout {
  return width >= DESKTOP_MIN_WIDTH ? "desktop" : "compact";
}

export type TourStep = {
  id: TourStepId;
  copy: string;
  screen: TourScreen;
  /** Diferenças no layout desktop do web — ver spec do tour web. */
  desktop?: { screen?: TourScreen; copy?: string };
};

export const TOUR_STEPS: TourStep[] = [
  { id: "home-tab", copy: "Aqui você vê seu resumo do dia.", screen: "home" },
  {
    id: "social-tab",
    copy: "Veja o progresso dos seus amigos.",
    screen: "home",
    desktop: { screen: "feed" },
  },
  {
    id: "analises-tab",
    copy: "Gráficos da sua evolução.",
    screen: "home",
    desktop: { screen: "insights" },
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
    desktop: {
      copy: "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu.",
    },
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
    desktop: { copy: "Aqui você abre seu perfil e suas configurações." },
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
 * mesmos status em que `InstallPrompt.tsx` já retorna `null`. No layout
 * desktop, aplica a variante `desktop` de cada passo.
 */
export function visibleSteps(
  installStatus: InstallPromptState["status"],
  layout: TourLayout = "compact",
): TourStep[] {
  const steps = SHORTCUT_SKIPPED_STATUSES.includes(installStatus)
    ? TOUR_STEPS.filter((step) => step.id !== "profile-shortcut-card")
    : TOUR_STEPS;
  if (layout === "compact") return steps;
  return steps.map(({ desktop, ...step }) => ({ ...step, ...desktop }));
}
