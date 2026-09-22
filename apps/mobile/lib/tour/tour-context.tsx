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
import { useRouter, usePathname } from "expo-router";
import { useWindowDimensions } from "react-native";
import { patchAccountSettings } from "@/lib/api/account";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { useProfile, useProfileActions } from "@/lib/profile/profile-context";
import { visibleSteps, type TourStepId } from "./steps";

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

/**
 * A partir daqui a navegação principal é a `Sidebar`, não a barra de abas do
 * `HomeHeader` — o tour foi pedido "para mobile" (ver spec) e não tem alvo
 * nenhum pra apontar nesse layout.
 */
const DESKTOP_MIN_WIDTH = 1024;

/** Alvo não registra a tempo (ex.: navegação lenta pro Perfil) — avança
 * sozinho em vez de travar o véu sem recorte. */
const TARGET_TIMEOUT_MS = 2000;

export function TourProvider({ children }: { children: ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targets, setTargets] = useState<Partial<Record<TourStepId, Rect>>>({});
  const profile = useProfile();
  const { update } = useProfileActions();
  const install = useInstallPrompt();
  const router = useRouter();
  const pathname = usePathname();
  // Lido via ref no startTour: se o pathname entrasse nas deps, cada troca de
  // rota geraria um valor de contexto novo e re-renderizaria a Home no meio
  // da transição de tela.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { width } = useWindowDimensions();

  const steps = visibleSteps(install.status);
  const currentStepId = stepIndex !== null ? (steps[stepIndex]?.id ?? null) : null;

  const finish = useCallback(() => {
    setStepIndex(null);
    setTargets({});
    void patchAccountSettings({ tutorial_completed: true })
      .then((result) => update(result.settings))
      .catch(() => {
        // Best-effort, sem retry bloqueante — ver spec, "Tratamento de
        // erros". Se falhar, tutorial_completed_at continua null no client,
        // e o tour dispara de novo no próximo primeiro-registro, o que é
        // aceitável.
      });
  }, [update]);

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

  const skip = useCallback(() => {
    if (stepIndex === null) return;
    finish();
  }, [stepIndex, finish]);

  const startTour = useCallback(() => {
    if (stepIndex !== null) return;
    if (width >= DESKTOP_MIN_WIDTH) return;
    // Replay a partir de Configurações/Perfil: volta pra Home (desempilhando
    // o que estiver por cima) antes de armar o passo 1 — ver spec.
    if (pathnameRef.current !== "/") router.dismissTo("/(app)");
    setTargets({});
    setStepIndex(0);
  }, [stepIndex, width, router]);

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

  // Navega pro Perfil assim que o passo atual pede uma tela que não é a Home
  // — ver spec, "Fluxo de dados e coordenação com navegação".
  useEffect(() => {
    if (stepIndex === null) return;
    const step = steps[stepIndex];
    if (!step) return;
    if (step.screen === "profile" && pathname !== "/profile") {
      router.push("/(app)/profile");
    }
  }, [stepIndex, steps, pathname, router]);

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
