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
import { Keyboard, Platform, View, type ViewProps } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { BottomDrawer } from "@/components/BottomDrawer";
import { ConfirmMealDrawer } from "@/components/domain/ConfirmMealDrawer";
import { getMeal } from "@/lib/api/meals";
import { useDialog } from "@/lib/dialog/dialog-context";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";

type SheetApi = { open: (mealId: string) => void; close: () => void };

type OpenState = { openId: string | null; session: number };

type HostState = OpenState & {
  close: () => void;
  closeIfOpen: (mealId: string) => void;
  dirtyRef: { current: boolean };
  visibleRef: { current: boolean };
  covered: boolean;
  setCovered: (covered: boolean) => void;
};

const SheetApiContext = createContext<SheetApi | null>(null);
const HostStateContext = createContext<HostState | null>(null);

export function ConfirmMealProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenState>({ openId: null, session: 0 });
  const [covered, setCovered] = useState(false);
  const dirtyRef = useRef(false);
  const visibleRef = useRef(false);

  const open = useCallback((mealId: string) => {
    setState((prev) => {
      // Never replace a shown meal: its draft and in-flight confirm belong to it.
      if (prev.openId === mealId || (prev.openId !== null && visibleRef.current)) return prev;
      dirtyRef.current = false;
      return { openId: mealId, session: prev.session + 1 };
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => (prev.openId === null ? prev : { ...prev, openId: null }));
  }, []);

  const closeIfOpen = useCallback((mealId: string) => {
    setState((prev) => (prev.openId === mealId ? { ...prev, openId: null } : prev));
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      dirtyRef.current = false;
      setState((prev) => (prev.openId === null ? prev : { ...prev, openId: null }));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const api = useMemo<SheetApi>(() => ({ open, close }), [open, close]);
  const host = useMemo<HostState>(
    () => ({ ...state, close, closeIfOpen, dirtyRef, visibleRef, covered, setCovered }),
    [state, close, closeIfOpen, covered],
  );

  return (
    <SheetApiContext.Provider value={api}>
      <HostStateContext.Provider value={host}>{children}</HostStateContext.Provider>
    </SheetApiContext.Provider>
  );
}

export function useConfirmMealSheet(): SheetApi {
  const api = useContext(SheetApiContext);
  if (!api) throw new Error("useConfirmMealSheet must be used inside ConfirmMealProvider");
  return api;
}

function useHostState(): HostState {
  const state = useContext(HostStateContext);
  if (!state) throw new Error("ConfirmMealHost must be rendered inside ConfirmMealProvider");
  return state;
}

function errorStatus(error: unknown): number | undefined {
  return error && typeof error === "object" && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

type Shown = { meal: MealResponse; session: number };

export function ConfirmMealHost() {
  const { openId, session, close, closeIfOpen, dirtyRef, visibleRef, setCovered } = useHostState();
  const dialog = useDialog();
  const toast = useToast();

  const query = useQuery({
    queryKey: mealDetailKey(openId ?? ""),
    queryFn: () => getMeal(openId!),
    enabled: openId !== null,
  });

  const data = openId !== null && query.data?.id === openId ? query.data : undefined;
  const live = data?.review_required ? data : undefined;
  const visible = live !== undefined;

  // Keeps the last meal on the panel while the exit animation runs.
  const lastShown = useRef<Shown | null>(null);
  const shown: Shown | null = live ? { meal: live, session } : lastShown.current;
  useEffect(() => {
    if (live) lastShown.current = { meal: live, session };
  });

  const confirmedElsewhere = data !== undefined && !data.review_required;
  const notFound = query.isError && errorStatus(query.error) === 404;
  const unreachable = query.isError && !notFound && data === undefined;
  useEffect(() => {
    if (openId === null || !(confirmedElsewhere || notFound || unreachable)) return;
    if (unreachable) toast({ variant: "error", message: "Não foi possível abrir a refeição" });
    closeIfOpen(openId);
  }, [openId, confirmedElsewhere, notFound, unreachable, closeIfOpen, toast]);

  useEffect(() => {
    if (!visible) return;
    Keyboard.dismiss();
    if (Platform.OS === "web") {
      const active = document.activeElement as { blur?: () => void } | null;
      active?.blur?.();
    }
  }, [visible]);

  useEffect(() => {
    visibleRef.current = visible;
    setCovered(visible);
  }, [visible, setCovered, visibleRef]);
  useEffect(
    () => () => {
      visibleRef.current = false;
      setCovered(false);
    },
    [setCovered, visibleRef],
  );

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const onDirtyChange = useCallback(
    (forSession: number) => (dirty: boolean) => {
      if (forSession === sessionRef.current) dirtyRef.current = dirty;
    },
    [dirtyRef],
  );

  const requestClose = useCallback(async () => {
    if (dirtyRef.current) {
      const discard = await dialog.confirm({
        title: "Descartar alterações?",
        description: "Você não salvou os ajustes.",
        confirmLabel: "Descartar",
        destructive: true,
      });
      if (!discard) return;
    }
    close();
  }, [dialog, close, dirtyRef]);

  if (!shown) return null;

  return (
    <BottomDrawer
      visible={visible}
      onClose={() => void requestClose()}
      accessibilityLabel="Confirme sua refeição"
    >
      <ConfirmMealDrawer
        key={shown.session}
        meal={shown.meal}
        onClose={close}
        onDirtyChange={onDirtyChange(shown.session)}
      />
    </BottomDrawer>
  );
}

export function ConfirmMealBackground(props: ViewProps & { className?: string }) {
  const { covered } = useHostState();
  return (
    <View
      {...props}
      importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={covered}
      aria-hidden={covered}
    />
  );
}
