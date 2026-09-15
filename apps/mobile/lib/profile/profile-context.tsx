import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchHome, type HomeResponse } from "@/lib/api";
import { avatarUrlKey, resolveAvatarUrl } from "@/lib/hooks/useAvatarUrl";
import { dailySummaryKey } from "@/lib/hooks/useDailySummary";
import { mealsForDayKey } from "@/lib/hooks/useMealsForDay";
import type { Profile } from "./types";

type State =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "missing" }
  | { status: "error"; message: string };

type ContextValue = State & {
  refresh: () => Promise<void>;
  update: (patch: Partial<Profile>) => void;
};

const ProfileContext = createContext<ContextValue>({
  status: "loading",
  refresh: async () => {},
  update: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const queryClient = useQueryClient();

  const load = useCallback(async () => {
    try {
      const data = (await fetchHome()) as HomeResponse | null;
      const profile = (data?.profile as Profile | undefined) ?? null;
      setState(profile ? { status: "ready", profile } : { status: "missing" });
      if (data) {
        // Semeia o cache do React Query com as mesmas chaves que
        // useDailySummary/useMealsForDay usam (`day` calculado no servidor,
        // via fitbrother_today) — index.tsx não precisa esperar uma segunda
        // rodada de fetch pra resumo/refeições do dia, já que GET /me/home
        // trouxe tudo numa resposta só. Se o `day` calculado no client não
        // bater exatamente com o do servidor (borda da virada do dia), os
        // hooks simplesmente buscam eles mesmos, como antes.
        queryClient.setQueryData(dailySummaryKey(data.day), data.summary);
        queryClient.setQueryData(mealsForDayKey(data.day), data.meals);
      }
      // Dispara a assinatura + o download da foto em paralelo com o resto do
      // loading inicial (mealsQuery/summaryQuery), em vez de só começar
      // quando o HomeHeader monta — é o que faz a foto já estar pronta (não
      // só a URL) assim que a tela deixa de ser skeleton. `useAvatarUrl` lê
      // da mesma chave.
      if (profile?.avatar_url) {
        const path = profile.avatar_url;
        void queryClient.prefetchQuery({
          queryKey: avatarUrlKey(path),
          queryFn: () => resolveAvatarUrl(path),
        });
      }
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "profile_load_failed",
      });
    }
  }, [queryClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback((patch: Partial<Profile>) => {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", profile: { ...current.profile, ...patch } }
        : current,
    );
  }, []);

  return (
    <ProfileContext.Provider value={{ ...state, refresh: load, update }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): Profile {
  const state = useContext(ProfileContext);
  if (state.status !== "ready") {
    throw new Error(`useProfile called while status=${state.status}`);
  }
  return state.profile;
}

export function useProfileState(): State {
  return useContext(ProfileContext);
}

export function useProfileActions() {
  const { refresh, update } = useContext(ProfileContext);
  return { refresh, update };
}
