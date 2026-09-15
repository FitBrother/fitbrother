import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getMe } from "@/lib/api";
import { avatarUrlKey, resolveAvatarUrl } from "@/lib/hooks/useAvatarUrl";
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
      // getMe() returns { profile, nutrition_goal, anthropometric } or null
      const data = (await getMe()) as { profile: Profile } | null;
      const profile = data?.profile ?? null;
      setState(profile ? { status: "ready", profile } : { status: "missing" });
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
