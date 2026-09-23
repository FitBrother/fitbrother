import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname, type Href } from "expo-router";
import { useWindowDimensions } from "react-native";
import { patchAccountSettings } from "@/lib/api/account";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { useProfile, useProfileActions } from "@/lib/profile/profile-context";
import {
  SHORTCUT_STEP_ID,
  tourLayout,
  visibleSteps,
  type TourScreen,
  type TourStepId,
} from "./steps";

export type Rect = { x: number; y: number; width: number; height: number };

type ContextValue = {
  active: boolean;
  currentStepId: TourStepId | null;
  targets: Partial<Record<TourStepId, Rect>>;
  registerTarget: (id: TourStepId, rect: Rect | null) => void;
  startTour: () => void;
  next: () => void;
  skip: () => void;
  notifyMealCreated: () => void;
};

const TourContext = createContext<ContextValue | null>(null);

/** Alvo não registra a tempo (ex.: navegação lenta pro Perfil) — avança
 * sozinho em vez de travar o véu sem recorte. */
const TARGET_TIMEOUT_MS = 2000;

/** Onde cada tela do roteiro mora: `pathname` como o `usePathname` devolve e
 * `href` pra navegar. */
const SCREEN_ROUTE: Record<TourScreen, { pathname: string; href: Href }> = {
  home: { pathname: "/", href: "/(app)" },
  history: { pathname: "/history", href: "/(app)/history" },
  profile: { pathname: "/profile", href: "/(app)/profile" },
  goals: { pathname: "/goals", href: "/(app)/goals" },
  feed: { pathname: "/feed", href: "/(app)/feed" },
  insights: { pathname: "/insights", href: "/(app)/insights" },
};

export function TourProvider({ children }: { children: ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targets, setTargets] = useState<Partial<Record<TourStepId, Rect>>>({});
  const profile = useProfile();
  const { update } = useProfileActions();
  const install = useInstallPrompt();
  const router = useRouter();
  const pathname = usePathname();
  // Lido via ref no finish: se o pathname entrasse nas deps, cada troca de
  // rota geraria um valor de contexto novo e re-renderizaria a Home no meio
  // da transição de tela.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { width } = useWindowDimensions();

  const steps = visibleSteps(install.status, tourLayout(width));
  const currentStepId = stepIndex !== null ? (steps[stepIndex]?.id ?? null) : null;

  const finish = useCallback(() => {
    setStepIndex(null);
    setTargets({});
    // Termina sempre na Home (spec: "Ao terminar, o app volta para a Home").
    if (pathnameRef.current !== "/") router.dismissTo("/(app)");
    void patchAccountSettings({ tutorial_completed: true })
      .then((result) => update(result.settings))
      .catch(() => {
        // Best-effort, sem retry bloqueante — ver spec, "Tratamento de
        // erros". Se falhar, tutorial_completed_at continua null no client,
        // e o tour dispara de novo no próximo primeiro-registro, o que é
        // aceitável.
      });
  }, [update, router]);

  const next = useCallback(() => {
    setStepIndex((current) => {
      if (current === null) return current;
      if (current >= steps.length - 1) {
        finish();
        return null;
      }
      return current + 1;
    });
  }, [steps.length, finish]);

  // Índice do atalho no roteiro atual (-1 quando não há) — número, não o
  // array `steps`, pra `skip` manter a identidade entre renders.
  const shortcutIndex = steps.findIndex((s) => s.id === SHORTCUT_STEP_ID);

  const skip = useCallback(() => {
    if (stepIndex === null) return;
    // Pular antes do atalho leva a ele (o tour sempre oferece a instalação);
    // no atalho, ou sem atalho, encerra.
    if (shortcutIndex !== -1 && stepIndex < shortcutIndex) {
      setStepIndex(shortcutIndex);
      return;
    }
    finish();
  }, [stepIndex, shortcutIndex, finish]);

  const startTour = useCallback(() => {
    if (stepIndex !== null) return;
    setTargets({});
    setStepIndex(0);
  }, [stepIndex]);

  const notifyMealCreated = useCallback(() => {
    if (profile.tutorial_completed_at !== null) return;
    startTour();
  }, [profile.tutorial_completed_at, startTour]);

  const registerTarget = useCallback((id: TourStepId, rect: Rect | null) => {
    setTargets((current) => {
      if (rect === null) {
        if (!(id in current)) return current;
        const nextTargets = { ...current };
        delete nextTargets[id];
        return nextTargets;
      }
      const prev = current[id];
      if (
        prev &&
        prev.x === rect.x &&
        prev.y === rect.y &&
        prev.width === rect.width &&
        prev.height === rect.height
      ) {
        return current;
      }
      return { ...current, [id]: rect };
    });
  }, []);

  // Leva o usuário pra tela do passo atual (inclui o replay a partir de
  // Configurações: o passo 1 é da Home) — ver spec, "Navegação e abas".
  // Depende da tela (string), não do array `steps` (novo a cada render), pra
  // não empurrar a mesma rota de novo enquanto a navegação ainda está em voo.
  const currentScreen = stepIndex !== null ? steps[stepIndex]?.screen : undefined;
  useEffect(() => {
    if (!currentScreen) return;
    const route = SCREEN_ROUTE[currentScreen];
    if (pathname === route.pathname) return;
    if (currentScreen === "home") router.dismissTo(route.href);
    else router.push(route.href);
  }, [currentScreen, pathname, router]);

  // Rede de segurança: se o alvo do passo atual não registrar a tempo,
  // avança sozinho em vez de travar o véu sem recorte.
  useEffect(() => {
    if (stepIndex === null || currentStepId === null) return;
    if (targets[currentStepId]) return;
    const timeout = setTimeout(() => next(), TARGET_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [stepIndex, currentStepId, targets, next]);

  const value = useMemo(
    () => ({
      active: stepIndex !== null,
      currentStepId,
      targets,
      registerTarget,
      startTour,
      next,
      skip,
      notifyMealCreated,
    }),
    [stepIndex, currentStepId, targets, registerTarget, startTour, next, skip, notifyMealCreated],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): ContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour called outside TourProvider");
  return ctx;
}
